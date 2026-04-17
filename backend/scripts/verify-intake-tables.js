import pool, { testConnection } from '../config/database.js';

async function verifyIntakeTables() {
  let connection;
  try {
    console.log('🔍 Verifying intake forms tables...\n');
    
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to database');
      process.exit(1);
    }

    connection = await pool.getConnection();

    // Check each table
    const tables = ['forms', 'form_fields', 'form_submissions', 'form_field_mappings', 'form_analytics'];
    
    for (const table of tables) {
      console.log(`\n📋 Table: ${table}`);
      console.log('─'.repeat(50));
      
      const [rows] = await connection.query(`SHOW TABLES LIKE '${table}'`);
      
      if (rows.length === 0) {
        console.log(`❌ Table '${table}' does NOT exist`);
        continue;
      }
      
      console.log(`✅ Table exists`);
      
      // Get column information
      const [columns] = await connection.query(`DESCRIBE ${table}`);
      console.log(`\nColumns (${columns.length}):`);
      columns.forEach(col => {
        const nullable = col.Null === 'YES' ? 'NULL' : 'NOT NULL';
        const key = col.Key ? ` [${col.Key}]` : '';
        const extra = col.Extra ? ` (${col.Extra})` : '';
        console.log(`  - ${col.Field}: ${col.Type} ${nullable}${key}${extra}`);
      });
      
      // Get foreign key information
      const [foreignKeys] = await connection.query(`
        SELECT 
          kcu.CONSTRAINT_NAME,
          kcu.COLUMN_NAME,
          kcu.REFERENCED_TABLE_NAME,
          kcu.REFERENCED_COLUMN_NAME,
          rc.DELETE_RULE,
          rc.UPDATE_RULE
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
          AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
        WHERE kcu.TABLE_SCHEMA = DATABASE()
          AND kcu.TABLE_NAME = '${table}'
          AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      `);
      
      if (foreignKeys.length > 0) {
        console.log(`\nForeign Keys (${foreignKeys.length}):`);
        foreignKeys.forEach(fk => {
          console.log(`  - ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
          console.log(`    ON DELETE ${fk.DELETE_RULE}, ON UPDATE ${fk.UPDATE_RULE}`);
        });
      }
      
      // Get index information
      const [indexes] = await connection.query(`SHOW INDEX FROM ${table}`);
      const uniqueIndexes = [...new Set(indexes.map(idx => idx.Key_name))];
      console.log(`\nIndexes (${uniqueIndexes.length}):`);
      uniqueIndexes.forEach(indexName => {
        const indexCols = indexes.filter(idx => idx.Key_name === indexName);
        const cols = indexCols.map(idx => idx.Column_name).join(', ');
        const unique = indexCols[0].Non_unique === 0 ? ' [UNIQUE]' : '';
        console.log(`  - ${indexName}: (${cols})${unique}`);
      });
    }

    console.log('\n\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

verifyIntakeTables();

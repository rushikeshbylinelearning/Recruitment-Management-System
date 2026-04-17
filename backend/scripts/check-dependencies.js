import pool, { testConnection } from '../config/database.js';

async function checkDependencies() {
  let connection;
  try {
    console.log('🔍 Checking dependencies for intake forms tables...\n');
    
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to database');
      process.exit(1);
    }

    connection = await pool.getConnection();

    // Check all tables
    const [allTables] = await connection.query('SHOW TABLES');
    console.log('All tables in database:');
    allTables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`  - ${tableName}`);
    });
    console.log('');

    // Check for required tables
    const requiredTables = ['jobs', 'users', 'candidates'];
    
    for (const table of requiredTables) {
      const [rows] = await connection.query(`SHOW TABLES LIKE '${table}'`);
      
      if (rows.length === 0) {
        console.log(`❌ Table '${table}' does NOT exist`);
      } else {
        console.log(`✅ Table '${table}' exists`);
        
        // Get column information for id column
        const [columns] = await connection.query(`DESCRIBE ${table}`);
        const idColumn = columns.find(col => col.Field === 'id');
        
        if (idColumn) {
          console.log(`   - id column type: ${idColumn.Type}`);
          console.log(`   - id column key: ${idColumn.Key}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

checkDependencies();

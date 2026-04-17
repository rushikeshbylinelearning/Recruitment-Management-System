import pool, { testConnection } from '../config/database.js';

async function checkTableDetails() {
  let connection;
  try {
    const connected = await testConnection();
    if (!connected) {
      process.exit(1);
    }

    connection = await pool.getConnection();

    const tables = ['job_postings', 'users', 'candidates'];
    
    for (const table of tables) {
      console.log(`\n📋 ${table}:`);
      const [info] = await connection.query(`
        SELECT 
          ENGINE,
          TABLE_COLLATION,
          CREATE_OPTIONS
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '${table}'
      `);
      
      if (info.length > 0) {
        console.log(`  Engine: ${info[0].ENGINE}`);
        console.log(`  Collation: ${info[0].TABLE_COLLATION}`);
      }
      
      // Check foreign keys on this table
      const [fks] = await connection.query(`
        SELECT 
          CONSTRAINT_NAME,
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND REFERENCED_TABLE_NAME = '${table}'
      `);
      
      if (fks.length > 0) {
        console.log(`  Referenced by:`);
        fks.forEach(fk => {
          console.log(`    - ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} from other tables`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

checkTableDetails();

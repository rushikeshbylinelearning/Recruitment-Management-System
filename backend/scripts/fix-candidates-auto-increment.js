import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function fixCandidatesAutoIncrement() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Connected to database');

    // Check current table structure
    console.log('\n📊 Checking current candidates table structure...');
    const [columns] = await connection.execute(
      `SHOW COLUMNS FROM candidates`
    );
    console.log('Candidates table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Key ? `(${col.Key})` : ''} ${col.Extra}`);
    });

    // Check if id is UUID or INT
    const idColumn = columns.find(col => col.Field === 'id');
    console.log('\n📋 ID Column Details:', idColumn);

    if (idColumn.Type.includes('varchar') || idColumn.Type.includes('char')) {
      console.log('\n⚠️  The id column is UUID-based (varchar), not integer.');
      console.log('The issue is that the INSERT statement is not providing a UUID value.');
      console.log('\n💡 Solution: The formSubmissionProcessor needs to generate UUIDs for new candidates.');
      return;
    }

    // Get the maximum ID value
    const [maxIdResult] = await connection.execute(
      'SELECT MAX(id) as maxId FROM candidates'
    );
    const maxId = maxIdResult[0].maxId || 0;
    console.log(`\n📈 Maximum ID in candidates table: ${maxId}`);

    // Drop the existing PRIMARY KEY first
    console.log('\n🔧 Dropping existing PRIMARY KEY...');
    await connection.execute(
      `ALTER TABLE candidates DROP PRIMARY KEY`
    );
    console.log('✅ PRIMARY KEY dropped');

    // Modify the id column to add AUTO_INCREMENT and PRIMARY KEY
    console.log('\n🔧 Adding AUTO_INCREMENT to id column...');
    await connection.execute(
      `ALTER TABLE candidates 
       MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`
    );
    console.log('✅ AUTO_INCREMENT added successfully');

    // Set the AUTO_INCREMENT value to start from the next available ID
    const nextId = maxId + 1;
    console.log(`\n🔧 Setting AUTO_INCREMENT to start from ${nextId}...`);
    await connection.execute(
      `ALTER TABLE candidates AUTO_INCREMENT = ${nextId}`
    );
    console.log('✅ AUTO_INCREMENT value set successfully');

    // Verify the fix
    console.log('\n📊 Verifying the fix...');
    const [newColumns] = await connection.execute(
      `SHOW COLUMNS FROM candidates WHERE Field = 'id'`
    );
    console.log('Updated id column:', newColumns[0]);

    console.log('\n✅ Fix completed successfully!');
    console.log('The candidates table id column now has AUTO_INCREMENT.');
    console.log('New candidate records will automatically get sequential IDs.');

  } catch (error) {
    console.error('❌ Error fixing candidates table:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the fix
fixCandidatesAutoIncrement()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to fix candidates table:', error.message);
    process.exit(1);
  });

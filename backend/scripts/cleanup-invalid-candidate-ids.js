import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupInvalidCandidateIds() {
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

    // Check for candidates with empty or invalid IDs
    console.log('\n🔍 Checking for candidates with empty or invalid IDs...');
    const [invalidCandidates] = await connection.execute(
      `SELECT id, name, email, phone FROM candidates WHERE id = '' OR id IS NULL OR LENGTH(id) < 36`
    );

    if (invalidCandidates.length === 0) {
      console.log('✅ No invalid candidate IDs found!');
      return;
    }

    console.log(`⚠️  Found ${invalidCandidates.length} candidates with invalid IDs:`);
    invalidCandidates.forEach((candidate, index) => {
      console.log(`  ${index + 1}. ID: "${candidate.id}" | Name: ${candidate.name} | Email: ${candidate.email}`);
    });

    // Fix each invalid candidate by generating a new UUID
    console.log('\n🔧 Fixing invalid candidate IDs...');
    for (const candidate of invalidCandidates) {
      const [uuidResult] = await connection.execute('SELECT UUID() as uuid');
      const newId = uuidResult[0].uuid;
      
      await connection.execute(
        `UPDATE candidates SET id = ? WHERE id = ? AND email = ?`,
        [newId, candidate.id, candidate.email]
      );
      
      console.log(`  ✅ Updated candidate "${candidate.name}" (${candidate.email}): "${candidate.id}" → "${newId}"`);
    }

    console.log('\n✅ All invalid candidate IDs have been fixed!');

  } catch (error) {
    console.error('❌ Error cleaning up candidate IDs:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the cleanup
cleanupInvalidCandidateIds()
  .then(() => {
    console.log('\n🎉 Cleanup completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error.message);
    process.exit(1);
  });

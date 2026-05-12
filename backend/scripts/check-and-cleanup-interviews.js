import pool, { query } from '../config/database.js';

async function checkAndCleanupInterviews() {
  try {
    console.log('Checking interviews in database...\n');
    
    // Get all interviews
    const interviews = await query(`
      SELECT 
        i.id,
        i.candidate_id,
        i.interviewer_id,
        i.date,
        i.time,
        i.status,
        c.name as candidate_name,
        u.name as interviewer_name
      FROM interviews i
      LEFT JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN users u ON i.interviewer_id = u.id
    `);
    
    console.log(`Total interviews found: ${interviews.length}\n`);
    
    if (interviews.length === 0) {
      console.log('✅ No interviews in database. The UI should show empty state.');
      await pool.end();
      return;
    }
    
    // Check for orphaned interviews (where candidate or interviewer doesn't exist)
    const orphanedInterviews = interviews.filter(
      iv => !iv.candidate_name || !iv.interviewer_name
    );
    
    if (orphanedInterviews.length > 0) {
      console.log(`⚠️  Found ${orphanedInterviews.length} orphaned interviews:\n`);
      orphanedInterviews.forEach(iv => {
        console.log(`  - Interview ID ${iv.id}:`);
        console.log(`    Candidate: ${iv.candidate_name || 'MISSING'} (ID: ${iv.candidate_id})`);
        console.log(`    Interviewer: ${iv.interviewer_name || 'MISSING'} (ID: ${iv.interviewer_id})`);
        console.log(`    Date: ${iv.date} ${iv.time}`);
        console.log(`    Status: ${iv.status}\n`);
      });
      
      console.log('Do you want to delete these orphaned interviews? (y/n)');
      console.log('Run: node scripts/cleanup-orphaned-interviews.js\n');
    } else {
      console.log('✅ All interviews have valid candidate and interviewer references.\n');
      interviews.forEach(iv => {
        console.log(`  - Interview ID ${iv.id}:`);
        console.log(`    Candidate: ${iv.candidate_name}`);
        console.log(`    Interviewer: ${iv.interviewer_name}`);
        console.log(`    Date: ${iv.date} ${iv.time}`);
        console.log(`    Status: ${iv.status}\n`);
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkAndCleanupInterviews();

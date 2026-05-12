import pool, { query } from '../config/database.js';

async function cleanupOrphanedInterviews() {
  try {
    console.log('Cleaning up orphaned interviews...\n');
    
    // Find interviews where candidate or interviewer doesn't exist
    const orphanedInterviews = await query(`
      SELECT 
        i.id,
        i.candidate_id,
        i.interviewer_id,
        c.name as candidate_name,
        u.name as interviewer_name
      FROM interviews i
      LEFT JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN users u ON i.interviewer_id = u.id
      WHERE c.id IS NULL OR u.id IS NULL
    `);
    
    if (orphanedInterviews.length === 0) {
      console.log('✅ No orphaned interviews found.');
      await pool.end();
      return;
    }
    
    console.log(`Found ${orphanedInterviews.length} orphaned interviews to delete:\n`);
    orphanedInterviews.forEach(iv => {
      console.log(`  - Interview ID ${iv.id}:`);
      console.log(`    Candidate ID: ${iv.candidate_id} ${iv.candidate_name ? '' : '(MISSING)'}`);
      console.log(`    Interviewer ID: ${iv.interviewer_id} ${iv.interviewer_name ? '' : '(MISSING)'}`);
    });
    
    // Delete orphaned interviews
    const result = await query(`
      DELETE i FROM interviews i
      LEFT JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN users u ON i.interviewer_id = u.id
      WHERE c.id IS NULL OR u.id IS NULL
    `);
    
    console.log(`\n✅ Deleted ${result.affectedRows} orphaned interviews.`);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

cleanupOrphanedInterviews();

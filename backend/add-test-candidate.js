import { query } from './config/database.js';
import { v4 as uuidv4 } from 'uuid';

async function addTestCandidates() {
  try {
    console.log('\n=== Adding Test Candidates for Today ===\n');

    const testCandidates = [
      { name: 'John Doe Test', email: 'john.doe.test@example.com', phone: '555-0101', position: 'Software Engineer', stage: 'Applied' },
      { name: 'Jane Smith Test', email: 'jane.smith.test@example.com', phone: '555-0102', position: 'Software Engineer', stage: 'Applied' },
      { name: 'Bob Johnson Test', email: 'bob.johnson.test@example.com', phone: '555-0103', position: 'Product Manager', stage: 'Applied' },
      { name: 'Alice Williams Test', email: 'alice.williams.test@example.com', phone: '555-0104', position: 'UX Designer', stage: 'Screening' },
      { name: 'Charlie Brown Test', email: 'charlie.brown.test@example.com', phone: '555-0105', position: 'Software Engineer', stage: 'Screening' },
      { name: 'Diana Prince Test', email: 'diana.prince.test@example.com', phone: '555-0106', position: 'Data Analyst', stage: 'Interview' },
      { name: 'Eve Davis Test', email: 'eve.davis.test@example.com', phone: '555-0107', position: 'Product Manager', stage: 'Applied' },
      { name: 'Frank Miller Test', email: 'frank.miller.test@example.com', phone: '555-0108', position: 'DevOps Engineer', stage: 'Applied' },
    ];

    let added = 0;
    for (const candidate of testCandidates) {
      try {
        const id = uuidv4();
        await query(`
          INSERT INTO candidates (id, name, email, phone, position, stage, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [id, candidate.name, candidate.email, candidate.phone, candidate.position, candidate.stage]);
        
        console.log(`✅ Added: ${candidate.name} - ${candidate.position} (${candidate.stage})`);
        added++;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Skipped: ${candidate.name} (already exists)`);
        } else {
          console.error(`❌ Error adding ${candidate.name}:`, err.message);
        }
      }
    }

    console.log(`\n📊 Successfully added ${added} test candidates!`);
    
    // Show the metrics
    const todayTotal = await query(`
      SELECT COUNT(*) as count 
      FROM candidates 
      WHERE DATE(created_at) = CURDATE()
    `);
    
    const byStage = await query(`
      SELECT stage, COUNT(*) as count 
      FROM candidates 
      WHERE DATE(created_at) = CURDATE()
      GROUP BY stage
      ORDER BY count DESC
    `);
    
    const byRole = await query(`
      SELECT position, COUNT(*) as count 
      FROM candidates 
      WHERE DATE(created_at) = CURDATE()
      GROUP BY position
      ORDER BY count DESC
    `);

    console.log('\n=== Today\'s Metrics ===');
    console.log(`Total: ${todayTotal[0].count}`);
    console.log('\nBy Stage:');
    byStage.forEach(s => console.log(`  ${s.stage}: ${s.count}`));
    console.log('\nBy Role:');
    byRole.forEach(r => console.log(`  ${r.position}: ${r.count}`));
    
    console.log('\n🎉 Now refresh your dashboard to see the daily metrics!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addTestCandidates();

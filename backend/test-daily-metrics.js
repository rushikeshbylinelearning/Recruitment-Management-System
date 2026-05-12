import { query } from './config/database.js';

async function testDailyMetrics() {
  try {
    console.log('\n=== Testing Daily Metrics ===\n');

    // Check total candidates created today
    const todayTotal = await query(`
      SELECT COUNT(*) as count 
      FROM candidates 
      WHERE DATE(created_at) = CURDATE()
    `);
    console.log('📊 Total candidates uploaded today:', todayTotal[0].count);

    if (todayTotal[0].count === 0) {
      console.log('\n⚠️  No candidates uploaded today!');
      console.log('💡 The daily metrics card will not appear on the dashboard.');
      console.log('\n📝 To test the feature:');
      console.log('   1. Add a new candidate through the UI');
      console.log('   2. Or run: node backend/add-test-candidate.js');
      console.log('   3. Refresh the dashboard\n');
      
      // Show some recent candidates
      const recentCandidates = await query(`
        SELECT name, position, stage, DATE(created_at) as created_date
        FROM candidates 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      if (recentCandidates.length > 0) {
        console.log('📋 Recent candidates (not from today):');
        recentCandidates.forEach(c => {
          console.log(`   - ${c.name} (${c.position}) - ${c.stage} - Created: ${c.created_date}`);
        });
      }
    } else {
      // Show breakdown by stage
      const byStage = await query(`
        SELECT stage, COUNT(*) as count 
        FROM candidates 
        WHERE DATE(created_at) = CURDATE()
        GROUP BY stage
        ORDER BY count DESC
      `);
      
      console.log('\n📈 By Stage:');
      byStage.forEach(s => {
        console.log(`   ${s.stage}: ${s.count}`);
      });

      // Show breakdown by role
      const byRole = await query(`
        SELECT position, COUNT(*) as count 
        FROM candidates 
        WHERE DATE(created_at) = CURDATE()
        GROUP BY position
        ORDER BY count DESC
        LIMIT 10
      `);
      
      console.log('\n👔 By Role:');
      byRole.forEach(r => {
        console.log(`   ${r.position}: ${r.count}`);
      });

      console.log('\n✅ Daily metrics are available!');
      console.log('🔄 Refresh your dashboard to see them.\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testDailyMetrics();

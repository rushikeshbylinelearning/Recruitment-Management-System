import { query } from './config/database.js';

async function testFixedQuery() {
  try {
    console.log('Testing fixed interviews query...');
    
    // Test the fixed query with string concatenation for LIMIT/OFFSET
    const testQuery = `SELECT 
      i.*,
      c.name as candidate_name,
      c.position as candidate_position,
      c.email as candidate_email,
      u.name as interviewer_name,
      u.email as interviewer_email
    FROM interviews i
    LEFT JOIN candidates c ON i.candidate_id = c.id
    LEFT JOIN users u ON i.interviewer_id = u.id
    ORDER BY i.scheduled_date DESC 
    LIMIT 5 OFFSET 0`;

    const result = await query(testQuery, []);
    console.log(`✅ Fixed query executed successfully, returned ${result.length} results`);
    
    if (result.length > 0) {
      console.log('Sample result:', JSON.stringify(result[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Fixed query failed:', error.message);
  }
}

testFixedQuery();

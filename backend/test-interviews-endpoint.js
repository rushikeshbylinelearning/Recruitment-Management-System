import { query } from './config/database.js';

async function testInterviewsQuery() {
  try {
    console.log('Testing interviews query...');
    
    // Test the exact query from the route
    const interviews = await query(
      `SELECT 
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
       LIMIT 10 OFFSET 0`
    );
    
    console.log('Query successful!');
    console.log('Interviews found:', interviews.length);
    console.log('Sample interview:', interviews[0]);
    
  } catch (error) {
    console.error('Query failed:', error);
    console.error('Error details:', error.message);
  }
}

testInterviewsQuery();


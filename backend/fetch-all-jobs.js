import { query, testConnection, closePool } from './config/database.js';

async function fetchAllJobs() {
  try {
    console.log('🔍 Connecting to database...\n');
    
    // Test connection
    const connected = await testConnection();
    if (!connected) {
      console.error('Failed to connect to database');
      process.exit(1);
    }

    // Fetch all jobs from database
    console.log('📊 Fetching all job postings...\n');
    const jobs = await query(`
      SELECT 
        j.id,
        j.title,
        j.department,
        j.location,
        j.job_type as jobType,
        j.status,
        j.posted_date as postedDate,
        j.deadline,
        j.description,
        j.requirements,
        j.created_by,
        j.created_at,
        j.updated_at,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM candidates c WHERE c.job_id = j.id) as applicantCount
      FROM job_postings j
      LEFT JOIN users u ON j.created_by = u.id
      ORDER BY j.created_at DESC
    `);

    if (jobs.length === 0) {
      console.log('❌ No job postings found in the database.\n');
    } else {
      console.log(`✅ Found ${jobs.length} job posting(s):\n`);
      console.log('═'.repeat(100));
      
      jobs.forEach((job, index) => {
        console.log(`\n📋 JOB CARD #${index + 1}`);
        console.log('─'.repeat(100));
        console.log(`ID:              ${job.id}`);
        console.log(`Title:           ${job.title}`);
        console.log(`Department:      ${job.department}`);
        console.log(`Location:        ${job.location}`);
        console.log(`Job Type:        ${job.jobType}`);
        console.log(`Status:          ${job.status}`);
        console.log(`Posted Date:     ${new Date(job.postedDate).toLocaleDateString()}`);
        console.log(`Deadline:        ${new Date(job.deadline).toLocaleDateString()}`);
        console.log(`Applicants:      ${job.applicantCount}`);
        console.log(`Created By:      ${job.created_by_name || 'N/A'} (ID: ${job.created_by})`);
        console.log(`Created At:      ${new Date(job.created_at).toLocaleString()}`);
        console.log(`Updated At:      ${new Date(job.updated_at).toLocaleString()}`);
        
        if (job.description) {
          const shortDesc = job.description.length > 100 
            ? job.description.substring(0, 100) + '...' 
            : job.description;
          console.log(`Description:     ${shortDesc}`);
        }
        
        console.log('─'.repeat(100));
      });
      
      console.log('\n═'.repeat(100));
      console.log('\n📊 SUMMARY:');
      console.log(`   Total Jobs: ${jobs.length}`);
      
      // Count by status
      const statusCounts = jobs.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\n   By Status:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count}`);
      });
      
      // Count by department
      const deptCounts = jobs.reduce((acc, job) => {
        acc[job.department] = (acc[job.department] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\n   By Department:');
      Object.entries(deptCounts).forEach(([dept, count]) => {
        console.log(`   - ${dept}: ${count}`);
      });
      
      console.log('\n═'.repeat(100));
    }

    // Close connection
    await closePool();
    console.log('\n✅ Database connection closed.\n');
    
  } catch (error) {
    console.error('❌ Error fetching jobs:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
fetchAllJobs();

import { query, testConnection } from '../config/database.js';
import bcrypt from 'bcryptjs';

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to database. Please check your configuration.');
      process.exit(1);
    }

    // Check if data already exists
    const existingUsers = await query('SELECT COUNT(*) as count FROM users');
    if (existingUsers[0].count > 1) { // More than just the default admin
      console.log('⚠️  Database already has data. Skipping seed.');
      return;
    }

    // Hash passwords
    const saltRounds = 12;
    const hashedPasswords = {
      sarah: await bcrypt.hash('sarah123', saltRounds),
      mike: await bcrypt.hash('mike123', saltRounds),
      emma: await bcrypt.hash('emma123', saltRounds),
      david: await bcrypt.hash('david123', saltRounds),
      john: await bcrypt.hash('john123', saltRounds)
    };

    // Insert sample users
    const users = [
      {
        username: 'sarah.johnson',
        email: 'sarah.johnson@company.com',
        name: 'Sarah Johnson',
        password_hash: hashedPasswords.sarah,
        role: 'HR Manager'
      },
      {
        username: 'mike.chen',
        email: 'mike.chen@company.com',
        name: 'Mike Chen',
        password_hash: hashedPasswords.mike,
        role: 'Recruiter'
      },
      {
        username: 'emma.wilson',
        email: 'emma.wilson@company.com',
        name: 'Emma Wilson',
        password_hash: hashedPasswords.emma,
        role: 'Team Lead'
      },
      {
        username: 'david.kim',
        email: 'david.kim@company.com',
        name: 'David Kim',
        password_hash: hashedPasswords.david,
        role: 'Recruiter'
      },
      {
        username: 'john.smith',
        email: 'john.smith@company.com',
        name: 'John Smith',
        password_hash: hashedPasswords.john,
        role: 'Interviewer'
      }
    ];

    console.log('👥 Creating sample users...');
    const userIds = {};
    
    for (const user of users) {
      const result = await query(
        `INSERT INTO users (username, email, name, password_hash, role, status) 
         VALUES (?, ?, ?, ?, ?, 'Active')`,
        [user.username, user.email, user.name, user.password_hash, user.role]
      );
      userIds[user.username] = result.insertId;
    }

    // Set permissions for each user
    console.log('🔐 Setting up permissions...');
    const permissions = {
      'sarah.johnson': [
        { module: 'dashboard', actions: ['view'] },
        { module: 'jobs', actions: ['view', 'create', 'edit'] },
        { module: 'candidates', actions: ['view', 'create', 'edit'] },
        { module: 'communications', actions: ['view', 'create', 'edit'] },
        { module: 'tasks', actions: ['view', 'create', 'edit'] },
        { module: 'team', actions: ['view'] },
        { module: 'analytics', actions: ['view'] },
      ],
      'mike.chen': [
        { module: 'dashboard', actions: ['view'] },
        { module: 'jobs', actions: ['view'] },
        { module: 'candidates', actions: ['view', 'edit'] },
        { module: 'communications', actions: ['view', 'create'] },
        { module: 'tasks', actions: ['view', 'create', 'edit'] },
        { module: 'analytics', actions: ['view'] },
      ],
      'emma.wilson': [
        { module: 'dashboard', actions: ['view'] },
        { module: 'jobs', actions: ['view', 'edit'] },
        { module: 'candidates', actions: ['view', 'edit'] },
        { module: 'communications', actions: ['view', 'create', 'edit'] },
        { module: 'tasks', actions: ['view', 'create', 'edit'] },
        { module: 'team', actions: ['view'] },
        { module: 'analytics', actions: ['view'] },
      ],
      'david.kim': [
        { module: 'dashboard', actions: ['view'] },
        { module: 'jobs', actions: ['view'] },
        { module: 'candidates', actions: ['view', 'edit'] },
        { module: 'communications', actions: ['view', 'create'] },
        { module: 'tasks', actions: ['view', 'create', 'edit'] },
        { module: 'analytics', actions: ['view'] },
      ],
      'john.smith': [
        { module: 'dashboard', actions: ['view'] },
        { module: 'candidates', actions: ['view'] },
        { module: 'interviews', actions: ['view', 'edit'] },
      ]
    };

    for (const [username, userPermissions] of Object.entries(permissions)) {
      const userId = userIds[username];
      for (const permission of userPermissions) {
        await query(
          'INSERT INTO permissions (user_id, module, actions) VALUES (?, ?, ?)',
          [userId, permission.module, JSON.stringify(permission.actions)]
        );
      }
    }

    // Create interviewer profile for John Smith
    await query(
      `INSERT INTO interviewer_profiles (user_id, department, expertise, interview_types, total_interviews, average_rating) 
       VALUES (?, ?, ?, ?, 0, 0.00)`,
      [userIds['john.smith'], 'Engineering', JSON.stringify(['React', 'Node.js', 'System Design', 'JavaScript']), JSON.stringify(['Technical'])]
    );

    // Insert sample job postings
    console.log('💼 Creating sample job postings...');
    const jobs = [
      {
        title: 'Senior Frontend Developer',
        department: 'Engineering',
        location: 'San Francisco, CA',
        job_type: 'Full-time',
        status: 'Active',
        posted_date: '2024-01-15',
        deadline: '2024-02-28',
        description: 'We are looking for an experienced Frontend Developer to join our team.',
        requirements: JSON.stringify(['React', 'TypeScript', 'CSS', '3+ years experience']),
        created_by: userIds['sarah.johnson']
      },
      {
        title: 'Product Manager',
        department: 'Product',
        location: 'New York, NY',
        job_type: 'Full-time',
        status: 'Active',
        posted_date: '2024-01-10',
        deadline: '2024-03-15',
        description: 'Seeking a strategic Product Manager to drive product vision.',
        requirements: JSON.stringify(['Product Strategy', 'Agile', 'Analytics', '5+ years experience']),
        created_by: userIds['sarah.johnson']
      },
      {
        title: 'UX Designer',
        department: 'Design',
        location: 'Remote',
        job_type: 'Full-time',
        status: 'Paused',
        posted_date: '2024-01-05',
        deadline: '2024-02-20',
        description: 'Creative UX Designer to enhance user experience.',
        requirements: JSON.stringify(['Figma', 'User Research', 'Prototyping', '2+ years experience']),
        created_by: userIds['sarah.johnson']
      }
    ];

    const jobIds = {};
    for (const job of jobs) {
      const result = await query(
        `INSERT INTO job_postings (title, department, location, job_type, status, posted_date, deadline, description, requirements, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [job.title, job.department, job.location, job.job_type, job.status, job.posted_date, job.deadline, job.description, job.requirements, job.created_by]
      );
      jobIds[job.title] = result.insertId;
    }

    // Assign jobs to users
    await query('INSERT INTO job_assignments (job_id, user_id) VALUES (?, ?)', [jobIds['Senior Frontend Developer'], userIds['sarah.johnson']]);
    await query('INSERT INTO job_assignments (job_id, user_id) VALUES (?, ?)', [jobIds['Senior Frontend Developer'], userIds['mike.chen']]);
    await query('INSERT INTO job_assignments (job_id, user_id) VALUES (?, ?)', [jobIds['Product Manager'], userIds['emma.wilson']]);
    await query('INSERT INTO job_assignments (job_id, user_id) VALUES (?, ?)', [jobIds['UX Designer'], userIds['david.kim']]);

    // Insert sample candidates
    console.log('👤 Creating sample candidates...');
    const candidates = [
      {
        name: 'Alice Cooper',
        email: 'alice.cooper@email.com',
        phone: '+1-555-0101',
        position: 'Senior Frontend Developer',
        stage: 'Interview',
        source: 'LinkedIn',
        applied_date: '2024-01-20',
        notes: 'Strong React skills, good communication',
        score: 4.5,
        assigned_to: userIds['sarah.johnson'],
        skills: JSON.stringify(['React', 'TypeScript', 'Node.js', 'GraphQL']),
        experience: '5 years',
        salary_expected: '12-15 LPA',
        salary_negotiable: true,
        joining_time: '2 weeks',
        notice_period: '30 days',
        immediate_joiner: false
      },
      {
        name: 'Bob Smith',
        email: 'bob.smith@email.com',
        phone: '+1-555-0102',
        position: 'Product Manager',
        stage: 'Screening',
        source: 'Indeed',
        applied_date: '2024-01-18',
        notes: 'Good product sense, needs technical evaluation',
        score: 4.0,
        assigned_to: userIds['emma.wilson'],
        skills: JSON.stringify(['Product Strategy', 'Analytics', 'Agile', 'Stakeholder Management']),
        experience: '6 years',
        salary_expected: '18-22 LPA',
        salary_negotiable: true,
        joining_time: '1 month',
        notice_period: '60 days',
        immediate_joiner: false
      },
      {
        name: 'Carol Davis',
        email: 'carol.davis@email.com',
        phone: '+1-555-0103',
        position: 'UX Designer',
        stage: 'Applied',
        source: 'Dribbble',
        applied_date: '2024-01-19',
        notes: 'Impressive portfolio, creative approach',
        score: 4.2,
        assigned_to: userIds['david.kim'],
        skills: JSON.stringify(['Figma', 'User Research', 'Prototyping', 'Design Systems']),
        experience: '4 years',
        salary_expected: '10-12 LPA',
        salary_negotiable: false,
        joining_time: '2 weeks',
        notice_period: '30 days',
        immediate_joiner: false
      }
    ];

    const candidateIds = {};
    for (const candidate of candidates) {
      const result = await query(
        `INSERT INTO candidates (name, email, phone, position, stage, source, applied_date, notes, score, assigned_to, skills, experience, salary_expected, salary_negotiable, joining_time, notice_period, immediate_joiner) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [candidate.name, candidate.email, candidate.phone, candidate.position, candidate.stage, candidate.source, candidate.applied_date, candidate.notes, candidate.score, candidate.assigned_to, candidate.skills, candidate.experience, candidate.salary_expected, candidate.salary_negotiable, candidate.joining_time, candidate.notice_period, candidate.immediate_joiner]
      );
      candidateIds[candidate.name] = result.insertId;
    }

    // Insert sample tasks
    console.log('📋 Creating sample tasks...');
    const tasks = [
      {
        title: 'Review Frontend Developer Applications',
        description: 'Screen and evaluate new applications for Senior Frontend Developer position',
        assigned_to: userIds['sarah.johnson'],
        job_id: jobIds['Senior Frontend Developer'],
        priority: 'High',
        status: 'In Progress',
        due_date: '2024-02-01',
        created_by: userIds['sarah.johnson']
      },
      {
        title: 'Schedule Interviews for Product Manager Role',
        description: 'Coordinate interview schedules for shortlisted Product Manager candidates',
        assigned_to: userIds['emma.wilson'],
        job_id: jobIds['Product Manager'],
        candidate_id: candidateIds['Bob Smith'],
        priority: 'High',
        status: 'Pending',
        due_date: '2024-01-31',
        created_by: userIds['emma.wilson']
      }
    ];

    for (const task of tasks) {
      await query(
        `INSERT INTO tasks (title, description, assigned_to, job_id, candidate_id, priority, status, due_date, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [task.title, task.description, task.assigned_to, task.job_id, task.candidate_id, task.priority, task.status, task.due_date, task.created_by]
      );
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('📊 Sample data has been created:');
    console.log('   - 5 users with different roles');
    console.log('   - 3 job postings');
    console.log('   - 3 candidates');
    console.log('   - 2 tasks');
    console.log('🔑 Login credentials:');
    console.log('   - admin / admin123 (Admin)');
    console.log('   - sarah.johnson / sarah123 (HR Manager)');
    console.log('   - mike.chen / mike123 (Recruiter)');
    console.log('   - emma.wilson / emma123 (Team Lead)');
    console.log('   - john.smith / john123 (Interviewer)');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

export default seedDatabase;


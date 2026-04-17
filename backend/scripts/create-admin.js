import bcrypt from 'bcryptjs';
import { query, testConnection, closePool } from '../config/database.js';

const createAdminUser = async () => {
  try {
    console.log('🔄 Connecting to database...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('❌ Failed to connect to database');
      process.exit(1);
    }

    const username = 'admin@byline.com';
    const email = 'admin@byline.com';
    const password = 'Admin@2026';
    const name = 'Admin User';
    const role = 'Admin';

    // Check if admin user already exists
    console.log('🔍 Checking if admin user already exists...');
    const existingUsers = await query(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      console.log('⚠️  Admin user already exists:');
      console.log(`   ID: ${existingUsers[0].id}`);
      console.log(`   Username: ${existingUsers[0].username}`);
      console.log(`   Email: ${existingUsers[0].email}`);
      
      // Update password for existing user
      console.log('🔄 Updating password for existing admin user...');
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      await query(
        'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
        [passwordHash, existingUsers[0].id]
      );
      
      console.log('✅ Admin password updated successfully!');
      console.log('\n📋 Admin Credentials:');
      console.log(`   Username: ${username}`);
      console.log(`   Password: ${password}`);
      
      await closePool();
      process.exit(0);
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create admin user
    console.log('👤 Creating admin user...');
    const result = await query(
      `INSERT INTO users (username, email, name, password_hash, role, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, 'Active', NOW(), NOW())`,
      [username, email, name, passwordHash, role]
    );

    const userId = result.insertId;
    console.log(`✅ Admin user created with ID: ${userId}`);

    // Create default admin permissions
    console.log('🔑 Setting up admin permissions...');
    const adminPermissions = [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'candidates', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'interviews', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'communications', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'assignments', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'tasks', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'team', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'analytics', actions: ['view'] },
      { module: 'settings', actions: ['view', 'edit'] },
    ];

    for (const permission of adminPermissions) {
      await query(
        'INSERT INTO permissions (user_id, module, actions) VALUES (?, ?, ?)',
        [userId, permission.module, JSON.stringify(permission.actions)]
      );
    }

    console.log('✅ Admin permissions configured successfully!');
    console.log('\n🎉 Admin user created successfully!');
    console.log('\n📋 Admin Credentials:');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${role}`);
    console.log('\n⚠️  Please change the password after first login for security.');

    await closePool();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    await closePool();
    process.exit(1);
  }
};

// Run the script
createAdminUser();

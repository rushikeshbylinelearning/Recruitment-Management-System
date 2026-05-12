/**
 * Quick script to reset a user's password directly in the database.
 * Usage: node scripts/reset-user-password.js <userId> <newPassword>
 * Example: node scripts/reset-user-password.js 7 newpassword123
 */

import bcrypt from 'bcryptjs';
import { query, testConnection } from '../config/database.js';
import config from '../config/config.js';

const [,, userId, newPassword] = process.argv;

if (!userId || !newPassword) {
  console.error('Usage: node scripts/reset-user-password.js <userId> <newPassword>');
  console.error('Example: node scripts/reset-user-password.js 7 newpassword123');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('❌ Password must be at least 6 characters long');
  process.exit(1);
}

const run = async () => {
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Could not connect to database');
    process.exit(1);
  }

  // Find the user first
  const users = await query('SELECT id, username, email, name, role FROM users WHERE id = ?', [userId]);
  if (users.length === 0) {
    console.error(`❌ No user found with ID ${userId}`);
    process.exit(1);
  }

  const user = users[0];
  console.log(`\nResetting password for:`);
  console.log(`  ID:       ${user.id}`);
  console.log(`  Username: ${user.username}`);
  console.log(`  Email:    ${user.email}`);
  console.log(`  Name:     ${user.name}`);
  console.log(`  Role:     ${user.role}`);

  const saltRounds = config.security.bcryptRounds || 12;
  const passwordHash = await bcrypt.hash(newPassword, saltRounds);

  await query(
    'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
    [passwordHash, userId]
  );

  console.log(`\n✅ Password reset successfully!`);
  console.log(`   The user can now log in with:`);
  console.log(`   Username/Email: ${user.username} or ${user.email}`);
  console.log(`   Password: ${newPassword}`);
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

/**
 * Usage: node backend/scripts/reset-password.js <username> <newpassword>
 * Example: node backend/scripts/reset-password.js admin admin123
 */
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';

const [,, username, newPassword] = process.argv;

if (!username || !newPassword) {
  console.error('Usage: node backend/scripts/reset-password.js <username> <newpassword>');
  process.exit(1);
}

const users = await query('SELECT id, username FROM users WHERE username = ? OR email = ?', [username, username]);

if (users.length === 0) {
  console.error(`❌ User "${username}" not found`);
  process.exit(1);
}

const user = users[0];
const hash = await bcrypt.hash(newPassword, 12);
await query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, user.id]);

console.log(`✅ Password reset for user "${user.username}" (id=${user.id})`);
process.exit(0);

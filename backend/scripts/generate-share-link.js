/**
 * Generates a fresh share token for the default-application form
 * and prints the usable link.
 */
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hr_workflow_db'
});

const slug = 'default-application';
const [forms] = await conn.execute('SELECT id FROM forms WHERE slug = ?', [slug]);

if (forms.length === 0) {
  console.error('❌ Form not found:', slug);
  process.exit(1);
}

const formId = forms[0].id;
const shareToken = crypto.randomBytes(32).toString('hex');

await conn.execute(
  'INSERT INTO form_share_tokens (form_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))',
  [formId, shareToken]
);

console.log('\n✅ New share link generated:\n');
const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
console.log(`${frontendBase}/apply/${slug}?share=${shareToken}`);
console.log('\nToken expires in 30 days.');

await conn.end();

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

// 1. Check form_share_tokens table
const [tables] = await conn.execute("SHOW TABLES LIKE 'form_share_tokens'");
console.log('form_share_tokens table exists:', tables.length > 0);

if (tables.length > 0) {
  const [cols] = await conn.execute('DESCRIBE form_share_tokens');
  console.log('Columns:', cols.map(c => c.Field).join(', '));

  const [cnt] = await conn.execute('SELECT COUNT(*) as cnt FROM form_share_tokens');
  console.log('Total share tokens in DB:', cnt[0].cnt);

  const [sample] = await conn.execute('SELECT id, token, form_id, is_active, expires_at FROM form_share_tokens LIMIT 5');
  console.log('Sample tokens:', JSON.stringify(sample, null, 2));
}

// 2. Check the form itself
const [forms] = await conn.execute("SELECT id, name, slug, is_active, access_token FROM forms WHERE slug = 'default-application'");
console.log('\nForm "default-application":', JSON.stringify(forms, null, 2));

// 3. Check all forms
const [allForms] = await conn.execute('SELECT id, name, slug, is_active FROM forms');
console.log('\nAll forms:', JSON.stringify(allForms, null, 2));

// 4. Try the exact query the middleware runs
const token = 'c7738f3b65e283d6d52a039e941ae4aae9e0a0a8b7a5ecd13ae8d4800bdc45cd';
const slug = 'default-application';
const [shareRows] = await conn.execute(
  `SELECT st.id, st.form_id, st.expires_at, st.is_active,
          f.id as fid, f.name, f.slug, f.is_active as form_active, f.access_token
   FROM form_share_tokens st
   JOIN forms f ON f.id = st.form_id
   WHERE st.token = ? AND f.slug = ?`,
  [token, slug]
);
console.log('\nMiddleware query result:', JSON.stringify(shareRows, null, 2));

await conn.end();

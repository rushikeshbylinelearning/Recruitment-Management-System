/**
 * One-time migration: Fix known field_key issues in form_fields table.
 *
 * Problems addressed:
 *  1. "postion"  → "position"  (typo in the default candidate application form)
 *  2. "email_id" → "email"     (non-canonical key that breaks duplicate-email check)
 *  3. "full_name" → "name"     (non-canonical key)
 *  4. "phone_number" → "phone" (non-canonical key)
 *  5. "years_of_experience" → "experience" (non-canonical key)
 *  6. "notice_period_days" → "notice_period" (non-canonical key)
 *
 * Run once:  node backend/scripts/fix-form-field-keys.js
 */

import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const FIXES = [
  { from: 'postion',              to: 'position'      },
  { from: 'email_id',             to: 'email'         },
  { from: 'full_name',            to: 'name'          },
  { from: 'phone_number',         to: 'phone'         },
  { from: 'years_of_experience',  to: 'experience'    },
  { from: 'notice_period_days',   to: 'notice_period' },
];

async function run() {
  const connection = await createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  console.log('✅ Connected to database:', process.env.DB_NAME);

  let totalFixed = 0;

  for (const { from, to } of FIXES) {
    // Check if the canonical key already exists in the same form before renaming
    // to avoid creating a duplicate field_key within the same form.
    const [rows] = await connection.execute(
      `SELECT id, form_id, label, field_key FROM form_fields WHERE field_key = ?`,
      [from]
    );

    if (rows.length === 0) {
      console.log(`  ℹ️  No fields found with key "${from}" — skipping.`);
      continue;
    }

    for (const row of rows) {
      // Check if the target key already exists in this form
      const [existing] = await connection.execute(
        `SELECT id FROM form_fields WHERE form_id = ? AND field_key = ? AND id != ?`,
        [row.form_id, to, row.id]
      );

      if (existing.length > 0) {
        console.warn(`  ⚠️  Form ${row.form_id} already has a field with key "${to}". Skipping field ID ${row.id} ("${row.label}").`);
        continue;
      }

      await connection.execute(
        `UPDATE form_fields SET field_key = ? WHERE id = ?`,
        [to, row.id]
      );
      console.log(`  ✅ Fixed field ID ${row.id} in form ${row.form_id}: "${from}" → "${to}" (label: "${row.label}")`);
      totalFixed++;
    }
  }

  await connection.end();
  console.log(`\n🎉 Done. Fixed ${totalFixed} field key(s).`);
}

run().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});

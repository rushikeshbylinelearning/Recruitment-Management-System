import { query } from '../config/database.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The correct uploads directory (relative to this script: ../uploads/resumes from backend/scripts/)
const uploadsDir = path.resolve(__dirname, '../../uploads/resumes');
console.log('Uploads dir:', uploadsDir);

const rows = await query(
  'SELECT id, filename, file_path FROM file_uploads WHERE assignment_id IS NOT NULL'
);

console.log(`Found ${rows.length} assignment attachment(s) to check`);

let fixed = 0;
for (const row of rows) {
  const correctPath = path.join(uploadsDir, row.filename);
  if (row.file_path !== correctPath) {
    if (fs.existsSync(correctPath)) {
      await query('UPDATE file_uploads SET file_path = ? WHERE id = ?', [correctPath, row.id]);
      console.log(`  Fixed id=${row.id}: ${row.filename}`);
      fixed++;
    } else {
      console.warn(`  MISSING file id=${row.id}: ${row.filename} (not found at ${correctPath})`);
    }
  } else {
    console.log(`  OK id=${row.id}: ${row.filename}`);
  }
}

console.log(`\nDone. Fixed ${fixed} path(s).`);
process.exit(0);

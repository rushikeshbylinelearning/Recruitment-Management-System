/**
 * Export Applied-stage candidates with applied_date before April 2026.
 * Usage:
 *   node scripts/export-applied-before-april.js           # all Applied
 *   node scripts/export-applied-before-april.js --bulk    # Bulk Import / Excel uploads only
 */
import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, testConnection } from '../config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../exports');
const END_DATE = '2026-03-31'; // before April 2026
const bulkOnly = process.argv.includes('--bulk');

const EXPORT_HEADERS = [
  'Name',
  'Email',
  'Phone',
  'Role',
  'Stage',
  'Main Stage',
  'Experience (years)',
  'Location',
  'Source',
  'Applied Date',
  'Expected CTC',
  'Created At',
  'Notes'
];

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

async function main() {
  const ok = await testConnection();
  if (!ok) process.exit(1);

  const sourceFilter = bulkOnly
    ? `AND (c.source = 'Bulk Import' OR EXISTS (
         SELECT 1 FROM hr_notes hn
         WHERE hn.candidate_id = c.id AND hn.interaction_type = 'Bulk Import'
       ))`
    : '';

  const candidates = await query(
    `SELECT c.id, c.name, c.email, c.phone, c.position, c.stage, c.main_stage,
            c.experience, c.location, c.source, c.applied_date, c.salary_expected,
            c.created_at
     FROM candidates c
     WHERE (c.stage = 'Applied' OR c.main_stage = 'applied')
       AND c.applied_date IS NOT NULL
       AND c.applied_date <= ?
       ${sourceFilter}
     ORDER BY c.applied_date DESC, c.name ASC`,
    [END_DATE]
  );

  const label = bulkOnly ? 'bulk-uploaded Applied' : 'Applied';
  console.log(`Found ${candidates.length} ${label} candidates before April 2026`);

  if (candidates.length === 0) {
    console.log('Nothing to export.');
    process.exit(0);
  }

  const ids = candidates.map((c) => c.id);
  const notes = await query(
    `SELECT candidate_id, notes
     FROM candidate_notes_ratings
     WHERE candidate_id IN (${ids.map(() => '?').join(',')})
     ORDER BY created_at DESC`,
    ids
  );

  const notesMap = notes.reduce((acc, row) => {
    if (!acc[row.candidate_id]) acc[row.candidate_id] = [];
    if (row.notes) acc[row.candidate_id].push(row.notes);
    return acc;
  }, {});

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Applied Before Apr 2026');
  sheet.addRow([
    bulkOnly
      ? 'Bulk-uploaded candidates — Applied stage — applied date on or before 2026-03-31'
      : 'Applied stage only — applied date on or before 2026-03-31'
  ]);
  sheet.addRow([`Export Date: ${new Date().toLocaleString()}`]);
  sheet.addRow([`Total: ${candidates.length}`]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(EXPORT_HEADERS);
  headerRow.font = { bold: true };

  for (const c of candidates) {
    sheet.addRow([
      c.name || '',
      c.email || '',
      c.phone || '',
      c.position || '',
      c.stage || '',
      c.main_stage || '',
      c.experience || '',
      c.location || '',
      c.source || '',
      formatDate(c.applied_date),
      c.salary_expected || '',
      c.created_at ? new Date(c.created_at).toISOString() : '',
      (notesMap[c.id] || []).join(' | ')
    ]);
  }

  sheet.columns.forEach((col) => {
    col.width = 18;
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = bulkOnly
    ? `Applied_BulkUpload_Before_April_2026_${dateStamp}.xlsx`
    : `Applied_Before_April_2026_${dateStamp}.xlsx`;
  const filepath = join(OUTPUT_DIR, filename);
  const buffer = await workbook.xlsx.writeBuffer();
  await writeFile(filepath, buffer);

  console.log(`\n✅ Exported to: ${filepath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});

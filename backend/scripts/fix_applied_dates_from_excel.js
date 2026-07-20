#!/usr/bin/env node
/**
 * Re-sync applied_date on bulk-uploaded candidates from an Excel tracker (Book1-style).
 * Usage: node backend/scripts/fix_applied_dates_from_excel.js [path/to/file.xlsx]
 */

import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import {
  parseAppliedDateIST,
  excelMMDDToIntendedYMD,
  isExcelUSDateFormat,
  toISTYMD,
} from '../utils/istDate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultXlsx = path.resolve(__dirname, '../../Book1.xlsx');
const xlsxPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultXlsx;

function normalizeName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseExcelDateCell(cell) {
  const raw = cell.value;
  if (raw instanceof Date) {
    if (isExcelUSDateFormat(cell.numFmt)) {
      return excelMMDDToIntendedYMD(raw);
    }
    return toISTYMD(raw);
  }
  return parseAppliedDateIST(raw != null ? String(raw).trim() : null);
}

async function loadDatesFromExcel(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  const headerRow = ws.getRow(1);
  const headers = [];
  headerRow.eachCell((cell, col) => {
    headers[col - 1] = String(cell.value || '').trim();
  });

  const dateCol = headers.findIndex(h => /^date$/i.test(h));
  const nameCol = headers.findIndex(h => /candidate\s*name|^name$/i.test(h));
  if (dateCol < 0 || nameCol < 0) {
    throw new Error(`Could not find Date / Candidate Name columns in ${filePath}`);
  }

  const byName = new Map();
  ws.eachRow((row, rn) => {
    if (rn === 1) return;
    const name = normalizeName(row.getCell(nameCol + 1).value);
    const applied = parseExcelDateCell(row.getCell(dateCol + 1));
    if (!name || !applied) return;
    byName.set(name, applied);
  });

  return byName;
}

async function main() {
  console.log(`Reading dates from ${xlsxPath}`);
  const excelDates = await loadDatesFromExcel(xlsxPath);
  console.log(`Loaded ${excelDates.size} candidate dates from Excel`);

  const [candidates] = await pool.query(
    `SELECT id, name, applied_date FROM candidates WHERE uploaded_by IS NOT NULL`
  );

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const row of candidates) {
    const key = normalizeName(row.name);
    const expected = excelDates.get(key);
    if (!expected) {
      unmatched++;
      continue;
    }

    const current = toISTYMD(row.applied_date);
    if (current === expected) {
      skipped++;
      continue;
    }

    await pool.query('UPDATE candidates SET applied_date = ?, updated_at = NOW() WHERE id = ?', [
      expected,
      row.id,
    ]);
    updated++;
    console.log(`  ${row.name}: ${current || '(null)'} -> ${expected}`);
  }

  console.log(`Done. Updated ${updated}, already correct ${skipped}, no Excel match ${unmatched}`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

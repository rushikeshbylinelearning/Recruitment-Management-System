import { query } from '../config/database.js';
import { normalizeStageForDb } from '../utils/candidateStage.js';

const rows = await query(
  `SELECT id, stage FROM candidates WHERE stage IS NULL OR TRIM(stage) = '' OR stage NOT IN (
    'Applied','Follow Up','Screening','Interview','Offer','Hired','On Hold','Rejected',
    'No Show - Interview','No Show - Onboarding','Last Minute Back Out','Profile Not Matched','Selected'
  )`
);

let fixed = 0;
for (const row of rows) {
  const next = normalizeStageForDb(row.stage);
  await query('UPDATE candidates SET stage = ? WHERE id = ?', [next, row.id]);
  fixed += 1;
}

console.log(`Fixed ${fixed} candidate stage(s).`);
process.exit(0);

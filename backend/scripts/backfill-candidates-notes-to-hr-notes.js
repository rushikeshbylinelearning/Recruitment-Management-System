/**
 * One-time backfill: candidates.notes → hr_notes for rows missing hr_notes.
 * Also repairs empty/invalid interaction_type values.
 *
 * Usage: node scripts/backfill-candidates-notes-to-hr-notes.js
 */
import { testConnection } from '../config/database.js';
import {
  backfillOrphanCandidateNotes,
  backfillFromCandidateNotesRatings,
  repairEmptyInteractionTypes,
} from '../services/hrNotesSyncService.js';

async function main() {
  if (!(await testConnection())) {
    process.exit(1);
  }

  console.log('Repairing invalid interaction_type values...');
  const repaired = await repairEmptyInteractionTypes();
  console.log(`  Updated ${repaired} hr_notes row(s)\n`);

  console.log('Backfilling orphan candidates.notes into hr_notes...');
  const result = await backfillOrphanCandidateNotes();
  console.log(`  Scanned: ${result.scanned}`);
  console.log(`  Inserted: ${result.inserted}`);
  console.log(`  Failed: ${result.failed}\n`);

  console.log('Backfilling candidate_notes_ratings into hr_notes...');
  const cnrResult = await backfillFromCandidateNotesRatings();
  console.log(`  Scanned: ${cnrResult.scanned}`);
  console.log(`  Inserted: ${cnrResult.inserted}`);
  console.log(`  Failed: ${cnrResult.failed}\n`);

  console.log('Done.');
  process.exit(result.failed + cnrResult.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

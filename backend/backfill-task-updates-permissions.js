/**
 * One-time backfill: adds `task-updates` permission (view + create)
 * to all existing Recruiter and HR Intern users who don't already have it.
 *
 * Safe to re-run — skips users who already have the permission.
 * Run with: node backfill-task-updates-permissions.js
 */
import { query } from './config/database.js';

const MODULE  = 'task-updates';
const ACTIONS = JSON.stringify(['view', 'create']);
const ROLES   = ['Recruiter', 'HR Intern'];

console.log('🔄  Backfilling task-updates permissions…\n');

// Find all Recruiter and HR Intern users
const users = await query(
  `SELECT id, name, role FROM users WHERE role IN (${ROLES.map(() => '?').join(',')}) AND status = 'Active'`,
  ROLES
);

console.log(`Found ${users.length} user(s) to check.\n`);

let added = 0;
let skipped = 0;

for (const user of users) {
  // Check if they already have the module
  const existing = await query(
    'SELECT id FROM permissions WHERE user_id = ? AND module = ?',
    [user.id, MODULE]
  );

  if (existing.length > 0) {
    console.log(`  ⏭  Skipped  [${user.role}] ${user.name} — already has ${MODULE}`);
    skipped++;
  } else {
    await query(
      'INSERT INTO permissions (user_id, module, actions) VALUES (?, ?, ?)',
      [user.id, MODULE, ACTIONS]
    );
    console.log(`  ✅  Added   [${user.role}] ${user.name} → ${MODULE}: ${ACTIONS}`);
    added++;
  }
}

console.log(`\nDone. Added: ${added}  |  Skipped (already had it): ${skipped}`);
process.exit(0);

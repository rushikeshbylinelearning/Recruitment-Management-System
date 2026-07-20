import { query } from '../config/database.js';

async function main() {
  try {
    await query(`
      ALTER TABLE planner_tasks
        ADD COLUMN recurrence_type ENUM('none','daily') NOT NULL DEFAULT 'none' AFTER estimated_time,
        ADD COLUMN last_completed_at DATETIME NULL AFTER recurrence_type,
        ADD COLUMN due_time TIME NULL AFTER last_completed_at,
        ADD COLUMN timer_elapsed_seconds INT UNSIGNED NOT NULL DEFAULT 0 AFTER due_time,
        ADD COLUMN timer_started_at DATETIME NULL AFTER timer_elapsed_seconds,
        ADD INDEX idx_daily_reset (recurrence_type, status, last_completed_at)
    `);
    console.log('Migration applied');
  } catch (e) {
    if (String(e.message).includes('Duplicate column')) {
      console.log('Columns already exist — skipping ALTER');
    } else {
      console.error('Migration error:', e.message);
      process.exitCode = 1;
      return;
    }
  }

  const cols = await query(
    `SHOW COLUMNS FROM planner_tasks WHERE Field IN (
      'recurrence_type','last_completed_at','due_time','timer_elapsed_seconds','timer_started_at'
    )`
  );
  console.log('Columns:', cols.map((c) => c.Field).join(', '));
  process.exit(process.exitCode || 0);
}

main();

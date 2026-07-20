/**
 * Planner cron jobs — daily recurrence reset at ~00:05 local server time.
 */

import cron from 'node-cron';
import { resetStaleDailyTasks } from './plannerService.js';

/**
 * Start midnight-ish job that resets completed daily planner tasks for the new day.
 */
export function startPlannerDailyResetCron() {
  // 00:05 every day — gives a small buffer after midnight
  cron.schedule('5 0 * * *', async () => {
    try {
      const count = await resetStaleDailyTasks();
      if (count > 0) {
        console.log(`[PlannerCron] Reset ${count} daily task(s)`);
      }
    } catch (err) {
      console.error('[PlannerCron] Daily reset error:', err);
    }
  });

  console.log('🗓️  Planner daily reset cron started (runs at 00:05)');
}

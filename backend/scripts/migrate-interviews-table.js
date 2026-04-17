/**
 * Migrates the interviews table from the old schema (scheduled_date, round)
 * to the new schema (date, time, job_role, mode, notes) expected by interviews.js
 */
import pool, { query } from '../config/database.js';

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('Starting interviews table migration...');

    // 1. Add new columns (ignore errors if they already exist)
    const alterations = [
      "ALTER TABLE interviews ADD COLUMN date DATE NULL AFTER interviewer_id",
      "ALTER TABLE interviews ADD COLUMN time TIME NULL AFTER date",
      "ALTER TABLE interviews ADD COLUMN job_role VARCHAR(255) NULL AFTER time",
      "ALTER TABLE interviews ADD COLUMN mode ENUM('Virtual','In-Person') NULL AFTER job_role",
      "ALTER TABLE interviews ADD COLUMN notes TEXT NULL AFTER mode",
    ];

    for (const sql of alterations) {
      try {
        await conn.execute(sql);
        console.log('✅', sql.substring(0, 60));
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
          console.log('⏭️  Column already exists, skipping:', sql.substring(0, 60));
        } else {
          throw e;
        }
      }
    }

    // 2. Backfill date/time from scheduled_date
    await conn.execute(`
      UPDATE interviews
      SET date = DATE(scheduled_date),
          time = TIME(scheduled_date)
      WHERE date IS NULL AND scheduled_date IS NOT NULL
    `);
    console.log('✅ Backfilled date/time from scheduled_date');

    // 3. Make date and time NOT NULL now that they're populated
    await conn.execute(`ALTER TABLE interviews MODIFY COLUMN date DATE NOT NULL`);
    await conn.execute(`ALTER TABLE interviews MODIFY COLUMN time TIME NOT NULL`);
    console.log('✅ Set date and time to NOT NULL');

    // 4. Update type enum to include all values the app uses
    try {
      await conn.execute(`
        ALTER TABLE interviews MODIFY COLUMN type 
        ENUM('Technical','HR','Managerial','Final','HR Round') NOT NULL
      `);
      console.log('✅ Updated type enum');
    } catch (e) {
      console.warn('⚠️  Could not update type enum:', e.message);
    }

    // 5. Update status enum to include 'In Progress'
    try {
      await conn.execute(`
        ALTER TABLE interviews MODIFY COLUMN status 
        ENUM('Scheduled','In Progress','Completed','Cancelled','Rescheduled') 
        NOT NULL DEFAULT 'Scheduled'
      `);
      console.log('✅ Updated status enum');
    } catch (e) {
      console.warn('⚠️  Could not update status enum:', e.message);
    }

    // 6. Create push_subscriptions table if missing
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         INT  NOT NULL AUTO_INCREMENT,
        user_id    INT  NOT NULL,
        endpoint   TEXT NOT NULL,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_user_id (user_id),
        CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ push_subscriptions table ready');

    console.log('\n🎉 Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();

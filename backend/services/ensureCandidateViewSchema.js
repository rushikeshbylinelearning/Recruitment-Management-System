import { query } from '../config/database.js';

let schemaReady = false;
let schemaSetupPromise = null;

async function columnExists(tableName, columnName) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

async function indexExists(tableName, indexName) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

async function foreignKeyExists(tableName, constraintName) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [tableName, constraintName]
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

async function runAlter(sql) {
  try {
    await query(sql);
  } catch (error) {
    if (
      error.code === 'ER_DUP_FIELDNAME' ||
      error.code === 'ER_DUP_KEYNAME' ||
      error.code === 'ER_CANT_CREATE_TABLE' ||
      (error.sqlMessage && /Duplicate column|Duplicate key|already exists/i.test(error.sqlMessage))
    ) {
      return;
    }
    throw error;
  }
}

async function setupCandidateViewSchema() {
  const hadViewColumn = await columnExists('candidates', 'card_viewed_at');

  if (!hadViewColumn) {
    await runAlter(
      `ALTER TABLE candidates
         ADD COLUMN card_viewed_at TIMESTAMP NULL DEFAULT NULL,
         ADD COLUMN last_viewed_by INT NULL DEFAULT NULL,
         ADD COLUMN last_viewed_at TIMESTAMP NULL DEFAULT NULL`
    );
  } else {
    if (!(await columnExists('candidates', 'last_viewed_by'))) {
      await runAlter(`ALTER TABLE candidates ADD COLUMN last_viewed_by INT NULL DEFAULT NULL`);
    }
    if (!(await columnExists('candidates', 'last_viewed_at'))) {
      await runAlter(`ALTER TABLE candidates ADD COLUMN last_viewed_at TIMESTAMP NULL DEFAULT NULL`);
    }
  }

  if (!(await indexExists('candidates', 'idx_candidates_created_at'))) {
    await runAlter(`ALTER TABLE candidates ADD INDEX idx_candidates_created_at (created_at)`);
  }
  if (!(await indexExists('candidates', 'idx_candidates_card_viewed_at'))) {
    await runAlter(`ALTER TABLE candidates ADD INDEX idx_candidates_card_viewed_at (card_viewed_at)`);
  }

  if (!(await foreignKeyExists('candidates', 'fk_candidates_last_viewed_by'))) {
    await runAlter(
      `ALTER TABLE candidates
         ADD CONSTRAINT fk_candidates_last_viewed_by
         FOREIGN KEY (last_viewed_by) REFERENCES users(id) ON DELETE SET NULL`
    );
  }

  if (!hadViewColumn) {
    await query(
      `UPDATE candidates
       SET card_viewed_at = COALESCE(created_at, NOW())
       WHERE card_viewed_at IS NULL`
    );
  }

  const hadRequiresColumn = await columnExists('candidates', 'requires_card_view');
  if (!hadRequiresColumn) {
    await runAlter(
      `ALTER TABLE candidates
         ADD COLUMN requires_card_view TINYINT(1) NOT NULL DEFAULT 0
         COMMENT '1 = form-link applicant; track New/viewed on Applied card'`
    );
    // Every row already in the DB is treated as viewed; only future form inserts opt in.
    await query(
      `UPDATE candidates
       SET requires_card_view = 0,
           card_viewed_at = COALESCE(card_viewed_at, created_at, NOW())
       WHERE requires_card_view = 0`
    );
  }
}

export async function ensureCandidateViewSchema() {
  if (schemaReady) return;
  if (!schemaSetupPromise) {
    schemaSetupPromise = setupCandidateViewSchema()
      .then(() => {
        schemaReady = true;
      })
      .catch((err) => {
        schemaSetupPromise = null;
        throw err;
      });
  }
  await schemaSetupPromise;
}

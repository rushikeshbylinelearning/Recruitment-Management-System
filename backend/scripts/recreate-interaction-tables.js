import { query, testConnection, closePool } from '../config/database.js';

async function recreateInteractionTables() {
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database.');
    process.exit(1);
  }

  console.log('🔧 Recreating interaction tables...\n');

  // Step 1: Drop corrupted tables
  const tables = ['interaction_pipeline', 'interaction_notes', 'interaction_candidates'];
  
  for (const table of tables) {
    try {
      await query(`DROP TABLE IF EXISTS ${table}`);
      console.log(`✅ Dropped: ${table}`);
    } catch (err) {
      console.log(`⚠️  Could not drop ${table}: ${err.message}`);
    }
  }

  console.log('\n📝 Creating tables...\n');

  // Step 2: Create interaction_candidates (no foreign keys)
  try {
    await query(`
      CREATE TABLE interaction_candidates (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        name          VARCHAR(255) NOT NULL,
        phone         VARCHAR(30)  NOT NULL UNIQUE,
        email         VARCHAR(255) NULL,
        source        ENUM('Indeed','Naukri','Monster','Manual','Referral') DEFAULT 'Manual',
        created_by    INT          NOT NULL,
        created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_phone (phone),
        INDEX idx_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ interaction_candidates created');
  } catch (err) {
    console.error('❌ interaction_candidates failed:', err.message);
  }

  // Step 3: Create interaction_notes
  try {
    await query(`
      CREATE TABLE interaction_notes (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        candidate_id    INT          NOT NULL,
        note            TEXT         NOT NULL,
        status          ENUM('Not Interested','Interested','Follow-up','No Response','Wrong Number') DEFAULT 'No Response',
        priority        TINYINT      DEFAULT 3 COMMENT '1-5 stars',
        follow_up_date  DATE         NULL,
        created_by      INT          NOT NULL,
        created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_candidate (candidate_id),
        INDEX idx_created_by (created_by),
        INDEX idx_follow_up (follow_up_date),
        FOREIGN KEY (candidate_id) REFERENCES interaction_candidates(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ interaction_notes created');
  } catch (err) {
    console.error('❌ interaction_notes failed:', err.message);
  }

  // Step 4: Create interaction_pipeline
  try {
    await query(`
      CREATE TABLE interaction_pipeline (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        candidate_id INT         NOT NULL UNIQUE,
        stage        ENUM('Contacted','Interested','Applied','Interview','Selected','Rejected') DEFAULT 'Contacted',
        updated_by   INT         NOT NULL,
        updated_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_stage (stage),
        FOREIGN KEY (candidate_id) REFERENCES interaction_candidates(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ interaction_pipeline created');
  } catch (err) {
    console.error('❌ interaction_pipeline failed:', err.message);
  }

  // Step 5: Verify
  console.log('\n✅ Verifying tables...\n');
  
  for (const table of ['interaction_candidates', 'interaction_notes', 'interaction_pipeline']) {
    try {
      const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`✅ ${table}: Working (${result[0].count} rows)`);
    } catch (err) {
      console.error(`❌ ${table}: ${err.message}`);
    }
  }

  await closePool();
  process.exit(0);
}

recreateInteractionTables();

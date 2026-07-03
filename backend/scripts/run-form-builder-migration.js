/**
 * Creates form-builder tables on hosted DBs where migrations were never run.
 * Safe to run multiple times.
 *
 * Usage: node backend/scripts/run-form-builder-migration.js
 */
import { testConnection, closePool } from '../config/database.js';
import { ensureFormBuilderSchema } from '../services/ensureFormBuilderSchema.js';

async function run() {
  const connected = await testConnection();
  if (!connected) {
    console.error('Cannot connect to database.');
    process.exit(1);
  }

  try {
    await ensureFormBuilderSchema();
    console.log('Form builder schema is ready.');
  } catch (error) {
    console.error('Form builder migration failed:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

run();

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sql = readFileSync(
  join(__dirname, '../migrations/create_interaction_memory_system.sql'),
  'utf8'
);

// Split on semicolons, skip empty statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 10 && /CREATE\s+TABLE/i.test(s));

(async () => {
  console.log('Running Interaction Memory System migration...');
  for (const stmt of statements) {
    try {
      await query(stmt);
      const match = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (match) console.log(`  ✅ ${match[1]}`);
    } catch (err) {
      console.error('  ❌ Error:', err.message);
      console.error('  Statement:', stmt.slice(0, 80));
    }
  }
  console.log('Migration complete.');
  process.exit(0);
})();

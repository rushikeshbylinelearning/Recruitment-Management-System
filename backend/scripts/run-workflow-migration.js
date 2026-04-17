import { query } from '../config/database.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sql = readFileSync(join(__dirname, '../migrations/create_workflow_engine.sql'), 'utf8');

// Strip comment lines, split on semicolons, filter empty statements
const stripped = sql.replace(/--[^\n]*/g, '');
const statements = stripped
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`Running ${statements.length} SQL statements...`);

for (const stmt of statements) {
  try {
    await query(stmt);
    const match = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (match) console.log(`✅ Table created/verified: ${match[1]}`);
  } catch (e) {
    console.error(`❌ Error: ${e.message}\nStatement: ${stmt.substring(0, 80)}...`);
  }
}

console.log('\n✅ Workflow migration complete!');
process.exit(0);

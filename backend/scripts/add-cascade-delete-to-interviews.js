import pool, { query } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function addCascadeDelete() {
  try {
    console.log('Adding CASCADE DELETE to interviews table...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/add_cascade_delete_to_interviews.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 100) + '...');
      await query(statement);
    }
    
    console.log('\n✅ CASCADE DELETE constraints added successfully!');
    console.log('Now when you delete a candidate or interviewer, their interviews will be automatically deleted.\n');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

addCascadeDelete();

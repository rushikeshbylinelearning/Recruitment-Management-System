import { query } from './config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration: Add task create permission to all HR Intern users
 * This ensures HR Interns can create tasks for themselves and others.
 */

async function addHRInternTaskPermissions() {
  console.log('🔧 Adding task create permissions for HR Interns...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_task_create_permission_to_hr_interns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons to execute each statement separately
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      // Skip comment-only lines
      if (statement.startsWith('--')) continue;
      
      console.log('📝 Executing SQL statement...');
      await query(statement);
    }

    // Verify results
    console.log('\n✅ Migration complete. Verifying...\n');
    
    const hrInterns = await query(`
      SELECT u.id, u.name, u.role, p.module, p.actions
      FROM users u
      LEFT JOIN permissions p ON u.id = p.user_id AND p.module = 'tasks'
      WHERE u.role = 'HR Intern' AND u.status = 'Active'
      ORDER BY u.name
    `);

    if (hrInterns.length === 0) {
      console.log('⚠️  No active HR Intern users found.\n');
      process.exit(0);
    }

    console.log('HR Intern Task Permissions:');
    console.log('═══════════════════════════════════════════════════════════');
    
    hrInterns.forEach(intern => {
      const actions = intern.actions ? JSON.parse(intern.actions) : [];
      const hasCreate = actions.includes('create');
      const status = hasCreate ? '✅' : '❌';
      
      console.log(`${status} ${intern.name} (ID: ${intern.id})`);
      console.log(`   Actions: ${actions.join(', ') || 'NONE'}`);
    });

    console.log('═══════════════════════════════════════════════════════════\n');
    
    const allHaveCreate = hrInterns.every(intern => {
      const actions = intern.actions ? JSON.parse(intern.actions) : [];
      return actions.includes('create');
    });

    if (allHaveCreate) {
      console.log('✅ SUCCESS: All HR Interns now have task create permissions!\n');
    } else {
      console.log('⚠️  WARNING: Some HR Interns are missing task create permissions.\n');
      process.exit(1);
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
addHRInternTaskPermissions();

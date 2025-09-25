import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, testConnection } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...');
    
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to database. Please check your configuration.');
      process.exit(1);
    }

    // Drop existing tables if they exist (for clean migration to integer IDs)
    console.log('🗑️  Dropping existing tables...');
    const dropTables = [
      'DROP TABLE IF EXISTS skill_ratings',
      'DROP TABLE IF EXISTS post_interview_feedback', 
      'DROP TABLE IF EXISTS pre_interview_feedback',
      'DROP TABLE IF EXISTS interview_feedback',
      'DROP TABLE IF EXISTS interviews',
      'DROP TABLE IF EXISTS communications',
      'DROP TABLE IF EXISTS tasks',
      'DROP TABLE IF EXISTS candidates',
      'DROP TABLE IF EXISTS job_portals',
      'DROP TABLE IF EXISTS job_postings',
      'DROP TABLE IF EXISTS email_templates',
      'DROP TABLE IF EXISTS system_settings',
      'DROP TABLE IF EXISTS permissions',
      'DROP TABLE IF EXISTS interviewer_profiles',
      'DROP TABLE IF EXISTS users'
    ];

    for (const dropQuery of dropTables) {
      try {
        await query(dropQuery);
      } catch (error) {
        // Ignore errors for tables that don't exist
      }
    }

    // Read SQL schema file
    const schemaPath = path.join(__dirname, '../../database_schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Schema file not found:', schemaPath);
      process.exit(1);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await query(statement);
        console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
      } catch (error) {
        // Skip errors for statements that might already exist
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_KEYNAME') {
          console.log(`⚠️  Skipped statement ${i + 1}/${statements.length} (already exists)`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}/${statements.length}:`, error.message);
          throw error;
        }
      }
    }

    console.log('🎉 Database migration completed successfully!');
    console.log('📊 Database is ready for use.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export default runMigration;

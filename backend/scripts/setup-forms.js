import { query } from '../config/database.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupForms() {
  try {
    console.log('🚀 Setting up Custom Candidate Intake Forms...\n');

    // Read and execute migration file
    const migrationPath = path.join(__dirname, '../migrations/create_intake_forms.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await query(statement);
        console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
      } catch (error) {
        // Ignore "table already exists" errors
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.message.includes('already exists')) {
          console.log(`⚠️  Statement ${i + 1}/${statements.length} skipped (already exists)`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
        }
      }
    }

    console.log('\n✅ Form system setup completed!\n');
    console.log('📋 Summary:');
    console.log('   - Tables created: forms, form_fields, form_submissions, form_field_mappings, form_analytics');
    console.log('   - Default form created: "Default Candidate Application Form"');
    console.log('   - Default fields added: name, email, phone, position, etc.');
    console.log('\n🎯 Next steps:');
    console.log('   1. Navigate to /form-builder in your app');
    console.log('   2. View and customize the default form');
    console.log('   3. Copy the form link and share it');
    console.log('   4. Test the public form submission');
    console.log('\n🔗 Access the form builder at: http://localhost:3000/form-builder\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupForms();

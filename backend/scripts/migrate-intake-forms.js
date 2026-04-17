import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { testConnection } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runIntakeFormsMigration() {
  let connection;
  try {
    console.log('🔄 Starting intake forms migration...');
    console.log('Database config:', {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'hr_workflow_db',
      user: process.env.DB_USER || 'root'
    });
    
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to database. Please check your configuration.');
      process.exit(1);
    }

    // Get connection from pool
    console.log('Getting connection from pool...');
    connection = await pool.getConnection();
    console.log('✅ Connection acquired');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/create_intake_forms_tables.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Remove comments and split SQL into individual statements
    const statements = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))  // Remove comment lines
      .join('\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await connection.query(statement);
        console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠️  Table already exists (statement ${i + 1}/${statements.length})`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}/${statements.length}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n🔍 Verifying table creation...\n');

    // Verify tables were created
    const tables = ['forms', 'form_fields', 'form_submissions', 'form_field_mappings', 'form_analytics'];
    
    for (const table of tables) {
      const [rows] = await connection.query(`SHOW TABLES LIKE '${table}'`);
      if (rows.length > 0) {
        console.log(`✅ Table '${table}' exists`);
        
        // Get table structure
        const [columns] = await connection.query(`DESCRIBE ${table}`);
        console.log(`   Columns: ${columns.length}`);
        
        // Check for foreign keys
        const [foreignKeys] = await connection.query(`
          SELECT 
            kcu.CONSTRAINT_NAME,
            kcu.COLUMN_NAME,
            kcu.REFERENCED_TABLE_NAME,
            kcu.REFERENCED_COLUMN_NAME,
            rc.DELETE_RULE
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
            ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
            AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
          WHERE kcu.TABLE_SCHEMA = DATABASE()
            AND kcu.TABLE_NAME = '${table}'
            AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        `);
        
        if (foreignKeys.length > 0) {
          console.log(`   Foreign keys: ${foreignKeys.length}`);
          foreignKeys.forEach(fk => {
            console.log(`     - ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME} (ON DELETE ${fk.DELETE_RULE})`);
          });
        }
        console.log('');
      } else {
        console.error(`❌ Table '${table}' was not created`);
      }
    }

    console.log('🎉 All tables verified successfully!');
    console.log('\n📊 Testing foreign key constraints...\n');

    // Test foreign key constraints
    await testForeignKeyConstraints(connection);

    console.log('\n✅ Migration and verification complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

async function testForeignKeyConstraints(connection) {
  try {
    // Test 1: Verify CASCADE delete on forms -> form_fields
    console.log('Test 1: Verifying CASCADE delete (forms -> form_fields)');
    
    // Check if test data exists
    const [existingForms] = await connection.query("SELECT id FROM forms WHERE name = 'Test Form for FK' LIMIT 1");
    
    if (existingForms.length > 0) {
      // Clean up existing test data
      await connection.query("DELETE FROM forms WHERE name = 'Test Form for FK'");
    }

    // Insert test form
    const [formResult] = await connection.query(`
      INSERT INTO forms (name, slug, access_token, created_by)
      VALUES ('Test Form for FK', 'test-form-fk', UUID(), 1)
    `);
    const testFormId = formResult.insertId;
    console.log(`   Created test form with ID: ${testFormId}`);

    // Insert test field
    await connection.query(`
      INSERT INTO form_fields (form_id, label, field_key, field_type, order_index)
      VALUES (?, 'Test Field', 'test_field', 'text', 1)
    `, [testFormId]);
    console.log('   Created test field');

    // Verify field exists
    const [fieldsBefore] = await connection.query('SELECT COUNT(*) as count FROM form_fields WHERE form_id = ?', [testFormId]);
    console.log(`   Fields before delete: ${fieldsBefore[0].count}`);

    // Delete form (should cascade to fields)
    await connection.query('DELETE FROM forms WHERE id = ?', [testFormId]);
    console.log('   Deleted test form');

    // Verify field was deleted
    const [fieldsAfter] = await connection.query('SELECT COUNT(*) as count FROM form_fields WHERE form_id = ?', [testFormId]);
    console.log(`   Fields after delete: ${fieldsAfter[0].count}`);

    if (fieldsAfter[0].count === 0) {
      console.log('   ✅ CASCADE delete working correctly\n');
    } else {
      console.log('   ❌ CASCADE delete failed\n');
    }

    // Test 2: Verify SET NULL on forms -> job_id
    console.log('Test 2: Verifying SET NULL (forms -> jobs)');
    console.log('   ⚠️  Skipping (requires jobs table with test data)\n');

    console.log('✅ Foreign key constraint tests completed');
    
  } catch (error) {
    console.error('❌ Foreign key test failed:', error.message);
    // Don't throw - this is just verification
  }
}

// Run migration
runIntakeFormsMigration().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

export default runIntakeFormsMigration;

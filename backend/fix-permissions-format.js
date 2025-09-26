import { query, testConnection } from './config/database.js';

async function fixPermissionsFormat() {
  try {
    console.log('🔧 Fixing permissions data format...');
    
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Database connection failed');
      return;
    }
    
    // Get all permissions that might be in string format
    const permissions = await query('SELECT id, user_id, module, actions FROM permissions');
    console.log(`Found ${permissions.length} permission records`);
    
    let fixedCount = 0;
    
    for (const permission of permissions) {
      let actions = permission.actions;
      
      // Check if actions is a string that needs to be converted to JSON
      if (typeof actions === 'string' && !actions.startsWith('[')) {
        // Convert comma-separated string to JSON array
        const actionsArray = actions.split(',').map(action => action.trim());
        const jsonActions = JSON.stringify(actionsArray);
        
        // Update the record
        await query(
          'UPDATE permissions SET actions = ? WHERE id = ?',
          [jsonActions, permission.id]
        );
        
        console.log(`✅ Fixed permissions for user ${permission.user_id}, module ${permission.module}: ${actions} → ${jsonActions}`);
        fixedCount++;
      }
    }
    
    console.log(`🎉 Fixed ${fixedCount} permission records!`);
    
    // Verify the fix
    const recruiter = await query('SELECT id, username, name FROM users WHERE role = "Recruiter" LIMIT 1');
    if (recruiter.length > 0) {
      const recruiterId = recruiter[0].id;
      const jobsPermissions = await query(
        'SELECT actions FROM permissions WHERE user_id = ? AND module = "jobs"',
        [recruiterId]
      );
      
      if (jobsPermissions.length > 0) {
        const actions = JSON.parse(jobsPermissions[0].actions);
        console.log(`✅ Recruiter jobs permissions: ${actions.join(', ')}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixPermissionsFormat();


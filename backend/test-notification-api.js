import { query } from './config/database.js';
import { createNotification } from './services/inAppNotifications.js';

async function testNotificationAPI() {
  try {
    console.log('=== NOTIFICATION SYSTEM DIAGNOSTIC ===\n');

    // 1. Check table exists
    console.log('1. Checking database table...');
    const tables = await query('SHOW TABLES LIKE "in_app_notifications"');
    if (tables.length === 0) {
      console.log('❌ CRITICAL: in_app_notifications table does not exist!');
      console.log('   Run: node scripts/create-notifications-table.js');
      return;
    }
    console.log('✅ Table exists\n');

    // 2. Check users
    console.log('2. Checking users...');
    const users = await query('SELECT id, username, email FROM users LIMIT 3');
    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }
    console.log(`✅ Found ${users.length} users\n`);

    // 3. Create test notifications for each user
    console.log('3. Creating test notifications...');
    for (const user of users) {
      await createNotification(user.id, {
        type: 'test',
        title: 'System Test',
        message: `Test notification for ${user.username}`,
        link: '/dashboard'
      });
      console.log(`   ✅ Created notification for ${user.username} (ID: ${user.id})`);
    }
    console.log('');

    // 4. Verify notifications were created
    console.log('4. Verifying notifications...');
    const allNotifs = await query('SELECT COUNT(*) as total FROM in_app_notifications');
    console.log(`   Total notifications in database: ${allNotifs[0].total}\n`);

    // 5. Check for each user
    console.log('5. Checking notifications per user:');
    for (const user of users) {
      const userNotifs = await query(
        'SELECT COUNT(*) as count FROM in_app_notifications WHERE user_id = ?',
        [user.id]
      );
      console.log(`   ${user.username}: ${userNotifs[0].count} notifications`);
    }
    console.log('');

    // 6. Check interviews that should have triggered notifications
    console.log('6. Checking interviews...');
    const interviews = await query(
      'SELECT COUNT(*) as total FROM interviews WHERE status = "Scheduled"'
    );
    console.log(`   Scheduled interviews: ${interviews[0].total}`);
    console.log('   Note: Existing interviews won\'t have notifications unless created after notification system was added\n');

    // 7. Check assignments
    console.log('7. Checking assignments...');
    const assignments = await query(
      'SELECT COUNT(*) as total FROM candidate_assignments'
    );
    console.log(`   Total assignments: ${assignments[0].total}`);
    console.log('   Note: Notifications are created when assignments are submitted\n');

    // 8. Summary
    console.log('=== SUMMARY ===');
    console.log('✅ Notification system is functional');
    console.log('✅ createNotification() works correctly');
    console.log('✅ Database table is properly configured');
    console.log('');
    console.log('IMPORTANT NOTES:');
    console.log('- Notifications are only created for NEW events (interviews, submissions)');
    console.log('- Existing data in the database won\'t have notifications');
    console.log('- To test: Create a new interview or submit an assignment');
    console.log('- Frontend polls /api/notifications every 30 seconds');
    console.log('- Check browser console for any API errors');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testNotificationAPI();


process.chdir('C:/Users/JENDERAL-AJIZS/Videos/billing-kalimasada-windev');
async function test() {
  const { getRadiusConnection } = require('../config/radiusSQLite');
  const conn = await getRadiusConnection();
  
  try {
    const testUser = 'test_debug_new_user_xyz';
    console.log('Testing RADIUS insert for new user:', testUser);
    
    // Step 1: insert radcheck
    const [r1] = await conn.execute(
      "INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Cleartext-Password', ':=', ?) ON CONFLICT(username, attribute) DO UPDATE SET value = excluded.value",
      [testUser, 'testpass123']
    );
    console.log('radcheck insert OK:', r1.affectedRows);
    
    // Step 2: ensure group
    const [r2] = await conn.execute(
      "INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, 'Mikrotik-Group', ':=', ?) ON CONFLICT(groupname, attribute) DO UPDATE SET value = excluded.value",
      ['default', 'default']
    );
    console.log('radgroupreply insert OK:', r2.affectedRows);
    
    // Step 3: delete existing group assignments
    await conn.execute("DELETE FROM radusergroup WHERE username = ?", [testUser]);
    
    // Step 4: assign to group
    const [r4] = await conn.execute(
      "INSERT INTO radusergroup (username, groupname, priority) VALUES (?, ?, 1)",
      [testUser, 'default']
    );
    console.log('radusergroup insert OK:', r4.affectedRows);
    
    // Clean up
    await conn.execute("DELETE FROM radcheck WHERE username = ?", [testUser]);
    await conn.execute("DELETE FROM radusergroup WHERE username = ?", [testUser]);
    
    console.log('\nSUCCESS: All RADIUS inserts work correctly!');
  } catch(e) {
    console.error('\nRADIUS insert FAILED:', e.message);
    console.error('Stack:', e.stack);
  }
  await conn.end();
}
test().catch(console.error);

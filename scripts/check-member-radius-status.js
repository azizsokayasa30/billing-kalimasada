#!/usr/bin/env node

/**
 * Script untuk mengecek status member di RADIUS database
 * Usage: node scripts/check-member-radius-status.js <username>
 */

const { getRadiusConnection } = require('../config/mikrotik');
const logger = require('../config/logger');

async function checkMemberRadiusStatus(username) {
    if (!username) {
        console.error('Usage: node scripts/check-member-radius-status.js <username>');
        process.exit(1);
    }

    try {
        const conn = await getRadiusConnection();
        
        console.log(`\n🔍 Checking RADIUS status for user: ${username}\n`);
        
        // Cek radcheck
        const [radcheckRows] = await conn.execute(
            "SELECT username, attribute, op, value FROM radcheck WHERE username = ? ORDER BY id",
            [username]
        );
        
        console.log('📋 radcheck entries:');
        if (radcheckRows && radcheckRows.length > 0) {
            radcheckRows.forEach(row => {
                console.log(`   - ${row.attribute} ${row.op} ${row.value}`);
            });
        } else {
            console.log('   (no entries found)');
        }
        
        // Cek radusergroup
        const [radusergroupRows] = await conn.execute(
            "SELECT username, groupname, priority FROM radusergroup WHERE username = ?",
            [username]
        );
        
        console.log('\n👥 radusergroup entries:');
        if (radusergroupRows && radusergroupRows.length > 0) {
            radusergroupRows.forEach(row => {
                console.log(`   - Group: ${row.groupname} (priority: ${row.priority})`);
            });
        } else {
            console.log('   (no entries found)');
        }
        
        // Cek radreply
        const [radreplyRows] = await conn.execute(
            "SELECT username, attribute, op, value FROM radreply WHERE username = ? ORDER BY id",
            [username]
        );
        
        console.log('\n📤 radreply entries:');
        if (radreplyRows && radreplyRows.length > 0) {
            radreplyRows.forEach(row => {
                console.log(`   - ${row.attribute} ${row.op} ${row.value}`);
            });
        } else {
            console.log('   (no entries found)');
        }
        
        // Cek apakah user di-disable
        const hasAuthTypeReject = radcheckRows && radcheckRows.some(row => 
            row.attribute === 'Auth-Type' && row.value === 'Reject'
        );
        
        console.log('\n🔒 Status:');
        if (hasAuthTypeReject) {
            console.log('   ❌ User is DISABLED (Auth-Type := Reject)');
        } else {
            console.log('   ✅ User is ENABLED (no Auth-Type := Reject)');
        }
        
        await conn.end();
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

const username = process.argv[2];
checkMemberRadiusStatus(username);

#!/usr/bin/env node

/**
 * Script untuk test disable member di RADIUS
 * Usage: node scripts/test-disable-member.js <username>
 */

const { disableHotspotUserRadius } = require('../config/mikrotik');
const logger = require('../config/logger');

async function testDisableMember(username) {
    if (!username) {
        console.error('Usage: node scripts/test-disable-member.js <username>');
        process.exit(1);
    }

    try {
        console.log(`\n🔒 Testing disable for user: ${username}\n`);
        
        const result = await disableHotspotUserRadius(username);
        
        if (result && result.success) {
            console.log(`✅ Success: ${result.message}`);
            console.log(`\n📋 Please verify with: node scripts/check-member-radius-status.js ${username}`);
            console.log(`📋 Then test with: radtest ${username} ${username} 127.0.0.1 0 testing123`);
        } else {
            console.error(`❌ Failed: ${result?.message || 'Unknown error'}`);
            process.exit(1);
        }
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

const username = process.argv[2];
testDisableMember(username);

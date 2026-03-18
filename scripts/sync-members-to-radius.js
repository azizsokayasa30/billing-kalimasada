#!/usr/bin/env node

/**
 * Script untuk sync member yang sudah ada di billing ke RADIUS
 * Usage: node scripts/sync-members-to-radius.js [username]
 * Jika tidak ada username, akan sync semua member yang belum ada di RADIUS
 */

const { getRadiusConnection, addHotspotUserRadius } = require('../config/mikrotik');
const billingManager = require('../config/billing');
const { getRadiusConfigValue } = require('../config/radiusConfig');

const targetUsername = process.argv[2] || null;

async function syncMembersToRadius() {
    try {
        console.log('\n🔄 Syncing Members to RADIUS...\n');
        console.log('='.repeat(60));
        
        // Check auth mode
        let userAuthMode = 'mikrotik';
        try {
            const mode = await getRadiusConfigValue('user_auth_mode', null);
            userAuthMode = mode !== null && mode !== undefined ? mode : 'mikrotik';
        } catch (e) {
            console.log('⚠️  Warning: Could not determine auth mode, assuming RADIUS');
            userAuthMode = 'radius';
        }
        
        if (userAuthMode !== 'radius') {
            console.log('❌ System is not in RADIUS mode. Exiting...');
            process.exit(1);
        }
        
        console.log('✅ System is in RADIUS mode\n');
        
        // Get members
        let members = [];
        if (targetUsername) {
            const member = await billingManager.getMemberByHotspotUsername(targetUsername);
            if (member) {
                members = [member];
            } else {
                console.log(`❌ Member dengan hotspot_username "${targetUsername}" tidak ditemukan`);
                process.exit(1);
            }
        } else {
            members = await billingManager.getAllMembers();
        }
        
        console.log(`📊 Found ${members.length} member(s) to check\n`);
        
        // Check which members need to be synced
        const conn = await getRadiusConnection();
        const membersToSync = [];
        
        for (const member of members) {
            const hotspotUsername = member.hotspot_username || member.username;
            if (!hotspotUsername) {
                console.log(`⚠️  Member ${member.name} (ID: ${member.id}) tidak memiliki hotspot_username, skip...`);
                continue;
            }
            
            // Check if user exists in RADIUS
            const [radcheck] = await conn.execute(
                'SELECT COUNT(*) as count FROM radcheck WHERE username = ? AND attribute = "Cleartext-Password"',
                [hotspotUsername]
            );
            
            if (radcheck[0].count === 0) {
                membersToSync.push(member);
                console.log(`   ⚠️  Member "${member.name}" (${hotspotUsername}) belum ada di RADIUS`);
            } else {
                console.log(`   ✅ Member "${member.name}" (${hotspotUsername}) sudah ada di RADIUS`);
            }
        }
        
        await conn.end();
        
        if (membersToSync.length === 0) {
            console.log('\n✅ Semua member sudah ada di RADIUS. Tidak ada yang perlu di-sync.\n');
            return;
        }
        
        console.log(`\n📋 Found ${membersToSync.length} member(s) yang perlu di-sync ke RADIUS:\n`);
        membersToSync.forEach((m, idx) => {
            console.log(`   ${idx + 1}. ${m.name} (${m.hotspot_username || m.username})`);
        });
        
        console.log('\n🔄 Starting sync...\n');
        console.log('='.repeat(60));
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const member of membersToSync) {
            try {
                const hotspotUsername = member.hotspot_username || member.username;
                const password = hotspotUsername; // Default password sama dengan username
                
                // Get package info
                let hotspotProfile = member.hotspot_profile || 'default';
                if (!hotspotProfile && member.package_id) {
                    const packageInfo = await billingManager.getMemberPackageById(member.package_id);
                    if (packageInfo && packageInfo.hotspot_profile) {
                        hotspotProfile = packageInfo.hotspot_profile;
                    }
                }
                
                const server = member.server_hotspot && member.server_hotspot.trim() !== '' 
                    ? member.server_hotspot.trim() 
                    : null;
                const serverMetadata = server ? { name: server } : null;
                
                console.log(`\n📝 Syncing member: ${member.name}`);
                console.log(`   - Hotspot Username: ${hotspotUsername}`);
                console.log(`   - Password: ${password}`);
                console.log(`   - Profile: ${hotspotProfile}`);
                console.log(`   - Server: ${server || 'Global'}`);
                
                await addHotspotUserRadius(
                    hotspotUsername,
                    password,
                    hotspotProfile,
                    `Member: ${member.name}`,
                    server,
                    serverMetadata,
                    null
                );
                
                console.log(`   ✅ Successfully synced to RADIUS`);
                successCount++;
                
            } catch (error) {
                console.log(`   ❌ Error syncing member "${member.name}": ${error.message}`);
                errorCount++;
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`\n📊 SYNC SUMMARY:`);
        console.log(`   ✅ Success: ${successCount}`);
        console.log(`   ❌ Error: ${errorCount}`);
        console.log(`   📋 Total: ${membersToSync.length}\n`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

syncMembersToRadius();

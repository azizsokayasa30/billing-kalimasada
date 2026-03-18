#!/usr/bin/env node

/**
 * Script untuk memperbaiki profile PPPoE di RADIUS
 * Menambahkan attribute yang hilang: Service-Type, Framed-Protocol, Framed-IP-Netmask
 */

const mysql = require('mysql2/promise');
const { getRadiusConnection } = require('../config/mikrotik');

async function fixProfileAttributes() {
    let conn;
    
    try {
        console.log('🔌 Menghubungkan ke database RADIUS...');
        conn = await getRadiusConnection();
        
        // Ambil semua profile yang ada
        const [profiles] = await conn.execute(
            'SELECT DISTINCT groupname FROM radgroupreply ORDER BY groupname'
        );
        
        console.log(`\n📋 Ditemukan ${profiles.length} profile(s):`);
        profiles.forEach(p => console.log(`   - ${p.groupname}`));
        
        let fixed = 0;
        let skipped = 0;
        
        for (const profile of profiles) {
            const groupname = profile.groupname;
            
            // Skip profile isolir
            if (groupname === 'isolir') {
                console.log(`\n⏭️  Skip profile: ${groupname} (isolir)`);
                skipped++;
                continue;
            }
            
            console.log(`\n🔧 Memperbaiki profile: ${groupname}`);
            
            // Cek attribute yang sudah ada
            const [existingAttrs] = await conn.execute(
                'SELECT attribute FROM radgroupreply WHERE groupname = ?',
                [groupname]
            );
            
            const existingAttrNames = existingAttrs.map(a => a.attribute);
            console.log(`   Attribute yang ada: ${existingAttrNames.join(', ')}`);
            
            // Attributes yang diperlukan untuk PPPoE
            const requiredAttrs = [
                { attribute: 'Service-Type', op: ':=', value: 'Framed-User' },
                { attribute: 'Framed-Protocol', op: ':=', value: 'PPP' },
                { attribute: 'Framed-IP-Netmask', op: ':=', value: '255.255.255.255' }
            ];
            
            // Tambahkan attribute yang hilang
            for (const attr of requiredAttrs) {
                if (!existingAttrNames.includes(attr.attribute)) {
                    console.log(`   ➕ Menambahkan: ${attr.attribute} = ${attr.value}`);
                    await conn.execute(
                        'INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, ?, ?, ?)',
                        [groupname, attr.attribute, attr.op, attr.value]
                    );
                } else {
                    console.log(`   ✓ Sudah ada: ${attr.attribute}`);
                }
            }
            
            fixed++;
        }
        
        console.log(`\n✅ Selesai!`);
        console.log(`   - Profile yang diperbaiki: ${fixed}`);
        console.log(`   - Profile yang di-skip: ${skipped}`);
        console.log(`\n💡 Restart FreeRADIUS untuk menerapkan perubahan:`);
        console.log(`   sudo systemctl restart freeradius`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (conn) {
            await conn.end();
        }
    }
}

// Jalankan script
fixProfileAttributes();


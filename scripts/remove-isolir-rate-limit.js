#!/usr/bin/env node

/**
 * Script untuk menghapus rate-limit dari profile isolir
 * Profile isolir tidak perlu rate-limit karena hanya untuk redirect web isolir
 */

const { getRadiusConnection } = require('../config/mikrotik');

async function removeIsolirRateLimit() {
    try {
        console.log('🔧 Menghapus rate-limit dari profile isolir...\n');
        
        const conn = await getRadiusConnection();
        
        // Cek apakah profile isolir ada
        const [existing] = await conn.execute(
            "SELECT COUNT(*) as count FROM radgroupreply WHERE groupname = 'isolir'"
        );
        
        if (!existing || existing.length === 0 || existing[0].count === 0) {
            console.log('⚠️  Profile isolir belum ada di RADIUS');
            await conn.end();
            return;
        }
        
        // Cek apakah ada rate-limit
        const [rateLimitRows] = await conn.execute(
            "SELECT value FROM radgroupreply WHERE groupname = 'isolir' AND attribute = 'MikroTik-Rate-Limit'"
        );
        
        if (rateLimitRows.length === 0) {
            console.log('✅ Profile isolir sudah tidak memiliki rate-limit');
            await conn.end();
            return;
        }
        
        console.log(`📊 Rate-limit saat ini: ${rateLimitRows[0].value}`);
        console.log('🗑️  Menghapus rate-limit...');
        
        // Hapus rate-limit
        await conn.execute(
            "DELETE FROM radgroupreply WHERE groupname = 'isolir' AND attribute = 'MikroTik-Rate-Limit'"
        );
        
        // Verifikasi
        const [verifyRows] = await conn.execute(
            "SELECT value FROM radgroupreply WHERE groupname = 'isolir' AND attribute = 'MikroTik-Rate-Limit'"
        );
        
        if (verifyRows.length === 0) {
            console.log('✅ Rate-limit berhasil dihapus dari profile isolir');
            console.log('✅ Profile isolir sekarang tidak memiliki rate-limit (loss) untuk redirect web isolir');
        } else {
            console.log('⚠️  Rate-limit masih ada setelah penghapusan');
        }
        
        // Tampilkan konfigurasi profile isolir saat ini
        console.log('\n📋 Konfigurasi profile isolir saat ini:');
        const [allAttrs] = await conn.execute(
            "SELECT attribute, op, value FROM radgroupreply WHERE groupname = 'isolir' ORDER BY attribute"
        );
        
        if (allAttrs.length === 0) {
            console.log('   - Tidak ada attributes');
        } else {
            allAttrs.forEach(attr => {
                console.log(`   - ${attr.attribute} (${attr.op}) = ${attr.value}`);
            });
        }
        
        await conn.end();
        
        console.log('\n✅ Selesai!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

removeIsolirRateLimit();


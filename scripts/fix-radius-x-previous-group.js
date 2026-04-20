#!/usr/bin/env node

/**
 * Script untuk menghapus X-Previous-Group dari radreply
 * Attribute ini tidak dikenal oleh FreeRADIUS dan menyebabkan Access-Reject
 */

const { getRadiusConnection } = require('../config/mikrotik');

async function fixXPreviousGroup() {
    try {
        console.log('🔧 Memperbaiki X-Previous-Group di radreply...\n');
        
        const conn = await getRadiusConnection();
        
        // Hapus semua X-Previous-Group dari radreply
        const [result] = await conn.execute(
            "DELETE FROM radreply WHERE attribute = 'X-Previous-Group'"
        );
        
        console.log(`✅ Menghapus ${result.affectedRows} record(s) X-Previous-Group dari radreply`);
        console.log('\n💡 Catatan: X-Previous-Group tidak bisa disimpan di radreply karena tidak dikenal oleh FreeRADIUS.');
        console.log('   Previous group akan disimpan di tabel custom atau di radcheck dengan format berbeda.');
        
        await conn.end();
        
        console.log('\n✅ Perbaikan selesai!');
        console.log('   Silakan coba login lagi dengan user enos.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixXPreviousGroup();


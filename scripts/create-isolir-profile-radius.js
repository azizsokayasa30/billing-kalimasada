#!/usr/bin/env node

/**
 * Script untuk membuat profile isolir di RADIUS
 * Memastikan profile isolir ada dengan konfigurasi yang benar
 */

const { ensureIsolirProfileRadius } = require('../config/mikrotik');

async function createIsolirProfile() {
    try {
        console.log('🔧 Membuat profile isolir di RADIUS...\n');
        
        const result = await ensureIsolirProfileRadius();
        
        if (result.success) {
            console.log('✅ ' + result.message);
            console.log('\n📋 Profile isolir sekarang memiliki:');
            console.log('   - Rate-Limit: 1k/1k (bukan 0/0)');
            console.log('   - Simultaneous-Use: 1');
            console.log('   - Session-Timeout: Kosong (tidak ada timeout)');
            console.log('   - Idle-Timeout: Kosong (tidak ada timeout)');
            console.log('\n💡 User yang diisolir sekarang tidak akan langsung disconnect setelah Access-Accept!');
        } else {
            console.error('❌ ' + (result.message || 'Gagal membuat profile isolir'));
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

createIsolirProfile();


#!/usr/bin/env node

/**
 * Script untuk restore member yang sudah melakukan pembayaran
 * tapi statusnya masih isolir atau suspend
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const billingManager = require('../config/billing');
const serviceSuspension = require('../config/serviceSuspension');

const dbPath = path.join(__dirname, '../data/billing.db');

async function restorePaidMembers() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        // Query untuk mendapatkan member yang:
        // 1. Status isolir atau suspend
        // 2. Memiliki invoice yang sudah paid
        // 3. Tidak ada invoice unpaid
        const sql = `
            SELECT DISTINCT m.*
            FROM members m
            WHERE m.status IN ('isolir', 'suspend')
            AND EXISTS (
                SELECT 1 
                FROM invoices i 
                WHERE i.member_id = m.id 
                AND i.status = 'paid'
            )
            AND NOT EXISTS (
                SELECT 1 
                FROM invoices i 
                WHERE i.member_id = m.id 
                AND i.status = 'unpaid'
            )
        `;
        
        db.all(sql, [], async (err, members) => {
            if (err) {
                db.close();
                return reject(err);
            }
            
            console.log(`\n📋 Found ${members.length} members eligible for restore\n`);
            
            const results = {
                success: [],
                failed: []
            };
            
            for (const member of members) {
                try {
                    console.log(`🔄 Processing member: ${member.name} (${member.hotspot_username}) - Status: ${member.status}`);
                    
                    // Get member invoices to verify
                    const invoices = await billingManager.getInvoices(member.hotspot_username || member.username);
                    const unpaid = invoices.filter(i => i.status === 'unpaid');
                    
                    if (unpaid.length > 0) {
                        console.log(`⚠️  Member ${member.name} still has ${unpaid.length} unpaid invoices, skipping...`);
                        results.failed.push({
                            member: member.name,
                            hotspot_username: member.hotspot_username,
                            reason: `Still has ${unpaid.length} unpaid invoices`
                        });
                        continue;
                    }
                    
                    // Restore member service
                    const restoreResult = await serviceSuspension.restoreMemberService(
                        member, 
                        'Auto-restore after payment verification'
                    );
                    
                    if (restoreResult.success) {
                        console.log(`✅ Successfully restored member: ${member.name} (${member.hotspot_username})`);
                        results.success.push({
                            member: member.name,
                            hotspot_username: member.hotspot_username
                        });
                    } else {
                        console.log(`❌ Failed to restore member: ${member.name} - ${restoreResult.message}`);
                        results.failed.push({
                            member: member.name,
                            hotspot_username: member.hotspot_username,
                            reason: restoreResult.message
                        });
                    }
                } catch (error) {
                    console.error(`❌ Error processing member ${member.name}:`, error.message);
                    results.failed.push({
                        member: member.name,
                        hotspot_username: member.hotspot_username,
                        reason: error.message
                    });
                }
            }
            
            db.close();
            
            console.log(`\n📊 Summary:`);
            console.log(`✅ Successfully restored: ${results.success.length} members`);
            console.log(`❌ Failed: ${results.failed.length} members`);
            
            if (results.success.length > 0) {
                console.log(`\n✅ Successfully restored members:`);
                results.success.forEach(r => {
                    console.log(`   - ${r.member} (${r.hotspot_username})`);
                });
            }
            
            if (results.failed.length > 0) {
                console.log(`\n❌ Failed to restore members:`);
                results.failed.forEach(r => {
                    console.log(`   - ${r.member} (${r.hotspot_username}): ${r.reason}`);
                });
            }
            
            resolve(results);
        });
    });
}

// Run script
if (require.main === module) {
    restorePaidMembers()
        .then(() => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { restorePaidMembers };

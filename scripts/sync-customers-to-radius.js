#!/usr/bin/env node
/**
 * Reconcile billing customers into RADIUS SQL tables (SQLite).
 * Usage:
 *   node scripts/sync-customers-to-radius.js --dry-run
 *   node scripts/sync-customers-to-radius.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { syncCustomerToRadius } = require('../utils/radiusCustomerSync');

const DRY_RUN = process.argv.includes('--dry-run');
const billingDbPath = path.join(__dirname, '../data/billing.db');

function getCustomersWithPPPoE() {
    const db = new sqlite3.Database(billingDbPath);
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT c.id, c.customer_id, c.username, c.pppoe_username, c.name, c.phone, c.pppoe_profile, c.status,
                   c.static_ip, c.assigned_ip, c.pppoe_password, p.pppoe_profile AS package_pppoe_profile
            FROM customers c
            LEFT JOIN packages p ON c.package_id = p.id
            WHERE c.pppoe_username IS NOT NULL
              AND TRIM(c.pppoe_username) != ''
            ORDER BY c.id ASC
        `, [], (err, rows) => {
            db.close();
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

async function main() {
    console.log('Starting billing -> RADIUS reconciliation...');
    if (DRY_RUN) console.log('DRY-RUN enabled, no data will be written.');

    const customers = await getCustomersWithPPPoE();
    if (customers.length === 0) {
        console.log('No customer with PPPoE username found.');
        return;
    }

    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (const customer of customers) {
        try {
            if (DRY_RUN) {
                console.log(`[DRY-RUN] ${customer.pppoe_username} profile=${customer.pppoe_profile || '-'} status=${customer.status}`);
                skipped++;
                continue;
            }

            const result = await syncCustomerToRadius(customer, {
                pppoe_password: customer.pppoe_password,
                pppoe_profile: customer.pppoe_profile,
                static_ip: customer.static_ip,
                assigned_ip: customer.assigned_ip,
                status: customer.status
            });
            if (result.success) {
                console.log(`[SYNCED] ${customer.pppoe_username}`);
                synced++;
            } else if (result.skipped) {
                console.log(`[SKIPPED] ${customer.pppoe_username}: ${result.message}`);
                skipped++;
            } else {
                console.log(`[FAILED] ${customer.pppoe_username}: ${result.message}`);
                failed++;
            }
        } catch (error) {
            console.log(`[FAILED] ${customer.pppoe_username}: ${error.message}`);
            failed++;
        }
    }

    console.log('\nSummary');
    console.log(`- Total: ${customers.length}`);
    console.log(`- Synced: ${synced}`);
    console.log(`- Skipped: ${skipped}`);
    console.log(`- Failed: ${failed}`);
}

main().catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});


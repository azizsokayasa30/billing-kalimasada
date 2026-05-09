const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const billingDbPath = path.join(__dirname, '../data/billing.db');

const { getRadiusConnection } = require('../config/mikrotik');
const { syncCustomerToRadius } = require('../utils/radiusCustomerSync');
const { syncPackageLimitsToRadius, ensureIsolirProfileRadius } = require('../config/mikrotik');

async function getBillingDb() {
    return new sqlite3.Database(billingDbPath);
}

async function syncAllPackages(db) {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM packages WHERE is_active = 1 AND pppoe_profile IS NOT NULL AND pppoe_profile != ''", async (err, rows) => {
            if (err) return reject(err);
            console.log(`Found ${rows.length} packages to sync.`);
            for (const pkg of rows) {
                try {
                    await syncPackageLimitsToRadius({
                        groupname: pkg.pppoe_profile,
                        upload_limit: pkg.upload_limit,
                        download_limit: pkg.download_limit,
                        burst_limit_upload: pkg.burst_limit_upload,
                        burst_limit_download: pkg.burst_limit_download,
                        burst_threshold: pkg.burst_threshold,
                        burst_time: pkg.burst_time
                    });
                    console.log(`Synced package ${pkg.pppoe_profile}`);
                } catch (e) {
                    console.error(`Failed to sync package ${pkg.pppoe_profile}:`, e.message);
                }
            }
            resolve();
        });
    });
}

async function syncAllCustomers(db) {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM customers WHERE pppoe_username IS NOT NULL AND pppoe_username != ''", async (err, rows) => {
            if (err) return reject(err);
            console.log(`Found ${rows.length} customers to sync.`);
            for (const cust of rows) {
                try {
                    // Pass the properties appropriately. cust.password is login password, NOT PPPoE password!
                    await syncCustomerToRadius(cust, {
                        pppoe_password: cust.pppoe_password,
                        pppoe_profile: cust.pppoe_profile,
                        static_ip: cust.static_ip,
                        assigned_ip: cust.assigned_ip,
                        status: cust.status
                    });
                    console.log(`Synced customer ${cust.pppoe_username}`);
                } catch (e) {
                    console.error(`Failed to sync customer ${cust.pppoe_username}:`, e.message);
                }
            }
            resolve();
        });
    });
}

async function main() {
    try {
        const conn = await getRadiusConnection();
        // Wait for schema to init
        await ensureIsolirProfileRadius();
        
        const db = await getBillingDb();
        await syncAllPackages(db);
        await syncAllCustomers(db);
        console.log("Full sync to RADIUS completed successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Error during sync:", e);
        process.exit(1);
    }
}

main();

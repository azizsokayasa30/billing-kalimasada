#!/usr/bin/env node

/**
 * Comprehensive Dummy Data Generator (Corrected Schema)
 * Populates ALL tables with realistic testing data for Mobile API & Flutter development.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function generateDummyData() {
    const dbPath = path.join(__dirname, '../data/billing.db');
    const troubleReportPath = path.join(__dirname, '../logs/trouble_reports.json');
    const db = new sqlite3.Database(dbPath);
    
    const run = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

    const get = (sql, params = []) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    const all = (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    try {
        console.log('🚀 Starting Comprehensive Dummy Data Generation (Corrected)...\n');

        // 1. Routers
        console.log('📡 Step 1: Adding Routers...');
        const routerData = [
            ['Router Pusat - MK1', '192.168.88.1', 'Core-Router', 'secret123'],
            ['Router Cabang - MK2', '192.168.88.2', 'Branch-Router', 'secret123']
        ];
        for (const r of routerData) {
            await run('INSERT OR IGNORE INTO routers (name, nas_ip, nas_identifier, secret) VALUES (?, ?, ?, ?)', r);
        }
        const routers = await all('SELECT id FROM routers');

        // 2. Packages
        console.log('📦 Step 2: Adding Packages...');
        const pkgData = [
            ['Lite 5Mbps', '5 Mbps', 75000, 11, 'Paket internet ekonomis', 'lite', routers[0].id],
            ['Standard 10Mbps', '10 Mbps', 150000, 11, 'Paket internet standar keluarga', 'standard', routers[0].id],
            ['Premium 20Mbps', '20 Mbps', 250000, 11, 'Paket internet cepat', 'premium', routers[0].id],
            ['Gamer 50Mbps', '50 Mbps', 450000, 11, 'Paket internet ultra cepat', 'ultra', routers[1].id]
        ];
        for (const p of pkgData) {
            await run('INSERT OR IGNORE INTO packages (name, speed, price, tax_rate, description, pppoe_profile, router_id) VALUES (?, ?, ?, ?, ?, ?, ?)', p);
        }
        const packages = await all('SELECT id, price, name, tax_rate FROM packages');

        // 3. Technicians (Corrected schema)
        console.log('👨‍🔧 Step 3: Adding Technicians...');
        const techData = [
            ['Andi Teknisi', '081122334455', 'technician', 1, 'Area Utara'],
            ['Budi Instalatur', '081122334456', 'technician', 1, 'Area Selatan'],
            ['Chandra Field', '081122334457', 'field_officer', 1, 'All Areas']
        ];
        for (const t of techData) {
            await run('INSERT OR IGNORE INTO technicians (name, phone, role, is_active, area_coverage) VALUES (?, ?, ?, ?, ?)', t);
        }
        const techs = await all('SELECT id FROM technicians');

        // 4. Agents
        console.log('👤 Step 4: Adding Agents...');
        const agentData = [
            ['Agent Wijaya', 'wijaya_wifi', '085566778899', 'wijaya@gmail.com', 'pass123', 'active'],
            ['Berkah Cell', 'berkah_cell', '085566778800', 'berkah@gmail.com', 'pass123', 'active']
        ];
        const agentIds = [];
        for (const a of agentData) {
            await run('INSERT OR IGNORE INTO agents (name, username, phone, email, password, status) VALUES (?, ?, ?, ?, ?, ?)', a);
            const res = await get('SELECT id FROM agents WHERE username = ?', [a[1]]);
            if (res) {
                agentIds.push(res.id);
                await run('INSERT OR IGNORE INTO agent_balances (agent_id, balance) VALUES (?, ?)', [res.id, 500000]);
            }
        }

        // 5. Customers (Corrected schema)
        console.log('👥 Step 5: Adding Customers...');
        const customers = [
            ['user1', 'Rian Hidayat', '0899111111', 'rian@gmail.com', 'Jl. Elang No 1', 'active', 'rian_wifi'],
            ['user2', 'Sari Putri', '0899222222', 'sari@gmail.com', 'Jl. Merpati No 2', 'active', 'sari_wifi'],
            ['user3', 'Dedi Kurniawan', '0899333333', 'dedi@gmail.com', 'Jl. Garuda No 3', 'expired', 'dedi_wifi'],
            ['user4', 'Maya Indah', '0899444444', 'maya@gmail.com', 'Jl. Kancil No 4', 'active', 'maya_wifi'],
            ['user5', 'Eko Prasetyo', '0899555555', 'eko@gmail.com', 'Jl. Gajah No 5', 'active', 'eko_wifi']
        ];
        
        const customerIds = [];
        for (const [idx, c] of customers.entries()) {
            const pkg = packages[idx % packages.length];
            await run(`
                INSERT OR IGNORE INTO customers (username, name, phone, email, address, status, pppoe_username, package_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [...c, pkg.id]);
            
            const res = await get('SELECT id FROM customers WHERE username = ?', [c[0]]);
            if (res) {
                customerIds.push({ id: res.id, pkg, name: c[1], phone: c[2], address: c[4] });
            }
        }

        // 6. Invoices (Corrected schema)
        console.log('📄 Step 6: Adding Invoices...');
        for (const c of customerIds) {
            const tax = (c.pkg.price * c.pkg.tax_rate) / 100;
            const total = c.pkg.price + tax;

            // Unpaid invoice
            await run(`
                INSERT OR IGNORE INTO invoices (customer_id, package_id, invoice_number, amount, base_amount, tax_rate, due_date, status, invoice_type, package_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [c.id, c.pkg.id, `INV-${Date.now()}-${c.id}`, total, c.pkg.price, c.pkg.tax_rate, '2025-04-15', 'unpaid', 'monthly', c.pkg.name]);
            
            // Paid invoice
            await run(`
                INSERT OR IGNORE INTO invoices (customer_id, package_id, invoice_number, amount, base_amount, tax_rate, due_date, status, invoice_type, package_name, payment_date, payment_method, payment_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [c.id, c.pkg.id, `INV-PAID-${c.id}`, total, c.pkg.price, c.pkg.tax_rate, '2025-03-15', 'paid', 'monthly', c.pkg.name, '2025-03-10', 'Cash', 'settlement']);
        }

        // 7. Installation Jobs
        console.log('🛠️ Step 7: Adding Installation Jobs...');
        const jobs = [
            ['INS-2025-010', 'Budi Santoso', '081234567890', 'Jl. Merdeka No 1', packages[0].id, '2025-03-20', '09:00', 'scheduled', 'high', techs[0].id],
            ['INS-2025-011', 'Siti Aminah', '081234567891', 'Jl. Sudirman No 2', packages[1].id, '2025-03-21', '13:00', 'assigned', 'normal', techs[1].id]
        ];
        for (const j of jobs) {
            await run(`
                INSERT OR IGNORE INTO installation_jobs (job_number, customer_name, customer_phone, customer_address, package_id, installation_date, installation_time, status, priority, assigned_technician_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, j);
        }

        // 8. Trouble Reports (JSON)
        console.log('⚠️ Step 8: Adding Trouble Reports...');
        const reports = [];
        const problems = ['Internet Lambat', 'Lampu LOS Merah', 'Sering Putus', 'Wifi Tidak Terdeteksi'];
        
        for (let i = 1; i <= 5; i++) {
            const cust = customerIds[i % customerIds.length];
            reports.push({
                id: `TR-${2000 + i}`,
                status: i % 2 === 0 ? 'in_progress' : 'open',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                name: cust.name,
                phone: cust.phone,
                location: cust.address,
                category: 'Network',
                description: `${problems[i % problems.length]} sejak tadi pagi.`,
                notes: []
            });
        }
        
        if (!fs.existsSync(path.dirname(troubleReportPath))) {
            fs.mkdirSync(path.dirname(troubleReportPath), { recursive: true });
        }
        fs.writeFileSync(troubleReportPath, JSON.stringify(reports, null, 2), 'utf8');

        console.log('\n✅ DUMMY DATA GENERATION COMPLETED!');

    } catch (error) {
        console.error('❌ Error generating dummy data:', error);
    } finally {
        db.close();
    }
}

generateDummyData();

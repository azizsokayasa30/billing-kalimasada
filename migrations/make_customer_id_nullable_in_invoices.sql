-- Migration: Make customer_id nullable in invoices table to support member invoices
-- Date: 2026-01-08
-- Description: Allow customer_id to be NULL so that member invoices can be created without customer_id

-- SQLite doesn't support ALTER TABLE to modify NOT NULL constraint directly
-- We need to recreate the table with the new structure

-- Step 1: Create new invoices table with nullable customer_id
CREATE TABLE IF NOT EXISTS invoices_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NULL,
    member_id INTEGER NULL,
    package_id INTEGER NOT NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'unpaid',
    payment_date DATETIME,
    payment_method TEXT,
    payment_gateway TEXT,
    payment_token TEXT,
    payment_url TEXT,
    payment_status TEXT DEFAULT 'pending',
    notes TEXT,
    description TEXT,
    invoice_type TEXT DEFAULT 'monthly',
    package_name TEXT,
    base_amount DECIMAL(10,2),
    tax_rate DECIMAL(5,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers (id),
    FOREIGN KEY (member_id) REFERENCES members (id),
    FOREIGN KEY (package_id) REFERENCES packages (id),
    CHECK ((customer_id IS NOT NULL) OR (member_id IS NOT NULL))
);

-- Step 2: Copy all data from old table to new table
INSERT INTO invoices_new (
    id, customer_id, member_id, package_id, invoice_number, amount, due_date, 
    status, payment_date, payment_method, payment_gateway, payment_token, 
    payment_url, payment_status, notes, description, invoice_type, package_name,
    base_amount, tax_rate, created_at
)
SELECT 
    id, customer_id, member_id, package_id, invoice_number, amount, due_date,
    status, payment_date, payment_method, payment_gateway, payment_token,
    payment_url, payment_status, notes, description, invoice_type, package_name,
    base_amount, tax_rate, created_at
FROM invoices;

-- Step 3: Drop old table
DROP TABLE invoices;

-- Step 4: Rename new table to original name
ALTER TABLE invoices_new RENAME TO invoices;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_member_id ON invoices(member_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

# NAS Client Management - Database-Driven Architecture

## Overview
The RADIUS NAS (Network Access Server) client management has been refactored from a file-based system (`/etc/freeradius/3.0/clients.conf`) to a **database-driven approach** using the existing RADIUS SQLite `nas` table. This eliminates file system permission issues.

### Sinkron dua arah (billing ↔ FreeRADIUS)
FreeRADIUS tetap membaca **`clients.conf`**. Tabel **`nas`** dipakai aplikasi dan cadangan. Perilaku saat ini:
- **Baca**: daftar di UI = gabungan **`nas`** + isi **`clients.conf`** (dedupe per IP).
- **Tulis** (tambah/ubah/hapus dari admin): memperbarui **`clients.conf`** dan **`nas`** agar keduanya sama.
- Jika **`nas`** kosong (mis. setelah reset SQLite) tetapi **`clients.conf`** masih berisi NAS, pembukaan halaman NAS mengisi ulang **`nas`** dari file (sekali).
- Proses Node/PM2 sering **tidak bisa membaca** `/etc/freeradius/.../clients.conf`. Gunakan salinan **`data/clients.conf.mirror`**: jalankan di server **`npm run radius:mirror-clients`** (perlu sudo), lalu restart PM2. Opsional: env **`RADIUS_CLIENTS_CONF_MIRROR`** ke path salinan lain.

## Problem Solved
**Original Issue**: `EACCES: permission denied, open '/etc/freeradius/3.0/clients.conf'`
- The Node.js application runs as a regular user and cannot write to `/etc/freeradius/` directory
- Adding, editing, or deleting NAS clients failed due to insufficient permissions

**Solution**: Store NAS client configuration directly in the RADIUS SQLite database
- Uses the existing `nas` table from FreeRADIUS schema
- Application has full read/write access to the SQLite database
- Provides proper backup/restore with database backups
- Continues to support file fallback for backward compatibility

## Architecture Changes

### Files Modified

#### 1. **config/radiusClients.js**
- **Changed**: Replaced file-based client management with database operations
- **New Functions**:
  - `initializeClientsTable()` - Verifies nas table is ready
  - `parseClientsConfFromDB()` - Primary method to read clients from nas table
  - `parseClientsConfFromFile()` - Fallback method (backward compatibility)
  - `writeClientsConfToDB()` - Primary method to write clients to nas table
- **Legacy Functions**: `parseClientsConf()` and `writeClientsConf()` now deprecated but maintained for compatibility

#### 2. **routes/adminRadius.js**
- **Updated**: All client management endpoints to use async database functions
- **Endpoints Modified**:
  - `GET /radius/clients` - Now uses `parseClientsConfFromDB()`
  - `GET /radius/clients/api` - Now uses `parseClientsConfFromDB()`
  - `POST /radius/clients/add` - Now uses `writeClientsConfToDB()`
  - `POST /radius/clients/edit` - Now uses `writeClientsConfToDB()`
  - `POST /radius/clients/delete` - Now uses `writeClientsConfToDB()`

#### 3. **config/radiusSQLite.js**
- **No Changes Required**: The `nas` table was already defined in the schema
- Table Structure Used:
  ```
  nas (
    id INTEGER PRIMARY KEY,
    nasname VARCHAR(64) - Client name
    shortname VARCHAR(32) - Usually IP address
    type VARCHAR(30) - NAS type (e.g., 'other', 'cisco', 'juniper')
    secret VARCHAR(60) - Shared secret
    description TEXT - Client description
  )
  ```

## Data Mapping

### Old File Format vs New Database Format
```
Old (clients.conf):
  client router-office {
    ipaddr = 192.168.1.1
    secret = sharedsecret123
    nas_type = cisco
  }

New (nas table):
  nasname: 'router-office'
  shortname: '192.168.1.1'
  type: 'cisco'
  secret: 'sharedsecret123'
  description: NULL
```

## Benefits

1. **No Permission Issues** - Database writes don't require root access
2. **Easier Backup/Restore** - Included in RADIUS database backups
3. **Transactional Integrity** - Database ensures data consistency
4. **Scalability** - Can handle large numbers of clients
5. **Backward Compatibility** - Falls back to file if database unavailable
6. **Audit Trail** - All changes logged through standard logging

## Migration

### For Existing Installations

If you have clients defined in `/etc/freeradius/3.0/clients.conf`, they will be automatically loaded on first access:

1. The system tries to read from `nas` table first
2. If empty, falls back to reading `clients.conf` file
3. You can manually migrate by:
   - Export clients from the UI
   - Add them through the web interface (now uses database)
   - The new entries will be stored in nas table

### Zero-Knowledge Operation

For new installations, the RADIUS clients can be:
- Added through the Admin UI at `/admin/radius/clients`
- Added via API endpoints `/radius/clients/add`
- Automatically populated if you have existing file configuration

## Testing

Run the test script to verify setup:
```bash
node test-radius-clients.js
```

Expected output:
```
✓ Table initialized: SUCCESS
✓ Successfully loaded n clients from database
✓ All tests passed! Database-driven client management is working.
```

## Future Improvements

1. UI for bulk client import from file
2. Client validation before database insertion
3. Rate limiting for client API operations
4. Client activity logging/auditing
5. Support for IPv6 addresses in client configuration

## Troubleshooting

### Issue: "No clients found in nas table"
**Solution**: This is normal for fresh installations. Add clients through the UI or API.

### Issue: "Database read failed, falling back to file"
**Solution**: Ensure RADIUS SQLite database is initialized. Check logs for connection errors.

### Issue: "Cannot read clients.conf" warning
**Solution**: This is expected if `/etc/freeradius/3.0/clients.conf` doesn't exist or isn't readable. The system will use the database instead.

## Rollback (if needed)

To revert to file-based management:
1. Edit `routes/adminRadius.js` - Change `parseClientsConfFromDB()` calls back to `parseClientsConf()`
2. Change `writeClientsConfToDB()` calls back to `writeClientsConf()`
3. Ensure `/etc/freeradius/3.0/clients.conf` has proper permissions (readableby www-data)
4. Restart the application

## Configuration References

None needed! The system auto-detects and uses the nas table without configuration.

---

**Date**: 2025-04-20  
**Version**: 2.1.0  
**Status**: Deployed and tested

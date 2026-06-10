-- Multi-tenant columns for FreeRADIUS MySQL (Kalimasada SaaS)
-- Isolasi: user/NAS scoped by tenant_id; FreeRADIUS queries filter via NAS IP.

ALTER TABLE radcheck
    ADD COLUMN IF NOT EXISTS tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE radreply
    ADD COLUMN IF NOT EXISTS tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE radusergroup
    ADD COLUMN IF NOT EXISTS tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE radgroupcheck
    ADD COLUMN IF NOT EXISTS tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE radgroupreply
    ADD COLUMN IF NOT EXISTS tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE nas
    ADD COLUMN IF NOT EXISTS tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE radacct
    ADD COLUMN IF NOT EXISTS tenant_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER radacctid;

CREATE INDEX IF NOT EXISTS idx_radcheck_tenant_username ON radcheck (tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_radreply_tenant_username ON radreply (tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_radusergroup_tenant_username ON radusergroup (tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_radgroupcheck_tenant_group ON radgroupcheck (tenant_id, groupname);
CREATE INDEX IF NOT EXISTS idx_radgroupreply_tenant_group ON radgroupreply (tenant_id, groupname);
CREATE INDEX IF NOT EXISTS idx_nas_tenant_nasname ON nas (tenant_id, nasname);
CREATE INDEX IF NOT EXISTS idx_radacct_tenant_username ON radacct (tenant_id, username);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_log_tenant_isolation ON audit_log
  USING (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

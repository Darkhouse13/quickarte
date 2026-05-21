CREATE TABLE branch_category_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  visible boolean NULL,
  position integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX branch_category_overrides_unique
  ON branch_category_overrides (branch_id, category_id);
CREATE INDEX branch_category_overrides_business_idx
  ON branch_category_overrides (business_id);
CREATE INDEX branch_category_overrides_branch_idx
  ON branch_category_overrides (branch_id);

CREATE TABLE branch_product_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  available boolean NULL,
  is_86d boolean NOT NULL DEFAULT false,
  eighty_sixed_at timestamptz NULL,
  eighty_sixed_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  eighty_sixed_reason text NULL,
  featured boolean NULL,
  hidden boolean NULL,
  available_dine_in boolean NULL,
  available_takeaway boolean NULL,
  available_delivery boolean NULL,
  available_qr boolean NULL,
  available_online boolean NULL,
  position integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX branch_product_overrides_unique
  ON branch_product_overrides (branch_id, product_id);
CREATE INDEX branch_product_overrides_business_idx
  ON branch_product_overrides (business_id);
CREATE INDEX branch_product_overrides_branch_idx
  ON branch_product_overrides (branch_id);

CREATE TABLE branch_product_price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX branch_product_price_overrides_unique
  ON branch_product_price_overrides (branch_id, variant_id);
CREATE INDEX branch_product_price_overrides_business_idx
  ON branch_product_price_overrides (business_id);
CREATE INDEX branch_product_price_overrides_branch_idx
  ON branch_product_price_overrides (branch_id);

CREATE TABLE branch_option_value_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  option_value_id uuid NOT NULL REFERENCES option_values(id) ON DELETE CASCADE,
  available boolean NULL,
  price_addition numeric(10,2) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX branch_option_value_overrides_unique
  ON branch_option_value_overrides (branch_id, option_value_id);
CREATE INDEX branch_option_value_overrides_business_idx
  ON branch_option_value_overrides (business_id);
CREATE INDEX branch_option_value_overrides_branch_idx
  ON branch_option_value_overrides (branch_id);

ALTER TABLE branch_category_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_category_overrides FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_category_overrides_tenant_isolation
  ON branch_category_overrides
  USING (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

ALTER TABLE branch_product_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_product_overrides FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_product_overrides_tenant_isolation
  ON branch_product_overrides
  USING (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

ALTER TABLE branch_product_price_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_product_price_overrides FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_product_price_overrides_tenant_isolation
  ON branch_product_price_overrides
  USING (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

ALTER TABLE branch_option_value_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_option_value_overrides FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_option_value_overrides_tenant_isolation
  ON branch_option_value_overrides
  USING (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

INSERT INTO permissions (id, description, category) VALUES
  ('order.view', 'View orders', 'order'),
  ('order.update', 'Update orders and operational order state', 'order')
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.id IN ('order.view', 'order.update')
WHERE r.name IN ('Owner', 'Manager', 'Cashier', 'Waiter')
ON CONFLICT DO NOTHING;

UPDATE permission_versions
SET version = greatest(version, 7)
WHERE business_id IN (SELECT id FROM businesses);

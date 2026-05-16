ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS option_max_selections_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

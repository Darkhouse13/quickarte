-- One-off production backfill for Drizzle's migration journal.
-- Run only after confirming these migrations were physically applied to prod.

CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

CREATE UNIQUE INDEX IF NOT EXISTS __drizzle_migrations_hash_unique
  ON drizzle.__drizzle_migrations (hash);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES
  ('90afc370fd19396440a3223d8e28c74b84f677898edb3ea6be27e1cd93c629bc', (extract(epoch from now()) * 1000)::bigint),
  ('654b7e2dd380e0629a6eff6910e595212ba6970a99e630b18c2a7223149aeb01', (extract(epoch from now()) * 1000)::bigint),
  ('352ad057275461c41731626e11fe55a1e170cb7ac83989f5f3b9cee8da57f3f9', (extract(epoch from now()) * 1000)::bigint),
  ('e160cbd55f9289d51c65c149b95d9ef3481bc1dab1176953633ea7bf925dfabb', (extract(epoch from now()) * 1000)::bigint),
  ('9ff7e688ebdf4c0796bf5f474d15fcee1442118b318c951304c3627cf3989c9b', (extract(epoch from now()) * 1000)::bigint),
  ('36b89e130d1e609c434d4fb226864982558b04ca763ec3d43ffd8c9b48c65d22', (extract(epoch from now()) * 1000)::bigint),
  ('88784263aaef05e9ddd1415553734646b46ed9444d2be644f6529c0686a3ae6b', (extract(epoch from now()) * 1000)::bigint),
  ('46ee85ee4d41cdd67a44b56286012527a911678feacf15e3ab821d5565d63a2e', (extract(epoch from now()) * 1000)::bigint),
  ('0dc2c5ff3cee342472a8d21e26e2c9fb28313c6d0cc45caa6147234918ab4d10', (extract(epoch from now()) * 1000)::bigint),
  ('5aba5fc9c4a10e8ed639c0ea8ecd7daad4cdd2b7ac76c59d360b34293eaf54b2', (extract(epoch from now()) * 1000)::bigint),
  ('2de9787c7c7b2922f4e249879bcd9f25ae460d7a542cf53e712034bd9d99fe51', (extract(epoch from now()) * 1000)::bigint),
  ('0d7d613ca73c87285bbb16cbecd2d08408b65684d7f4f10542a3d9fe7f9ff5e6', (extract(epoch from now()) * 1000)::bigint),
  ('17a97753ad343fb448431ec4aa4cccab7038867b7b2cfd8195d280037763dca4', (extract(epoch from now()) * 1000)::bigint)
ON CONFLICT (hash) DO NOTHING;

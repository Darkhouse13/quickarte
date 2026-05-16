CREATE TABLE audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL,
  actor_user_id uuid        NULL,
  action        varchar(64) NOT NULL,
  entity_type   varchar(64) NULL,
  entity_id     uuid        NULL,
  before_state  jsonb       NULL,
  after_state   jsonb       NULL,
  ip_address    inet        NULL,
  user_agent    text        NULL,
  request_id    uuid        NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_business_created_idx ON audit_log (business_id, created_at DESC);
CREATE INDEX audit_log_entity_idx           ON audit_log (entity_type, entity_id, created_at DESC);

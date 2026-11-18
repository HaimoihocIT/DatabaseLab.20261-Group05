-- Infrastructure smoke test only. No DMS business schema is defined here.
-- Keep this schema outside api.schemas in config.toml.
CREATE SCHEMA setup_meta;
REVOKE ALL ON SCHEMA setup_meta FROM PUBLIC, anon, authenticated;

CREATE TABLE setup_meta.workflow_probe (
    id smallint PRIMARY KEY CHECK (id = 1),
    marker text NOT NULL
);

ALTER TABLE setup_meta.workflow_probe ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE setup_meta.workflow_probe FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE setup_meta.workflow_probe IS
    'Infrastructure marker for validating migrations and local seed; not DMS data.';

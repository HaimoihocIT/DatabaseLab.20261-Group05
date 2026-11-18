-- Deterministic, synthetic LOCAL data. Applied after migrations on first start/reset.
-- No real students, accounts, credentials, or DMS business data.
INSERT INTO setup_meta.workflow_probe (id, marker)
VALUES (1, 'local-seed-ok')
ON CONFLICT (id) DO UPDATE SET marker = EXCLUDED.marker;

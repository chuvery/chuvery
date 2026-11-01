-- Jiseong Package private Preview database. Apply only to an isolated project.
CREATE TABLE IF NOT EXISTS admin_notices (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 title varchar(160) NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
 body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
 published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_notices_public_idx ON admin_notices(published, created_at DESC);
-- Never store admin passwords or session secrets in this database.

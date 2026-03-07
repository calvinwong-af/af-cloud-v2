-- Migration 014: Promote port terminals to first-class table
-- Adds port_terminals table seeded from existing ports.terminals JSONB.
-- Adds optional terminal_id FK to fcl_rate_cards and lcl_rate_cards.

-- Port terminals table
CREATE TABLE IF NOT EXISTS port_terminals (
    terminal_id   TEXT        PRIMARY KEY,
    port_un_code  TEXT        NOT NULL REFERENCES ports(un_code),
    name          TEXT        NOT NULL,
    is_default    BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_port_terminals_port
    ON port_terminals (port_un_code);

-- Seed from existing ports.terminals JSONB
-- Only inserts ports that have has_terminals = TRUE
INSERT INTO port_terminals (terminal_id, port_un_code, name, is_default)
SELECT
    t->>'terminal_id'  AS terminal_id,
    p.un_code          AS port_un_code,
    t->>'name'         AS name,
    (t->>'is_default')::boolean AS is_default
FROM ports p,
     jsonb_array_elements(p.terminals) AS t
WHERE p.has_terminals = TRUE
  AND p.terminals IS NOT NULL
  AND jsonb_array_length(p.terminals) > 0
ON CONFLICT (terminal_id) DO NOTHING;

-- Add terminal_id to rate card tables (nullable — most ports have no terminals)
ALTER TABLE fcl_rate_cards
    ADD COLUMN IF NOT EXISTS terminal_id TEXT REFERENCES port_terminals(terminal_id);

ALTER TABLE lcl_rate_cards
    ADD COLUMN IF NOT EXISTS terminal_id TEXT REFERENCES port_terminals(terminal_id);

-- Indexes for terminal-aware rate lookups
CREATE INDEX IF NOT EXISTS idx_fcl_rate_cards_terminal
    ON fcl_rate_cards (destination_port_code, terminal_id);

CREATE INDEX IF NOT EXISTS idx_lcl_rate_cards_terminal
    ON lcl_rate_cards (destination_port_code, terminal_id);

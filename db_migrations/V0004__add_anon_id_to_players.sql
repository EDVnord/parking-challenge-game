ALTER TABLE t_p25425030_parking_challenge_ga.players
  ADD COLUMN IF NOT EXISTS anon_id VARCHAR(128) NULL UNIQUE;

CREATE INDEX IF NOT EXISTS idx_players_anon_id 
  ON t_p25425030_parking_challenge_ga.players(anon_id)
  WHERE anon_id IS NOT NULL;
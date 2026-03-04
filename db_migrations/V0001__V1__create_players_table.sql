
CREATE TABLE t_p25425030_parking_challenge_ga.players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(16) NOT NULL UNIQUE,
  emoji VARCHAR(8) NOT NULL DEFAULT '😎',
  password_hash VARCHAR(64) NOT NULL,
  coins INTEGER NOT NULL DEFAULT 1000,
  gems INTEGER NOT NULL DEFAULT 50,
  xp INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  best_position INTEGER NOT NULL DEFAULT 99,
  selected_car INTEGER NOT NULL DEFAULT 0,
  owned_cars TEXT NOT NULL DEFAULT '0',
  upgrades TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_players_name ON t_p25425030_parking_challenge_ga.players(name);
CREATE INDEX idx_players_xp ON t_p25425030_parking_challenge_ga.players(xp DESC);

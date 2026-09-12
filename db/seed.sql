-- Seed: the one human. No NPC rows exist by design (ONE HUMAN rule).
INSERT INTO players (id) VALUES ('last-human') ON CONFLICT (id) DO NOTHING;
INSERT INTO saves (player_id, pos, era_preset)
VALUES ('last-human', ST_GeogFromText('SRID=4326;POINTZ(8.0 12.5 0)'), 'alternate-prehuman-earth')
ON CONFLICT (player_id) DO NOTHING;

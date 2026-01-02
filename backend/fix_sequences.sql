-- PostgreSQL sequence düzeltme scripti
-- Tüm tabloların sequence'lerini max ID'ye ayarla

-- log_entries zaten düzeltildi
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users), true);
SELECT setval('activity_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM activity_logs), true);
SELECT setval('sessions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM sessions), true);
SELECT setval('peer_handshake_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM peer_handshake_logs), true);

-- Sonuçları göster
SELECT 'users' as tablo, currval('users_id_seq') as sequence_value
UNION ALL
SELECT 'activity_logs', currval('activity_logs_id_seq')
UNION ALL
SELECT 'sessions', currval('sessions_id_seq')
UNION ALL
SELECT 'peer_handshake_logs', currval('peer_handshake_logs_id_seq');

-- Migration 002: MikroTik Sync Özelliği
-- Tarih: 2025-12-29
-- Amaç: İlk kurulumda MikroTik'teki mevcut WireGuard yapılandırmasını database'e import etme

-- ============================================================================
-- ADIM 1: sync_status tablosunu oluştur
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY DEFAULT 1,
    initial_sync_completed BOOLEAN NOT NULL DEFAULT 0,
    last_sync_at TIMESTAMP,
    synced_interface_count INTEGER DEFAULT 0,
    synced_peer_count INTEGER DEFAULT 0,
    sync_errors TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Singleton pattern: sadece 1 kayıt olmalı
INSERT INTO sync_status (id, initial_sync_completed)
VALUES (1, 0)
ON CONFLICT(id) DO NOTHING;

-- ============================================================================
-- ADIM 2: peer_keys tablosunda private_key'i nullable yap
-- ============================================================================
-- SQLite ALTER COLUMN desteklemediği için tablo yeniden oluşturulacak

-- 2.1: Yeni tablo oluştur (private_key nullable)
CREATE TABLE IF NOT EXISTS peer_keys_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    peer_id VARCHAR NOT NULL,
    interface_name VARCHAR NOT NULL,
    public_key VARCHAR NOT NULL UNIQUE,
    private_key TEXT,  -- NULLABLE (MikroTik'ten import için)
    client_allowed_ips TEXT,
    endpoint_address VARCHAR,
    endpoint_port INTEGER,
    template_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2.2: Mevcut verileri kopyala (sadece peer_keys tablosu varsa)
INSERT INTO peer_keys_new (id, peer_id, interface_name, public_key, private_key,
                           client_allowed_ips, endpoint_address, endpoint_port,
                           template_id, created_at, updated_at)
SELECT id, peer_id, interface_name, public_key, private_key,
       client_allowed_ips, endpoint_address, endpoint_port,
       template_id, created_at, updated_at
FROM peer_keys
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='peer_keys');

-- 2.3: Eski tabloyu sil
DROP TABLE IF EXISTS peer_keys;

-- 2.4: Yeni tabloyu adlandır
ALTER TABLE peer_keys_new RENAME TO peer_keys;

-- 2.5: İndeksleri yeniden oluştur
CREATE INDEX IF NOT EXISTS ix_peer_keys_peer_id ON peer_keys(peer_id);
CREATE INDEX IF NOT EXISTS ix_peer_keys_interface_name ON peer_keys(interface_name);
CREATE INDEX IF NOT EXISTS ix_peer_keys_public_key ON peer_keys(public_key);
CREATE INDEX IF NOT EXISTS ix_peer_keys_template_id ON peer_keys(template_id);

-- ============================================================================
-- DOĞRULAMA
-- ============================================================================
-- sync_status tablosu oluşturuldu mu?
-- SELECT COUNT(*) as sync_table_exists FROM sync_status WHERE id = 1;
-- Beklenen: 1

-- peer_keys tablosunda private_key nullable mı?
-- PRAGMA table_info(peer_keys);
-- Beklenen: private_key satırında notnull=0

-- ============================================================================
-- ROLLBACK (gerekirse)
-- ============================================================================
-- Bu migration'ı geri almak için:
-- 1. peer_keys tablosunda private_key NULL olanları sil
-- 2. private_key'i tekrar NOT NULL yap
-- 3. sync_status tablosunu sil
-- Detaylar için: migrations/002_rollback.sql

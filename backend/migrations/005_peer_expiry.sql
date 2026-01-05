-- Migration: Peer Expiry Date Feature
-- Peer'lara son kullanma tarihi ekleme

-- peer_metadata tablosuna expires_at alanı ekle
ALTER TABLE peer_metadata ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- expired_notified: Süresi dolduğunda bildirim gönderildi mi
ALTER TABLE peer_metadata ADD COLUMN IF NOT EXISTS expired_notified BOOLEAN DEFAULT FALSE;

-- expiry_action: Süre dolduğunda yapılacak işlem ('disable', 'delete', 'notify_only')
ALTER TABLE peer_metadata ADD COLUMN IF NOT EXISTS expiry_action VARCHAR(20) DEFAULT 'disable';

-- Index for expiry queries
CREATE INDEX IF NOT EXISTS ix_peer_metadata_expires_at ON peer_metadata(expires_at) WHERE expires_at IS NOT NULL;

-- Expiry date yaklaşan peer'ları bulmak için composite index
CREATE INDEX IF NOT EXISTS ix_peer_metadata_expiry_status ON peer_metadata(expires_at, expired_notified) WHERE expires_at IS NOT NULL;

-- Email notification settings table
-- Bu migration email bildirim ayarları için yeni bir tablo oluşturur.
-- Revision ID: 006_email_settings
-- Revises: 005_peer_expiry
-- Create Date: 2025-01-13

-- Email notification settings table
CREATE TABLE IF NOT EXISTS email_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    
    -- SMTP Configuration
    smtp_host VARCHAR(255),
    smtp_port INTEGER DEFAULT 587,
    smtp_username VARCHAR(255),
    smtp_password VARCHAR(255),  -- Şifrelenmiş
    use_tls BOOLEAN DEFAULT 1,
    use_ssl BOOLEAN DEFAULT 0,
    from_email VARCHAR(255),
    from_name VARCHAR(255) DEFAULT 'WireGuard Manager',
    
    -- Notification Preferences
    notify_backup_success BOOLEAN DEFAULT 1,
    notify_backup_failed BOOLEAN DEFAULT 1,
    notify_peer_added BOOLEAN DEFAULT 0,
    notify_peer_deleted BOOLEAN DEFAULT 0,
    notify_system_alerts BOOLEAN DEFAULT 1,
    
    -- Test Email Tracking
    last_test_email TIMESTAMP,
    test_email_status VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Singleton pattern: sadece id=1 olabilir
    CHECK (id = 1)
);

-- Default ayarları ekle
INSERT OR IGNORE INTO email_settings (id, from_name) VALUES (1, 'WireGuard Manager');

-- Index'ler (performans için)
CREATE INDEX IF NOT EXISTS idx_email_settings_id ON email_settings(id);

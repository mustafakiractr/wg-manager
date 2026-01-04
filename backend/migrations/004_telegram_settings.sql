-- Telegram Notification Settings Table
-- Migration: 004_telegram_settings.sql
-- Created: 2024-12-29
-- Description: Telegram bildirim ayarları için tablo

CREATE TABLE IF NOT EXISTS telegram_settings (
    id SERIAL PRIMARY KEY,
    bot_token VARCHAR(255),
    chat_id VARCHAR(100),
    enabled BOOLEAN DEFAULT FALSE,
    notification_categories TEXT,  -- JSON array as text
    test_message_count INTEGER DEFAULT 0,
    last_notification_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO telegram_settings (id, enabled, notification_categories)
VALUES (1, FALSE, '["peer_down", "mikrotik_disconnect", "backup_failed", "login_failed"]')
ON CONFLICT (id) DO NOTHING;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_telegram_settings_enabled ON telegram_settings(enabled);

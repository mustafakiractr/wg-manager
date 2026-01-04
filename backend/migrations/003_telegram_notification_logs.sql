-- Telegram Notification Logs tablosu
-- Gönderilen tüm Telegram mesajlarını kaydet

CREATE TABLE IF NOT EXISTS telegram_notification_logs (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    chat_id VARCHAR(100) NOT NULL,
    bot_token_preview VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'sent',
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    peer_id VARCHAR(100),
    interface_name VARCHAR(50),
    user_id INTEGER,
    telegram_message_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index'ler (hızlı arama için)
CREATE INDEX IF NOT EXISTS idx_telegram_logs_category ON telegram_notification_logs(category);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_created_at ON telegram_notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_peer_id ON telegram_notification_logs(peer_id);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_interface ON telegram_notification_logs(interface_name);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_user_id ON telegram_notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_success ON telegram_notification_logs(success);

-- Yorum ekle
COMMENT ON TABLE telegram_notification_logs IS 'Gönderilen Telegram bildirimlerinin geçmişi';
COMMENT ON COLUMN telegram_notification_logs.category IS 'Bildirim kategorisi (peer_down, backup_failed, vb.)';
COMMENT ON COLUMN telegram_notification_logs.status IS 'Gönderim durumu (sent, failed)';
COMMENT ON COLUMN telegram_notification_logs.telegram_message_id IS 'Telegram API''den dönen mesaj ID''si';

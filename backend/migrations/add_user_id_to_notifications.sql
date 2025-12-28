-- Migration: Add user_id to notifications table
-- Date: 2025-12-25
-- Purpose: Enable user-specific notifications for WebSocket broadcasting

-- Step 1: Add user_id column
ALTER TABLE notifications ADD COLUMN user_id INTEGER;

-- Step 2: Create index for query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Step 3: Update existing notifications to assign to first admin user
-- This ensures no NULL values before application enforces NOT NULL
UPDATE notifications
SET user_id = (SELECT id FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1)
WHERE user_id IS NULL;

-- Note: SQLite doesn't support adding FOREIGN KEY constraint to existing table
-- The foreign key relationship will be enforced at application level via SQLAlchemy model
-- Future notifications will have user_id set via application logic

-- Verification queries (run separately):
-- SELECT COUNT(*) FROM notifications WHERE user_id IS NULL; -- Should be 0
-- SELECT DISTINCT user_id FROM notifications; -- Should show admin user IDs
-- PRAGMA index_list('notifications'); -- Should show idx_notifications_user_id

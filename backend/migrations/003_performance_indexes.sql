-- Performance Optimization: Database Indexes
-- Created: 2026-01-03
-- Purpose: Improve query performance with strategic indexes

-- Activity Logs Indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs(category);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Peer Keys Indexes
CREATE INDEX IF NOT EXISTS idx_peer_keys_interface ON peer_keys(interface_name);
CREATE INDEX IF NOT EXISTS idx_peer_keys_public_key ON peer_keys(public_key);

-- Peer Metadata Indexes
CREATE INDEX IF NOT EXISTS idx_peer_metadata_interface ON peer_metadata(interface_name);
CREATE INDEX IF NOT EXISTS idx_peer_metadata_group ON peer_metadata(group_name);

-- Peer Handshakes Indexes (table: peer_handshakes)
CREATE INDEX IF NOT EXISTS idx_peer_handshakes_interface ON peer_handshakes(interface_name);
CREATE INDEX IF NOT EXISTS idx_peer_handshakes_event_time ON peer_handshakes(event_time DESC);

-- IP Allocations Indexes
CREATE INDEX IF NOT EXISTS idx_ip_allocations_pool_id ON ip_allocations(pool_id);
CREATE INDEX IF NOT EXISTS idx_ip_allocations_status ON ip_allocations(status);
CREATE INDEX IF NOT EXISTS idx_ip_allocations_peer_id ON ip_allocations(peer_id);

-- Sessions Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);

-- Traffic Logs Indexes (if exists)
-- CREATE INDEX IF NOT EXISTS idx_traffic_logs_interface ON traffic_logs(interface_name);
-- CREATE INDEX IF NOT EXISTS idx_traffic_logs_timestamp ON traffic_logs(timestamp DESC);

-- Authentication System Database Schema for SQLite
-- RoverMissionControl Project

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_verified BOOLEAN DEFAULT 0,
    email_verified_at TIMESTAMP,
    two_factor_enabled BOOLEAN DEFAULT 0,
    two_factor_secret TEXT,
    two_factor_backup_codes TEXT,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMP,
    last_login_at TIMESTAMP,
    last_login_ip TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User-Role association table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Create index for permissions
CREATE INDEX IF NOT EXISTS idx_permissions_role_resource_action ON permissions(role_id, resource, action);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    device_id TEXT,
    device_name TEXT,
    ip_address TEXT,
    is_revoked BOOLEAN DEFAULT 0,
    revoked_at TIMESTAMP,
    revoked_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for refresh tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- Login history table
CREATE TABLE IF NOT EXISTS login_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    country TEXT,
    city TEXT,
    login_successful BOOLEAN DEFAULT 1,
    failure_reason TEXT,
    suspicious_activity_detected BOOLEAN DEFAULT 0,
    suspicious_activity_reason TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for login history
CREATE INDEX IF NOT EXISTS idx_login_history_user_id_login_at ON login_history(user_id, login_at);

-- Insert default roles
INSERT OR IGNORE INTO roles (id, name, description) VALUES 
    ('1', 'admin', 'Full system access'),
    ('2', 'operator', 'Can control rover and view telemetry'),
    ('3', 'viewer', 'Read-only access to telemetry and data'),
    ('4', 'user', 'Basic user access');

-- Insert default permissions for admin role
INSERT OR IGNORE INTO permissions (id, role_id, resource, action) VALUES 
    ('1', '1', '*', '*');  -- Admin has all permissions

-- Insert default permissions for operator role
INSERT OR IGNORE INTO permissions (id, role_id, resource, action) VALUES 
    ('2', '2', 'rover', 'read'),
    ('3', '2', 'rover', 'execute'),
    ('4', '2', 'telemetry', 'read'),
    ('5', '2', 'arduino', 'read'),
    ('6', '2', 'arduino', 'execute'),
    ('7', '2', 'knowledge', 'read'),
    ('8', '2', 'ai', 'read'),
    ('9', '2', 'ai', 'execute');

-- Insert default permissions for viewer role
INSERT OR IGNORE INTO permissions (id, role_id, resource, action) VALUES 
    ('10', '3', 'rover', 'read'),
    ('11', '3', 'telemetry', 'read'),
    ('12', '3', 'knowledge', 'read'),
    ('13', '3', 'ai', 'read');

-- Insert default permissions for user role
INSERT OR IGNORE INTO permissions (id, role_id, resource, action) VALUES 
    ('14', '4', 'telemetry', 'read'),
    ('15', '4', 'knowledge', 'read');

-- Create trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_roles_timestamp 
AFTER UPDATE ON roles
BEGIN
    UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
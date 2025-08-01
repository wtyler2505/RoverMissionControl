-- Enterprise Annotation System Database Schema
-- PostgreSQL 15+ required for gen_random_uuid() and JSONB features

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For composite indexes

-- Create schema
CREATE SCHEMA IF NOT EXISTS annotations;
SET search_path TO annotations, public;

-- =====================================================
-- Core Tables
-- =====================================================

-- Organizations (extends existing auth)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{
        "annotation_retention_days": 365,
        "max_annotations_per_chart": 1000,
        "allow_public_annotations": false,
        "require_approval": false,
        "auto_save_interval": 30
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Annotation Collections
CREATE TABLE IF NOT EXISTS annotation_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL, -- References auth.users
    
    -- Collection settings
    settings JSONB DEFAULT '{
        "default_permissions": "private",
        "version_control": true,
        "require_approval": false,
        "auto_export": false
    }'::jsonb,
    
    -- Metadata
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMP WITH TIME ZONE,
    archived_by UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    UNIQUE(name, organization_id)
);

-- Main Annotations Table
CREATE TABLE IF NOT EXISTS annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES annotation_collections(id) ON DELETE CASCADE,
    
    -- Location identifiers
    chart_id VARCHAR(255) NOT NULL,
    chart_type VARCHAR(100) NOT NULL,
    dashboard_id VARCHAR(255),
    
    -- Annotation type and geometry
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'point', 'line', 'arrow', 'rect', 'text', 
        'polygon', 'ellipse', 'path', 'custom'
    )),
    
    -- Positioning data (supports all annotation types)
    coordinates JSONB NOT NULL,
    -- Examples:
    -- Point: {"x": 100, "y": 200}
    -- Line: {"x1": 100, "y1": 200, "x2": 300, "y2": 400}
    -- Polygon: {"points": [{"x": 100, "y": 200}, ...]}
    -- Path: {"d": "M 100 200 L 300 400 ..."}
    
    -- Chart context for restoration
    chart_context JSONB NOT NULL,
    -- {
    --   "timeRange": {"start": "2024-01-01T00:00:00Z", "end": "2024-01-02T00:00:00Z"},
    --   "valueRange": {"min": 0, "max": 100},
    --   "scale": {"x": "time", "y": "linear"},
    --   "zoom": {"k": 1, "x": 0, "y": 0},
    --   "dimensions": {"width": 800, "height": 400}
    -- }
    
    -- Content
    title VARCHAR(500),
    content TEXT,
    severity VARCHAR(50) CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    -- Can include:
    -- - linked_telemetry_ids
    -- - threshold_values
    -- - statistical_data
    -- - external_references
    
    -- Styling
    style JSONB DEFAULT '{
        "fill": "#2196f3",
        "stroke": "#2196f3",
        "strokeWidth": 2,
        "opacity": 1
    }'::jsonb,
    
    -- Ownership and lifecycle
    created_by UUID NOT NULL,
    updated_by UUID,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Status flags
    is_active BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    is_private BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Full-text search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED
);

-- Indexes for annotations
CREATE INDEX idx_annotations_chart ON annotations(chart_id) WHERE is_deleted = false;
CREATE INDEX idx_annotations_collection ON annotations(collection_id) WHERE is_deleted = false;
CREATE INDEX idx_annotations_created_by ON annotations(created_by);
CREATE INDEX idx_annotations_created_at ON annotations(created_at DESC);
CREATE INDEX idx_annotations_search ON annotations USING GIN(search_vector);
CREATE INDEX idx_annotations_metadata ON annotations USING GIN(metadata);
CREATE INDEX idx_annotations_coordinates ON annotations USING GIN(coordinates);
CREATE INDEX idx_annotations_active ON annotations(is_active, is_deleted, is_approved);

-- =====================================================
-- Versioning System
-- =====================================================

-- Annotation Versions
CREATE TABLE IF NOT EXISTS annotation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annotation_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    
    -- Complete snapshot of annotation at this version
    data JSONB NOT NULL,
    
    -- Change tracking
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN (
        'create', 'update', 'delete', 'restore', 
        'approve', 'reject', 'merge'
    )),
    change_summary TEXT,
    
    -- Diff from previous version
    diff JSONB,
    -- {
    --   "added": {...},
    --   "removed": {...},
    --   "modified": {...}
    -- }
    
    -- Version metadata
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Branch support
    branch_name VARCHAR(255) DEFAULT 'main',
    parent_version_id UUID REFERENCES annotation_versions(id),
    
    -- Merge tracking
    is_merged BOOLEAN DEFAULT false,
    merged_at TIMESTAMP WITH TIME ZONE,
    merged_by UUID,
    merge_commit_id UUID,
    
    -- Approval workflow
    is_approved BOOLEAN DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    
    UNIQUE(annotation_id, version_number, branch_name)
);

-- Indexes for versions
CREATE INDEX idx_annotation_versions_annotation ON annotation_versions(annotation_id);
CREATE INDEX idx_annotation_versions_branch ON annotation_versions(branch_name);
CREATE INDEX idx_annotation_versions_created ON annotation_versions(created_at DESC);

-- Version branches
CREATE TABLE IF NOT EXISTS annotation_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annotation_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Branch metadata
    created_from_version_id UUID REFERENCES annotation_versions(id),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Merge status
    is_merged BOOLEAN DEFAULT false,
    merged_into_branch VARCHAR(255),
    merged_at TIMESTAMP WITH TIME ZONE,
    merged_by UUID,
    
    UNIQUE(annotation_id, name)
);

-- =====================================================
-- Permissions System
-- =====================================================

-- Permission groups
CREATE TABLE IF NOT EXISTS permission_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(name, organization_id)
);

-- Group members
CREATE TABLE IF NOT EXISTS permission_group_members (
    group_id UUID REFERENCES permission_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    added_by UUID NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY(group_id, user_id)
);

-- Annotation permissions
CREATE TABLE IF NOT EXISTS annotation_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Resource identification
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('collection', 'annotation')),
    resource_id UUID NOT NULL,
    
    -- Permission target
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('user', 'group', 'role', 'organization', 'public')),
    target_id UUID, -- NULL for 'public'
    
    -- Permission bits
    can_read BOOLEAN DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    can_update BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    can_approve BOOLEAN DEFAULT false,
    can_share BOOLEAN DEFAULT false,
    can_export BOOLEAN DEFAULT false,
    
    -- Metadata
    granted_by UUID NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    UNIQUE(resource_type, resource_id, target_type, target_id)
);

-- Indexes for permissions
CREATE INDEX idx_permissions_resource ON annotation_permissions(resource_type, resource_id);
CREATE INDEX idx_permissions_target ON annotation_permissions(target_type, target_id);
CREATE INDEX idx_permissions_expires ON annotation_permissions(expires_at) WHERE expires_at IS NOT NULL;

-- =====================================================
-- Audit Trail
-- =====================================================

-- Comprehensive audit log
CREATE TABLE IF NOT EXISTS annotation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    action_category VARCHAR(50) NOT NULL CHECK (action_category IN (
        'create', 'read', 'update', 'delete', 
        'permission', 'export', 'import', 'system'
    )),
    
    -- Resource information
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    resource_name VARCHAR(500),
    
    -- Actor information
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(100),
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    request_id UUID,
    
    -- Change details
    old_value JSONB,
    new_value JSONB,
    diff JSONB,
    
    -- Additional context
    metadata JSONB DEFAULT '{}',
    
    -- Result
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Timestamp and integrity
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Tamper detection
    checksum VARCHAR(64) -- SHA-256 of concatenated fields
);

-- Indexes for audit log
CREATE INDEX idx_audit_user ON annotation_audit_log(user_id);
CREATE INDEX idx_audit_resource ON annotation_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_action ON annotation_audit_log(action, action_category);
CREATE INDEX idx_audit_created ON annotation_audit_log(created_at DESC);
CREATE INDEX idx_audit_ip ON annotation_audit_log(ip_address);

-- Partition audit log by month for performance
-- CREATE TABLE annotation_audit_log_y2024m01 PARTITION OF annotation_audit_log
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- =====================================================
-- Collaboration Features
-- =====================================================

-- Attachments
CREATE TABLE IF NOT EXISTS annotation_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annotation_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
    
    -- File information
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    
    -- Storage
    storage_provider VARCHAR(50) DEFAULT 's3',
    storage_key VARCHAR(500) NOT NULL,
    storage_url TEXT,
    
    -- Metadata
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Security
    is_virus_scanned BOOLEAN DEFAULT false,
    virus_scan_result VARCHAR(50),
    virus_scanned_at TIMESTAMP WITH TIME ZONE,
    
    -- Lifecycle
    uploaded_by UUID NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CHECK (size_bytes > 0 AND size_bytes <= 104857600) -- Max 100MB
);

-- Comments and discussions
CREATE TABLE IF NOT EXISTS annotation_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annotation_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES annotation_comments(id) ON DELETE CASCADE,
    
    -- Content
    content TEXT NOT NULL CHECK (char_length(content) <= 5000),
    content_format VARCHAR(20) DEFAULT 'plain' CHECK (content_format IN ('plain', 'markdown')),
    
    -- Mentions
    mentioned_users UUID[] DEFAULT '{}',
    
    -- Status
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Reactions
    reactions JSONB DEFAULT '{}',
    -- {"thumbsup": ["user1-uuid", "user2-uuid"], "thumbsdown": [...]}
    
    -- Metadata
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Indexes for comments
CREATE INDEX idx_comments_annotation ON annotation_comments(annotation_id) WHERE is_deleted = false;
CREATE INDEX idx_comments_parent ON annotation_comments(parent_comment_id) WHERE is_deleted = false;
CREATE INDEX idx_comments_created_by ON annotation_comments(created_by);
CREATE INDEX idx_comments_mentions ON annotation_comments USING GIN(mentioned_users);

-- Real-time collaboration presence
CREATE TABLE IF NOT EXISTS annotation_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Session info
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    
    -- Location
    chart_id VARCHAR(255) NOT NULL,
    annotation_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
    
    -- Presence data
    cursor_position JSONB,
    -- {"x": 123.45, "y": 67.89, "timestamp": "2024-01-15T10:30:00Z"}
    
    selection JSONB,
    -- {"type": "box", "bounds": {"x1": 10, "y1": 20, "x2": 100, "y2": 200}}
    
    viewport JSONB,
    -- {"x": 0, "y": 0, "width": 800, "height": 600, "zoom": 1.5}
    
    -- Activity
    activity_status VARCHAR(50) DEFAULT 'active' CHECK (activity_status IN ('active', 'idle', 'away')),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Connection
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    connection_metadata JSONB DEFAULT '{}',
    
    UNIQUE(user_id, chart_id)
);

-- Indexes for presence
CREATE INDEX idx_presence_chart ON annotation_presence(chart_id);
CREATE INDEX idx_presence_heartbeat ON annotation_presence(last_heartbeat);
CREATE INDEX idx_presence_user ON annotation_presence(user_id);

-- =====================================================
-- Organization and Categorization
-- =====================================================

-- Tags
CREATE TABLE IF NOT EXISTS annotation_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#2196F3',
    icon VARCHAR(50),
    
    -- Hierarchy
    parent_tag_id UUID REFERENCES annotation_tags(id) ON DELETE SET NULL,
    
    -- Ownership
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    is_system BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(slug, organization_id)
);

-- Tag assignments
CREATE TABLE IF NOT EXISTS annotation_tag_mappings (
    annotation_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES annotation_tags(id) ON DELETE CASCADE,
    
    tagged_by UUID NOT NULL,
    tagged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (annotation_id, tag_id)
);

-- Saved searches
CREATE TABLE IF NOT EXISTS annotation_saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Search criteria
    query JSONB NOT NULL,
    -- {
    --   "text": "critical error",
    --   "tags": ["incident", "production"],
    --   "date_range": {"start": "2024-01-01", "end": "2024-01-31"},
    --   "chart_ids": ["chart1", "chart2"],
    --   "severity": ["error", "critical"]
    -- }
    
    -- Ownership
    created_by UUID NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false,
    
    -- Usage tracking
    last_used_at TIMESTAMP WITH TIME ZONE,
    use_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Integration Tables
-- =====================================================

-- Webhook configurations
CREATE TABLE IF NOT EXISTS annotation_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Configuration
    url TEXT NOT NULL,
    secret VARCHAR(255) NOT NULL,
    events TEXT[] NOT NULL,
    -- ['annotation.created', 'annotation.updated', 'annotation.deleted', 'comment.added']
    
    -- Filters
    filters JSONB DEFAULT '{}',
    -- {"collections": ["uuid1", "uuid2"], "tags": ["incident"], "severity": ["critical"]}
    
    -- Headers
    headers JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    failure_count INTEGER DEFAULT 0,
    
    -- Ownership
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Export configurations
CREATE TABLE IF NOT EXISTS annotation_export_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Export settings
    format VARCHAR(50) NOT NULL CHECK (format IN ('pdf', 'excel', 'csv', 'json', 'xml')),
    template JSONB,
    filters JSONB DEFAULT '{}',
    
    -- Schedule
    schedule_cron VARCHAR(100),
    is_scheduled BOOLEAN DEFAULT false,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    
    -- Delivery
    delivery_method VARCHAR(50) CHECK (delivery_method IN ('email', 's3', 'sftp', 'webhook')),
    delivery_config JSONB,
    
    -- Ownership
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to all tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON annotation_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annotations_updated_at BEFORE UPDATE ON annotations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit log trigger
CREATE OR REPLACE FUNCTION create_audit_log_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_action VARCHAR(100);
    v_old_value JSONB;
    v_new_value JSONB;
BEGIN
    -- Determine action
    IF TG_OP = 'INSERT' THEN
        v_action := TG_TABLE_NAME || '.created';
        v_old_value := NULL;
        v_new_value := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := TG_TABLE_NAME || '.updated';
        v_old_value := to_jsonb(OLD);
        v_new_value := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_action := TG_TABLE_NAME || '.deleted';
        v_old_value := to_jsonb(OLD);
        v_new_value := NULL;
    END IF;
    
    -- Insert audit log entry
    -- Note: This is a simplified version. In production, you'd get user info from session context
    INSERT INTO annotation_audit_log (
        action,
        action_category,
        resource_type,
        resource_id,
        old_value,
        new_value,
        user_id,
        user_email,
        user_name
    ) VALUES (
        v_action,
        LOWER(TG_OP),
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        v_old_value,
        v_new_value,
        COALESCE(NEW.created_by, NEW.updated_by, OLD.created_by, OLD.updated_by, '00000000-0000-0000-0000-000000000000'::uuid),
        'system@rover.mission',
        'System'
    );
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Version creation trigger
CREATE OR REPLACE FUNCTION create_annotation_version()
RETURNS TRIGGER AS $$
DECLARE
    v_version_number INTEGER;
    v_change_type VARCHAR(50);
BEGIN
    -- Determine change type
    IF TG_OP = 'INSERT' THEN
        v_change_type := 'create';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
            v_change_type := 'delete';
        ELSIF OLD.is_deleted = true AND NEW.is_deleted = false THEN
            v_change_type := 'restore';
        ELSE
            v_change_type := 'update';
        END IF;
    END IF;
    
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_version_number
    FROM annotation_versions
    WHERE annotation_id = NEW.id;
    
    -- Create version record
    INSERT INTO annotation_versions (
        annotation_id,
        version_number,
        data,
        change_type,
        created_by
    ) VALUES (
        NEW.id,
        v_version_number,
        to_jsonb(NEW),
        v_change_type,
        COALESCE(NEW.updated_by, NEW.created_by)
    );
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply version trigger to annotations
CREATE TRIGGER create_annotation_version_trigger
    AFTER INSERT OR UPDATE ON annotations
    FOR EACH ROW EXECUTE FUNCTION create_annotation_version();

-- =====================================================
-- Views for Common Queries
-- =====================================================

-- Active annotations with permissions
CREATE OR REPLACE VIEW v_active_annotations AS
SELECT 
    a.*,
    c.name as collection_name,
    c.organization_id,
    array_agg(DISTINCT t.name) as tags,
    count(DISTINCT cm.id) as comment_count,
    count(DISTINCT at.id) as attachment_count
FROM annotations a
LEFT JOIN annotation_collections c ON a.collection_id = c.id
LEFT JOIN annotation_tag_mappings tm ON a.id = tm.annotation_id
LEFT JOIN annotation_tags t ON tm.tag_id = t.id
LEFT JOIN annotation_comments cm ON a.id = cm.annotation_id AND cm.is_deleted = false
LEFT JOIN annotation_attachments at ON a.id = at.annotation_id
WHERE a.is_deleted = false AND a.is_active = true
GROUP BY a.id, c.name, c.organization_id;

-- User permissions view
CREATE OR REPLACE VIEW v_user_permissions AS
SELECT 
    p.target_id as user_id,
    p.resource_type,
    p.resource_id,
    p.can_read,
    p.can_create,
    p.can_update,
    p.can_delete,
    p.can_approve,
    p.can_share,
    p.can_export
FROM annotation_permissions p
WHERE p.target_type = 'user' 
   AND (p.expires_at IS NULL OR p.expires_at > CURRENT_TIMESTAMP)

UNION

SELECT 
    gm.user_id,
    p.resource_type,
    p.resource_id,
    p.can_read,
    p.can_create,
    p.can_update,
    p.can_delete,
    p.can_approve,
    p.can_share,
    p.can_export
FROM annotation_permissions p
JOIN permission_group_members gm ON p.target_id = gm.group_id
WHERE p.target_type = 'group'
   AND (p.expires_at IS NULL OR p.expires_at > CURRENT_TIMESTAMP);

-- =====================================================
-- Sample Data and Defaults
-- =====================================================

-- Insert default tags
INSERT INTO annotation_tags (name, slug, color, is_system, organization_id) VALUES
    ('Incident', 'incident', '#F44336', true, NULL),
    ('Maintenance', 'maintenance', '#FF9800', true, NULL),
    ('Performance', 'performance', '#2196F3', true, NULL),
    ('Security', 'security', '#9C27B0', true, NULL),
    ('Configuration', 'configuration', '#4CAF50', true, NULL)
ON CONFLICT (slug, organization_id) DO NOTHING;

-- Grant table
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA annotations TO rover_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA annotations TO rover_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA annotations TO rover_app;
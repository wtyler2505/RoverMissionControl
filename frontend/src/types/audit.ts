// Audit log types and interfaces

export enum AuditCategory {
  API_KEY = 'api_key',
  CORS = 'cors',
  RATE_LIMIT = 'rate_limit',
  SCHEMA_VALIDATION = 'schema_validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  CONFIGURATION = 'configuration',
  DATA_ACCESS = 'data_access',
  SYSTEM = 'system'
}

export enum AuditSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum ComplianceFramework {
  SOX = 'sox',
  PCI_DSS = 'pci_dss',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  ISO_27001 = 'iso_27001',
  CCPA = 'ccpa'
}

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  XML = 'xml',
  SYSLOG = 'syslog'
}

export enum AlertType {
  THRESHOLD = 'threshold',
  PATTERN = 'pattern',
  ANOMALY = 'anomaly',
  CUSTOM = 'custom'
}

export interface AuditLog {
  id: string;
  timestamp: string;
  category: AuditCategory;
  event_type: string;
  severity: AuditSeverity;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  actor_ip: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  action: string;
  result: 'success' | 'failure' | 'partial';
  error_message?: string;
  before_snapshot?: any;
  after_snapshot?: any;
  metadata?: Record<string, any>;
  request_id?: string;
  session_id?: string;
  user_agent?: string;
  compliance_flags: ComplianceFramework[];
  tags: string[];
  checksum?: string;
  signature?: string;
}

export interface AuditDashboardStats {
  total_events: number;
  events_by_category: Record<AuditCategory, number>;
  events_by_severity: Record<AuditSeverity, number>;
  recent_critical_events: AuditLog[];
  top_actors: Array<{ actor_id: string; actor_name: string; event_count: number }>;
  compliance_summary: Record<ComplianceFramework, {
    total_events: number;
    retention_days: number;
    next_archive_date: string;
  }>;
  trend_data: Array<{
    date: string;
    total: number;
    by_category: Record<AuditCategory, number>;
  }>;
}

export interface AuditSearchParams {
  start_date?: string;
  end_date?: string;
  categories?: AuditCategory[];
  severities?: AuditSeverity[];
  actor_id?: string;
  target_id?: string;
  event_types?: string[];
  search_text?: string;
  compliance_frameworks?: ComplianceFramework[];
  tags?: string[];
  result?: 'success' | 'failure' | 'partial';
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface AuditAlert {
  id: string;
  name: string;
  description?: string;
  alert_type: AlertType;
  is_active: boolean;
  category?: AuditCategory;
  severity_threshold?: AuditSeverity;
  event_types?: string[];
  condition_config: Record<string, any>;
  notification_channels: string[];
  notification_config: Record<string, any>;
  cooldown_minutes: number;
  auto_response?: string;
  created_at: string;
  updated_at: string;
  last_triggered?: string;
  trigger_count: number;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  description?: string;
  compliance_framework?: ComplianceFramework;
  categories: AuditCategory[];
  retention_days: number;
  archive_after_days?: number;
  delete_after_days: number;
  is_active: boolean;
  legal_hold: boolean;
  created_at: string;
  updated_at: string;
  applied_count: number;
}

export interface AuditExport {
  id: string;
  export_type: 'manual' | 'scheduled' | 'compliance';
  format: ExportFormat;
  filters: AuditSearchParams;
  compliance_framework?: ComplianceFramework;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_path?: string;
  file_size?: number;
  record_count?: number;
  exported_by: string;
  exported_at: string;
  expires_at?: string;
  encryption_enabled: boolean;
  compression_enabled: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
}

export interface ComplianceReport {
  id: string;
  framework: ComplianceFramework;
  report_period_start: string;
  report_period_end: string;
  generated_at: string;
  generated_by: string;
  status: 'draft' | 'final' | 'submitted';
  total_events: number;
  events_by_category: Record<AuditCategory, number>;
  retention_compliance: {
    compliant: boolean;
    issues: string[];
  };
  access_controls: {
    compliant: boolean;
    unauthorized_attempts: number;
  };
  data_integrity: {
    compliant: boolean;
    tampered_records: number;
  };
  recommendations: string[];
  attachments: Array<{
    name: string;
    type: string;
    path: string;
  }>;
}

export interface AuditTimelineEvent {
  timestamp: string;
  logs: AuditLog[];
  grouped_by?: 'actor' | 'target' | 'category';
}

export interface AuditAnalytics {
  timeRange: {
    start: string;
    end: string;
  };
  eventFrequency: Array<{
    timestamp: string;
    count: number;
    category?: AuditCategory;
  }>;
  topEvents: Array<{
    event_type: string;
    count: number;
    percentage: number;
  }>;
  securityMetrics: {
    failed_auth_attempts: number;
    unauthorized_access_attempts: number;
    policy_violations: number;
    suspicious_patterns: number;
  };
  complianceMetrics: Record<ComplianceFramework, {
    coverage: number;
    gaps: string[];
    recommendations: string[];
  }>;
}
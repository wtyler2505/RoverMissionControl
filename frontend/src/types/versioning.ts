// TypeScript types for API versioning and encryption management

export interface APIVersion {
  id: string;
  version: string;
  title: string;
  description?: string;
  status: VersionStatus;
  releaseDate: string;
  deprecationDate?: string;
  eolDate?: string;
  isDefault: boolean;
  breakingChanges: string[];
  features: string[];
  compatibleVersions: string[];
  apiSpec?: object;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export enum VersionStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  RETIRED = 'retired'
}

export interface VersionStrategy {
  id: string;
  name: string;
  type: VersionStrategyType;
  isActive: boolean;
  configuration: VersionStrategyConfig;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export enum VersionStrategyType {
  URI_BASED = 'uri_based',
  HEADER_BASED = 'header_based',
  QUERY_PARAM = 'query_param',
  CONTENT_TYPE = 'content_type',
  CUSTOM = 'custom'
}

export interface VersionStrategyConfig {
  // URI-based configuration
  pathPattern?: string;
  pathPrefix?: string;
  
  // Header-based configuration
  headerName?: string;
  defaultVersion?: string;
  
  // Query parameter configuration
  paramName?: string;
  
  // Content-type configuration
  mediaTypePattern?: string;
  
  // Custom configuration
  customLogic?: string;
  validationRules?: string[];
}

export interface VersionMigration {
  id: string;
  fromVersion: string;
  toVersion: string;
  title: string;
  description?: string;
  migrationSteps: MigrationStep[];
  status: MigrationStatus;
  compatibility: CompatibilityLevel;
  estimatedDuration?: number;
  executionLog?: MigrationExecutionLog[];
  rollbackPlan?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface MigrationStep {
  id: string;
  order: number;
  title: string;
  description: string;
  type: MigrationStepType;
  automated: boolean;
  script?: string;
  estimatedDuration?: number;
  dependencies?: string[];
  validationRules?: string[];
}

export enum MigrationStepType {
  SCHEMA_CHANGE = 'schema_change',
  ENDPOINT_CHANGE = 'endpoint_change',
  DATA_MIGRATION = 'data_migration',
  CONFIGURATION = 'configuration',
  VALIDATION = 'validation',
  CLEANUP = 'cleanup'
}

export enum MigrationStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back'
}

export enum CompatibilityLevel {
  FULLY_COMPATIBLE = 'fully_compatible',
  BACKWARD_COMPATIBLE = 'backward_compatible',
  BREAKING_CHANGES = 'breaking_changes',
  INCOMPATIBLE = 'incompatible'
}

export interface MigrationExecutionLog {
  id: string;
  stepId: string;
  status: MigrationStepStatus;
  startTime: string;
  endTime?: string;
  output?: string;
  error?: string;
  executedBy: string;
}

export enum MigrationStepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface EncryptionConfig {
  id: string;
  name: string;
  type: EncryptionType;
  algorithm: EncryptionAlgorithm;
  keySize: number;
  isActive: boolean;
  configuration: EncryptionConfigDetails;
  complianceFrameworks: string[];
  rotationPolicy?: KeyRotationPolicy;
  hsm?: HSMConfig;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export enum EncryptionType {
  IN_TRANSIT = 'in_transit',
  AT_REST = 'at_rest',
  FIELD_LEVEL = 'field_level',
  END_TO_END = 'end_to_end'
}

export enum EncryptionAlgorithm {
  AES_256_GCM = 'aes_256_gcm',
  AES_256_CBC = 'aes_256_cbc',
  CHACHA20_POLY1305 = 'chacha20_poly1305',
  RSA_4096 = 'rsa_4096',
  ECC_P256 = 'ecc_p256',
  ECC_P384 = 'ecc_p384'
}

export interface EncryptionConfigDetails {
  // TLS configuration for in-transit
  tlsVersion?: string;
  cipherSuites?: string[];
  
  // Field-level encryption
  encryptedFields?: string[];
  keyDerivation?: KeyDerivationConfig;
  
  // General settings
  compressionEnabled?: boolean;
  integrityChecks?: boolean;
  keyEscrow?: boolean;
}

export interface KeyDerivationConfig {
  algorithm: string;
  iterations: number;
  saltLength: number;
}

export interface KeyRotationPolicy {
  enabled: boolean;
  frequency: RotationFrequency;
  gracePeriod: number; // in hours
  autoRotate: boolean;
  notificationPeriod: number; // hours before rotation
  retainOldKeys: number; // number of old keys to retain
}

export enum RotationFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
  CUSTOM = 'custom'
}

export interface HSMConfig {
  enabled: boolean;
  provider: string;
  endpoint?: string;
  keyLabel?: string;
  authMethod: string;
  configuration: Record<string, any>;
}

export interface EncryptionKey {
  id: string;
  name: string;
  type: KeyType;
  algorithm: EncryptionAlgorithm;
  keySize: number;
  status: KeyStatus;
  purpose: KeyPurpose[];
  createdAt: string;
  expiresAt?: string;
  rotatedAt?: string;
  usageCount: number;
  maxUsage?: number;
  compromisedAt?: string;
  storageLocation: KeyStorageLocation;
  hsm?: HSMConfig;
  accessControl: KeyAccessControl;
  metadata: KeyMetadata;
}

export enum KeyType {
  SYMMETRIC = 'symmetric',
  ASYMMETRIC_PUBLIC = 'asymmetric_public',
  ASYMMETRIC_PRIVATE = 'asymmetric_private',
  MASTER_KEY = 'master_key',
  DATA_KEY = 'data_key'
}

export enum KeyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  COMPROMISED = 'compromised',
  REVOKED = 'revoked',
  PENDING_ROTATION = 'pending_rotation'
}

export enum KeyPurpose {
  ENCRYPTION = 'encryption',
  DECRYPTION = 'decryption',
  SIGNING = 'signing',
  VERIFICATION = 'verification',
  KEY_WRAPPING = 'key_wrapping',
  KEY_UNWRAPPING = 'key_unwrapping'
}

export enum KeyStorageLocation {
  DATABASE = 'database',
  HSM = 'hsm',
  KEY_VAULT = 'key_vault',
  FILE_SYSTEM = 'file_system',
  ENVIRONMENT = 'environment'
}

export interface KeyAccessControl {
  allowedRoles: string[];
  allowedUsers: string[];
  allowedApplications: string[];
  accessLevel: KeyAccessLevel;
  requireMFA: boolean;
  auditAccess: boolean;
}

export enum KeyAccessLevel {
  READ_ONLY = 'read_only',
  USE_ONLY = 'use_only',
  FULL_ACCESS = 'full_access',
  ADMIN = 'admin'
}

export interface KeyMetadata {
  tags: Record<string, string>;
  description?: string;
  owner: string;
  costCenter?: string;
  environment: string;
  compliance: string[];
}

export interface VersionUsageMetrics {
  version: string;
  totalRequests: number;
  requestsLast24h: number;
  requestsLast7d: number;
  requestsLast30d: number;
  avgResponseTime: number;
  errorRate: number;
  uniqueClients: number;
  topEndpoints: EndpointUsage[];
  geographicDistribution: GeographicUsage[];
  featureUsage: FeatureUsage[];
  resourceUtilization: ResourceUsage;
  trends: UsageTrend[];
}

export interface EndpointUsage {
  endpoint: string;
  method: string;
  requests: number;
  avgResponseTime: number;
  errorRate: number;
}

export interface GeographicUsage {
  country: string;
  region?: string;
  requests: number;
  percentage: number;
}

export interface FeatureUsage {
  feature: string;
  usageCount: number;
  uniqueUsers: number;
  adoptionRate: number;
}

export interface ResourceUsage {
  cpuUsage: number;
  memoryUsage: number;
  networkBandwidth: number;
  storageUsage: number;
}

export interface UsageTrend {
  date: string;
  requests: number;
  responseTime: number;
  errorRate: number;
}

export interface ComplianceStatus {
  framework: string;
  status: ComplianceState;
  lastAssessment: string;
  nextAssessment: string;
  requirements: ComplianceRequirement[];
  violations: ComplianceViolation[];
  score: number;
  remediationActions: RemediationAction[];
}

export enum ComplianceState {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIAL_COMPLIANCE = 'partial_compliance',
  ASSESSMENT_PENDING = 'assessment_pending',
  REMEDIATION_IN_PROGRESS = 'remediation_in_progress'
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  status: RequirementStatus;
  evidence?: string[];
  lastChecked: string;
  automatedCheck: boolean;
}

export enum RequirementStatus {
  MET = 'met',
  NOT_MET = 'not_met',
  PARTIALLY_MET = 'partially_met',
  NOT_APPLICABLE = 'not_applicable',
  PENDING_REVIEW = 'pending_review'
}

export interface ComplianceViolation {
  id: string;
  requirement: string;
  severity: ViolationSeverity;
  description: string;
  detectedAt: string;
  resolvedAt?: string;
  assignedTo?: string;
  status: ViolationStatus;
}

export enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ViolationStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  ACKNOWLEDGED = 'acknowledged',
  FALSE_POSITIVE = 'false_positive'
}

export interface RemediationAction {
  id: string;
  title: string;
  description: string;
  priority: ActionPriority;
  estimatedEffort: string;
  assignedTo?: string;
  dueDate: string;
  status: ActionStatus;
  dependencies?: string[];
}

export enum ActionPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum ActionStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled'
}

// Form and UI types
export interface VersionFormData {
  version: string;
  title: string;
  description: string;
  status: VersionStatus;
  releaseDate: string;
  deprecationDate?: string;
  eolDate?: string;
  isDefault: boolean;
  breakingChanges: string[];
  features: string[];
  compatibleVersions: string[];
  apiSpec?: File | object;
}

export interface StrategyFormData {
  name: string;
  type: VersionStrategyType;
  description: string;
  configuration: VersionStrategyConfig;
}

export interface EncryptionFormData {
  name: string;
  type: EncryptionType;
  algorithm: EncryptionAlgorithm;
  keySize: number;
  configuration: EncryptionConfigDetails;
  complianceFrameworks: string[];
  rotationPolicy?: KeyRotationPolicy;
  hsm?: HSMConfig;
}

export interface KeyFormData {
  name: string;
  type: KeyType;
  algorithm: EncryptionAlgorithm;
  keySize: number;
  purpose: KeyPurpose[];
  expiresAt?: string;
  maxUsage?: number;
  storageLocation: KeyStorageLocation;
  accessControl: KeyAccessControl;
  metadata: KeyMetadata;
}

// Filter and search types
export interface VersionFilter {
  status?: VersionStatus[];
  searchTerm?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  compatibility?: CompatibilityLevel[];
  hasBreakingChanges?: boolean;
}

export interface MigrationFilter {
  status?: MigrationStatus[];
  compatibility?: CompatibilityLevel[];
  fromVersion?: string;
  toVersion?: string;
  searchTerm?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface EncryptionFilter {
  type?: EncryptionType[];
  algorithm?: EncryptionAlgorithm[];
  status?: boolean;
  complianceFramework?: string[];
  searchTerm?: string;
}

export interface KeyFilter {
  type?: KeyType[];
  status?: KeyStatus[];
  algorithm?: EncryptionAlgorithm[];
  purpose?: KeyPurpose[];
  storageLocation?: KeyStorageLocation[];
  expiringBefore?: string;
  searchTerm?: string;
}

// API response types
export interface APIResponse<T> {
  data: T;
  message?: string;
  success: boolean;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters?: Record<string, any>;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

// Chart and analytics types
export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
  color?: string;
}

export interface UsageChart {
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  data: ChartDataPoint[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface DashboardStats {
  totalVersions: number;
  activeVersions: number;
  deprecatedVersions: number;
  retiredVersions: number;
  totalRequests24h: number;
  avgResponseTime: number;
  errorRate: number;
  encryptionCoverage: number;
  complianceScore: number;
  activeKeys: number;
  keysNearExpiry: number;
  pendingMigrations: number;
}
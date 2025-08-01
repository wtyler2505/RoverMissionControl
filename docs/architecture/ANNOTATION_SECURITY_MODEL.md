# Annotation System Security Model

## Overview

This document details the security architecture for the enterprise annotation system, covering authentication, authorization, data protection, and compliance requirements.

## Table of Contents

1. [Security Principles](#security-principles)
2. [Authentication](#authentication)
3. [Authorization Model](#authorization-model)
4. [Data Protection](#data-protection)
5. [Audit and Compliance](#audit-and-compliance)
6. [Security Implementation](#security-implementation)
7. [Threat Model](#threat-model)
8. [Incident Response](#incident-response)

## Security Principles

### Defense in Depth
- Multiple layers of security controls
- Redundant protection mechanisms
- Fail-secure defaults

### Least Privilege
- Users get minimum necessary permissions
- Time-limited access where appropriate
- Regular permission reviews

### Zero Trust
- Verify every request
- Assume breach mindset
- Continuous validation

### Data Minimization
- Collect only necessary data
- Retention policies enforced
- Secure deletion procedures

## Authentication

### JWT Token Structure
```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "2024-01-key"
  },
  "payload": {
    "sub": "user-uuid",
    "email": "user@rover.mission",
    "name": "User Name",
    "roles": ["contributor", "reviewer"],
    "org_id": "org-uuid",
    "permissions": {
      "annotations": ["read", "create", "update"],
      "collections": ["read"]
    },
    "iat": 1704067200,
    "exp": 1704070800,
    "iss": "https://auth.rovermission.control",
    "aud": "annotation-api",
    "jti": "session-uuid"
  },
  "signature": "..."
}
```

### Token Management
```typescript
interface TokenConfig {
  accessToken: {
    expiresIn: '15m',
    algorithm: 'RS256',
    issuer: 'https://auth.rovermission.control',
    audience: 'annotation-api'
  },
  refreshToken: {
    expiresIn: '7d',
    algorithm: 'RS256',
    rotateOnUse: true
  },
  idToken: {
    expiresIn: '1h',
    includeProfile: true
  }
}
```

### Multi-Factor Authentication
```typescript
interface MFAConfig {
  required: boolean;
  methods: ['totp', 'sms', 'webauthn'];
  gracePeriod: '24h';
  rememberDevice: boolean;
  riskBasedEnforcement: boolean;
}
```

## Authorization Model

### RBAC + ABAC Hybrid
```typescript
// Role-Based Access Control
interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  inherits?: string[]; // Role inheritance
}

// Attribute-Based Access Control
interface Policy {
  id: string;
  effect: 'allow' | 'deny';
  principal: PrincipalMatcher;
  action: ActionMatcher;
  resource: ResourceMatcher;
  condition?: Condition;
}

interface PrincipalMatcher {
  type: 'user' | 'group' | 'role' | 'any';
  id?: string;
  attributes?: Record<string, any>;
}

interface ActionMatcher {
  operations: string[]; // ['read', 'create', 'update', 'delete']
  scope?: string; // 'own' | 'team' | 'all'
}

interface ResourceMatcher {
  type: 'annotation' | 'collection' | 'comment';
  id?: string;
  attributes?: Record<string, any>;
}

interface Condition {
  ipRange?: string[];
  timeRange?: { start: string; end: string };
  mfaRequired?: boolean;
  custom?: string; // CEL expression
}
```

### Permission Hierarchy
```yaml
permissions:
  # Super admin - full system access
  admin:
    - "*"
  
  # Organization admin
  org_admin:
    - "organizations:*"
    - "collections:*"
    - "annotations:*"
    - "permissions:manage"
    - "audit:read"
  
  # Collection manager
  collection_manager:
    - "collections:create"
    - "collections:update:assigned"
    - "collections:delete:assigned"
    - "annotations:*:collection"
    - "permissions:grant:collection"
  
  # Reviewer
  reviewer:
    - "annotations:read"
    - "annotations:create"
    - "annotations:update"
    - "annotations:approve"
    - "comments:*"
    - "versions:restore"
  
  # Contributor
  contributor:
    - "annotations:read"
    - "annotations:create"
    - "annotations:update:own"
    - "comments:create"
    - "attachments:upload"
  
  # Viewer
  viewer:
    - "annotations:read"
    - "comments:read"
    - "attachments:download"
```

### Dynamic Permission Evaluation
```typescript
class PermissionEvaluator {
  async evaluate(context: EvaluationContext): Promise<Decision> {
    // 1. Check explicit denials
    const denials = await this.checkDenials(context);
    if (denials.length > 0) {
      return { allowed: false, reason: 'Explicit denial', denials };
    }
    
    // 2. Check role-based permissions
    const rolePermissions = await this.checkRolePermissions(context);
    
    // 3. Check attribute-based policies
    const policies = await this.evaluatePolicies(context);
    
    // 4. Check resource-specific permissions
    const resourcePermissions = await this.checkResourcePermissions(context);
    
    // 5. Combine decisions
    const decision = this.combineDecisions([
      rolePermissions,
      policies,
      resourcePermissions
    ]);
    
    // 6. Audit the decision
    await this.auditDecision(context, decision);
    
    return decision;
  }
}
```

## Data Protection

### Encryption at Rest
```yaml
encryption:
  database:
    algorithm: AES-256-GCM
    key_management: AWS KMS
    key_rotation: 90d
    fields:
      - annotations.content
      - annotations.metadata
      - annotation_comments.content
      - annotation_audit_log.old_value
      - annotation_audit_log.new_value
  
  file_storage:
    provider: S3
    encryption: SSE-KMS
    key_id: "arn:aws:kms:region:account:key/uuid"
    bucket_policy: enforce_encryption
```

### Encryption in Transit
```yaml
tls:
  version: "1.3"
  cipher_suites:
    - TLS_AES_256_GCM_SHA384
    - TLS_CHACHA20_POLY1305_SHA256
    - TLS_AES_128_GCM_SHA256
  certificate:
    provider: "Let's Encrypt"
    renewal: automatic
    hsts:
      enabled: true
      max_age: 31536000
      include_subdomains: true
      preload: true
```

### Field-Level Encryption
```typescript
interface FieldEncryption {
  // Sensitive fields encrypted at application level
  fields: {
    'annotations.metadata.sensitive_data': {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      searchable: false
    },
    'audit_log.ip_address': {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'HKDF',
      searchable: true, // Using blind indexing
      blindIndex: {
        algorithm: 'HMAC-SHA256',
        key: 'separate-index-key'
      }
    }
  }
}
```

### Data Masking
```typescript
interface DataMasking {
  rules: [
    {
      field: 'user.email',
      mask: 'partial', // j***@example.com
      roles: ['viewer', 'contributor']
    },
    {
      field: 'audit_log.ip_address',
      mask: 'subnet', // 192.168.0.0/24
      roles: ['reviewer']
    },
    {
      field: 'annotations.metadata.pii',
      mask: 'full', // ***
      roles: ['viewer', 'contributor', 'reviewer']
    }
  ]
}
```

## Audit and Compliance

### Audit Log Schema
```typescript
interface AuditEntry {
  // Immutable fields
  id: string;
  timestamp: ISO8601;
  
  // Actor information
  actor: {
    id: string;
    type: 'user' | 'system' | 'api_key';
    email?: string;
    name?: string;
    roles: string[];
    session_id: string;
  };
  
  // Action details
  action: {
    type: string; // 'annotation.created', 'permission.granted', etc.
    category: 'create' | 'read' | 'update' | 'delete' | 'admin';
    risk_level: 'low' | 'medium' | 'high' | 'critical';
  };
  
  // Resource information
  resource: {
    type: string;
    id: string;
    name?: string;
    owner?: string;
    classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  };
  
  // Request context
  context: {
    ip_address: string; // Encrypted
    user_agent: string;
    geo_location?: {
      country: string;
      region: string;
      city: string;
    };
    request_id: string;
    correlation_id?: string;
  };
  
  // Change details
  changes?: {
    before?: any; // Encrypted
    after?: any; // Encrypted
    diff?: any;
    data_classification?: string;
  };
  
  // Result
  result: {
    status: 'success' | 'failure' | 'partial';
    error?: string;
    duration_ms: number;
  };
  
  // Compliance
  compliance: {
    regulations: string[]; // ['GDPR', 'SOC2', 'HIPAA']
    data_residency: string;
    retention_period: string;
  };
  
  // Integrity
  integrity: {
    checksum: string; // SHA-256 of concatenated fields
    previous_checksum: string; // Chain integrity
    signature?: string; // Digital signature for critical events
  };
}
```

### Compliance Framework
```yaml
compliance:
  gdpr:
    enabled: true
    features:
      - right_to_access
      - right_to_rectification
      - right_to_erasure
      - right_to_portability
      - consent_management
    data_retention:
      annotations: 365d
      audit_logs: 2555d # 7 years
      user_data: until_deletion_request
    anonymization:
      method: k-anonymity
      k_value: 5
  
  sox:
    enabled: true
    features:
      - financial_data_controls
      - change_management
      - access_reviews
    audit_retention: 7y
  
  hipaa:
    enabled: false
    features:
      - phi_encryption
      - access_controls
      - audit_controls
      - transmission_security
```

### Tamper Detection
```typescript
class TamperDetection {
  async verifyIntegrity(auditLog: AuditEntry): Promise<IntegrityResult> {
    // 1. Verify checksum
    const calculatedChecksum = this.calculateChecksum(auditLog);
    if (calculatedChecksum !== auditLog.integrity.checksum) {
      return { valid: false, reason: 'Checksum mismatch' };
    }
    
    // 2. Verify chain integrity
    const previousEntry = await this.getPreviousEntry(auditLog.id);
    if (previousEntry && 
        previousEntry.integrity.checksum !== auditLog.integrity.previous_checksum) {
      return { valid: false, reason: 'Chain integrity broken' };
    }
    
    // 3. Verify signature (for critical events)
    if (auditLog.integrity.signature) {
      const signatureValid = await this.verifySignature(
        auditLog,
        auditLog.integrity.signature
      );
      if (!signatureValid) {
        return { valid: false, reason: 'Invalid signature' };
      }
    }
    
    // 4. Check for gaps
    const hasGaps = await this.checkForGaps(auditLog.id);
    if (hasGaps) {
      return { valid: false, reason: 'Sequence gaps detected' };
    }
    
    return { valid: true };
  }
}
```

## Security Implementation

### Input Validation
```typescript
interface ValidationRules {
  annotation: {
    title: {
      type: 'string',
      maxLength: 500,
      pattern: /^[\w\s\-\.,:;!?\'"]+$/,
      sanitize: ['trim', 'escape_html']
    },
    content: {
      type: 'string',
      maxLength: 10000,
      sanitize: ['trim', 'escape_html', 'remove_scripts']
    },
    coordinates: {
      type: 'object',
      schema: CoordinatesSchema,
      custom: validateCoordinateBounds
    },
    metadata: {
      type: 'object',
      maxSize: '1MB',
      sanitize: ['remove_null_bytes', 'validate_json']
    }
  }
}
```

### Rate Limiting
```typescript
interface RateLimitConfig {
  global: {
    windowMs: 60000, // 1 minute
    max: 1000, // requests per window
    standardHeaders: true,
    legacyHeaders: false
  },
  
  endpoints: {
    '/api/v1/annotations': {
      POST: { windowMs: 60000, max: 60 }, // 60 creates per minute
      GET: { windowMs: 60000, max: 600 }   // 600 reads per minute
    },
    '/api/v1/annotations/search': {
      POST: { windowMs: 60000, max: 30 }   // 30 searches per minute
    },
    '/api/v1/annotations/export': {
      POST: { windowMs: 3600000, max: 10 } // 10 exports per hour
    }
  },
  
  user_tiers: {
    free: { multiplier: 1 },
    pro: { multiplier: 10 },
    enterprise: { multiplier: 100 }
  }
}
```

### CORS Configuration
```typescript
interface CORSConfig {
  origin: (origin: string, callback: Function) => {
    const allowedOrigins = [
      'https://rovermission.control',
      'https://*.rovermission.control'
    ];
    
    if (!origin || allowedOrigins.some(allowed => 
      origin.match(new RegExp(allowed.replace('*', '.*'))))) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
}
```

### SQL Injection Prevention
```typescript
class SecureQueryBuilder {
  async findAnnotations(filters: AnnotationFilters): Promise<Annotation[]> {
    // Use parameterized queries
    const query = `
      SELECT * FROM annotations
      WHERE chart_id = $1
        AND created_at >= $2
        AND created_at <= $3
        AND ($4::text[] IS NULL OR tags && $4)
        AND is_deleted = false
      ORDER BY created_at DESC
      LIMIT $5 OFFSET $6
    `;
    
    const params = [
      filters.chart_id,
      filters.date_range.start,
      filters.date_range.end,
      filters.tags || null,
      Math.min(filters.limit || 20, 100),
      ((filters.page || 1) - 1) * (filters.limit || 20)
    ];
    
    // Additional validation
    this.validateQueryParams(params);
    
    return await this.db.query(query, params);
  }
}
```

### XSS Prevention
```typescript
class XSSProtection {
  sanitizeAnnotation(annotation: AnnotationCreate): AnnotationCreate {
    return {
      ...annotation,
      title: DOMPurify.sanitize(annotation.title, { ALLOWED_TAGS: [] }),
      content: DOMPurify.sanitize(annotation.content, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target'],
        ALLOW_DATA_ATTR: false
      }),
      metadata: this.sanitizeObject(annotation.metadata)
    };
  }
  
  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object') return obj;
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = DOMPurify.sanitize(key, { ALLOWED_TAGS: [] });
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });
      } else if (typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    return sanitized;
  }
}
```

## Threat Model

### STRIDE Analysis

#### Spoofing
- **Threat**: Attacker impersonates legitimate user
- **Controls**: 
  - Strong authentication (MFA)
  - Session management
  - IP allowlisting for sensitive operations
  - Device fingerprinting

#### Tampering
- **Threat**: Unauthorized modification of annotations
- **Controls**:
  - Input validation
  - Integrity checks
  - Audit logging
  - Version control
  - Digital signatures for critical annotations

#### Repudiation
- **Threat**: User denies performing action
- **Controls**:
  - Comprehensive audit logging
  - Digital signatures
  - Timestamp server integration
  - Chain of custody for evidence

#### Information Disclosure
- **Threat**: Unauthorized access to sensitive data
- **Controls**:
  - Encryption at rest and in transit
  - Access controls
  - Data masking
  - Secure key management
  - Network segmentation

#### Denial of Service
- **Threat**: System availability compromise
- **Controls**:
  - Rate limiting
  - Resource quotas
  - Circuit breakers
  - Auto-scaling
  - DDoS protection

#### Elevation of Privilege
- **Threat**: Unauthorized privilege escalation
- **Controls**:
  - Principle of least privilege
  - Role separation
  - Regular permission audits
  - Privilege access management

### Attack Scenarios

#### Scenario 1: Malicious Annotation Injection
```typescript
// Attack vector
const maliciousAnnotation = {
  title: "<script>alert('XSS')</script>",
  content: "Click here: javascript:stealCookies()",
  metadata: {
    exploit: "../../etc/passwd"
  }
};

// Defense
const sanitized = xssProtection.sanitizeAnnotation(maliciousAnnotation);
const validated = validator.validateAnnotation(sanitized);
const stored = await annotationService.create(validated);
```

#### Scenario 2: Permission Bypass
```typescript
// Attack vector
const forgedRequest = {
  headers: {
    'X-User-Id': 'admin-uuid',
    'X-Forwarded-For': '127.0.0.1'
  }
};

// Defense
const token = await authService.validateToken(request.headers.authorization);
const permissions = await permissionService.getUserPermissions(token.sub);
const allowed = await permissionEvaluator.evaluate({
  user: token,
  action: 'delete',
  resource: annotation,
  context: request
});
```

## Incident Response

### Incident Classification
```yaml
severity_levels:
  critical:
    description: "Immediate threat to system integrity or data security"
    response_time: "15 minutes"
    examples:
      - "Unauthorized admin access"
      - "Data breach detected"
      - "Ransomware infection"
  
  high:
    description: "Significant security impact"
    response_time: "1 hour"
    examples:
      - "Suspicious authentication patterns"
      - "Privilege escalation attempt"
      - "SQL injection detected"
  
  medium:
    description: "Moderate security concern"
    response_time: "4 hours"
    examples:
      - "Failed authentication spike"
      - "Unusual data access patterns"
      - "Policy violation"
  
  low:
    description: "Minor security event"
    response_time: "24 hours"
    examples:
      - "Invalid input attempts"
      - "Configuration drift"
      - "Expired certificates"
```

### Response Procedures
```typescript
class IncidentResponse {
  async handleIncident(incident: SecurityIncident): Promise<void> {
    // 1. Contain
    await this.containThreat(incident);
    
    // 2. Assess
    const impact = await this.assessImpact(incident);
    
    // 3. Notify
    await this.notifyStakeholders(incident, impact);
    
    // 4. Eradicate
    await this.eradicateThreat(incident);
    
    // 5. Recover
    await this.recoverSystems(incident);
    
    // 6. Review
    await this.postIncidentReview(incident);
  }
  
  private async containThreat(incident: SecurityIncident): Promise<void> {
    switch (incident.type) {
      case 'unauthorized_access':
        await this.revokeUserSessions(incident.actor);
        await this.blockIPAddress(incident.source_ip);
        break;
        
      case 'data_breach':
        await this.isolateAffectedSystems(incident.systems);
        await this.revokeAPIKeys(incident.compromised_keys);
        break;
        
      case 'malicious_annotation':
        await this.quarantineAnnotations(incident.annotation_ids);
        await this.suspendUser(incident.actor);
        break;
    }
  }
}
```

### Security Monitoring
```yaml
monitoring:
  metrics:
    - name: failed_auth_rate
      threshold: 100/min
      action: alert
    
    - name: permission_denied_rate
      threshold: 50/min
      action: investigate
    
    - name: api_error_rate
      threshold: 5%
      action: page_oncall
    
    - name: audit_gaps
      threshold: any
      action: critical_alert
  
  alerts:
    channels:
      - slack: "#security-alerts"
      - pagerduty: "security-team"
      - email: "security@rovermission.control"
    
    rules:
      - name: "Suspicious Login Pattern"
        condition: |
          failed_logins > 5 AND
          unique_ips > 3 AND
          time_window < 5m
        
      - name: "Data Exfiltration Attempt"
        condition: |
          export_requests > 10 AND
          data_volume > 100MB AND
          time_window < 1h
        
      - name: "Privilege Escalation"
        condition: |
          permission_changes > 0 AND
          target_role IN ('admin', 'org_admin') AND
          actor_role NOT IN ('admin')
```

## Security Checklist

### Development
- [ ] Input validation on all endpoints
- [ ] Output encoding for XSS prevention
- [ ] Parameterized queries for database access
- [ ] Secure session management
- [ ] CSRF protection enabled
- [ ] Security headers configured
- [ ] Error messages don't leak information
- [ ] Logging doesn't contain sensitive data

### Deployment
- [ ] TLS certificates valid and up-to-date
- [ ] Secrets stored in secure vault
- [ ] Network segmentation configured
- [ ] Firewall rules reviewed
- [ ] Intrusion detection enabled
- [ ] Security scanning in CI/CD
- [ ] Dependency vulnerabilities checked
- [ ] Container images scanned

### Operations
- [ ] Access reviews conducted quarterly
- [ ] Audit logs monitored continuously
- [ ] Incident response plan tested
- [ ] Backup encryption verified
- [ ] Key rotation performed
- [ ] Security patches applied
- [ ] Penetration testing conducted
- [ ] Compliance audits passed

## Conclusion

This security model provides comprehensive protection for the annotation system through multiple layers of controls. Regular reviews and updates of these security measures ensure continued protection against evolving threats.
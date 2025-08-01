# Alert Persistence and State Management Architecture

## Overview

This document defines the comprehensive architecture for Task 24.4: "Enable Alert Persistence and State Management" in the Rover Mission Control system. The architecture enables alerts to persist across browser sessions, synchronize across multiple devices/tabs, implement acknowledgment tracking, and provide recovery mechanisms for dismissed/missed alerts.

## System Requirements

### Functional Requirements
1. **Cross-Session Persistence**: Alerts must persist across browser sessions and page refreshes
2. **Multi-Device Synchronization**: Alert state must synchronize across multiple devices and browser tabs
3. **Acknowledgment Requirements**: Critical and High priority alerts require explicit acknowledgment
4. **Alert Recovery**: Users must be able to recover dismissed or missed alerts
5. **Backend Integration**: Alerts must sync with backend APIs for cross-device consistency
6. **Theme Consistency**: Persisted alerts must maintain visual theme consistency

### Non-Functional Requirements
- **Performance**: Sub-100ms response times for alert operations
- **Reliability**: 99.9% data consistency across devices
- **Scalability**: Support for 10,000+ alerts per user
- **Offline Support**: Basic functionality when offline
- **Security**: Encrypted storage and secure transmission

## Architecture Overview

### Multi-Layer Persistence Strategy

The architecture implements a three-layer persistence model:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Memory Layer  │◄──►│ IndexedDB Layer │◄──►│  Backend API    │
│   (Zustand)     │    │   (Client DB)   │    │   (SQLite)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
    Real-time UI          Offline Storage        Cross-device Sync
    Active Session         Session Recovery       Long-term Storage
```

#### Layer 1: Memory (Zustand Store)
- **Purpose**: Real-time UI state management
- **Storage**: In-memory JavaScript objects
- **Lifetime**: Current browser session
- **Use Cases**: Active alerts, UI state, real-time updates

#### Layer 2: IndexedDB (Client Database)
- **Purpose**: Client-side persistence and offline support
- **Storage**: Browser IndexedDB with structured schemas
- **Lifetime**: Persistent across sessions (subject to retention policies)
- **Use Cases**: Session recovery, offline functionality, alert history

#### Layer 3: Backend API (Server Database)
- **Purpose**: Cross-device synchronization and authoritative storage
- **Storage**: SQLite database with comprehensive schemas
- **Lifetime**: Long-term storage (subject to data retention policies)
- **Use Cases**: Multi-device sync, audit trails, analytics

## Cross-Tab Synchronization Architecture

### Leader Election Pattern

The system implements a leader election pattern to prevent conflicts and duplicate API calls:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Tab 1    │    │    Tab 2    │    │    Tab 3    │
│  (Leader)   │◄──►│ (Follower)  │◄──►│ (Follower)  │
└─────────────┘    └─────────────┘    └─────────────┘
        │                   │                   │
        │         Broadcast Channel API         │
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────┐
│           Shared State & Events                     │
└─────────────────────────────────────────────────────┘
```

#### Leader Responsibilities
- Backend API synchronization
- IndexedDB write operations
- Conflict resolution
- State broadcast to followers

#### Follower Responsibilities
- Receive state updates via Broadcast Channel
- Apply state changes locally
- Handle UI interactions
- Escalate to leader when needed

### Broadcast Channel Events

```typescript
interface TabSyncMessage {
  type: 'ALERT_ADDED' | 'ALERT_DISMISSED' | 'ALERT_ACKNOWLEDGED' | 
        'LEADER_ELECTION' | 'STATE_SYNC' | 'HEARTBEAT';
  payload: any;
  timestamp: number;
  tabId: string;
  syncVersion: number;
}
```

## Backend API Schema

### Database Schema Extensions

```sql
-- Enhanced alert instances with persistence fields
CREATE TABLE alert_instances (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    threshold_id TEXT NOT NULL,
    metric_id TEXT NOT NULL,
    severity TEXT NOT NULL, -- 'critical', 'high', 'medium', 'low', 'info'
    state TEXT NOT NULL,    -- 'active', 'acknowledged', 'resolved', 'dismissed'
    triggered_value REAL NOT NULL,
    threshold_value REAL NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSON,
    
    -- Timestamps
    triggered_at TIMESTAMP NOT NULL,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    -- User tracking
    acknowledged_by TEXT,
    resolved_by TEXT,
    notes JSON DEFAULT '[]',
    
    -- Persistence and sync fields
    client_originated TEXT,     -- Originating client ID
    sync_version INTEGER DEFAULT 1,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    requires_acknowledgment BOOLEAN DEFAULT FALSE,
    device_fingerprint TEXT,
    persistence_level TEXT DEFAULT 'backend', -- 'memory', 'local', 'backend'
    
    -- Constraints
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id),
    FOREIGN KEY (threshold_id) REFERENCES threshold_definitions(id)
);

-- Alert acknowledgments tracking table
CREATE TABLE alert_acknowledgments (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL,
    acknowledged_by TEXT NOT NULL,
    acknowledged_at TIMESTAMP NOT NULL,
    device_fingerprint TEXT,
    notes TEXT,
    sync_version INTEGER DEFAULT 1,
    is_synthetic BOOLEAN DEFAULT FALSE, -- For migrated/system acknowledgments
    FOREIGN KEY (alert_id) REFERENCES alert_instances(id)
);

-- Device sessions for multi-device sync
CREATE TABLE device_sessions (
    device_fingerprint TEXT PRIMARY KEY,
    user_id TEXT,
    last_seen TIMESTAMP NOT NULL,
    device_info JSON, -- Browser, OS, capabilities
    alert_sync_timestamp TIMESTAMP DEFAULT 0,
    session_data JSON DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE
);

-- Alert dismissals tracking
CREATE TABLE alert_dismissals (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL,
    dismissed_by TEXT NOT NULL,
    dismissed_at TIMESTAMP NOT NULL,
    device_fingerprint TEXT,
    is_temporary BOOLEAN DEFAULT FALSE, -- Temporary dismissals for required acks
    resurface_at TIMESTAMP,
    sync_version INTEGER DEFAULT 1,
    FOREIGN KEY (alert_id) REFERENCES alert_instances(id)
);
```

### API Endpoints

#### Core Alert Operations
- `GET /api/alerts/sync` - Synchronize alerts across devices
- `POST /api/alerts/acknowledge` - Acknowledge alerts
- `POST /api/alerts/dismiss` - Dismiss alerts
- `POST /api/alerts/batch` - Bulk alert operations

#### Synchronization Endpoints
- `GET /api/alerts/device-state` - Get device-specific alert state
- `POST /api/alerts/sync-checkpoint` - Create sync checkpoint
- `GET /api/alerts/conflicts` - Retrieve and resolve conflicts

#### Recovery Endpoints
- `GET /api/alerts/history` - Alert history with filters
- `POST /api/alerts/recover` - Recover dismissed alerts
- `GET /api/alerts/missed` - Get missed alerts for device

## Acknowledgment System Architecture

### Priority-Based Requirements

| Priority  | Acknowledgment | Persistence | Recovery | Retention |
|-----------|---------------|-------------|----------|-----------|
| Critical  | **Required**  | All Layers  | Always   | Indefinite |
| High      | **Required**  | All Layers  | 30 days  | 30 days |
| Medium    | Optional      | Backend + IndexedDB | 7 days | 7 days |
| Low       | Optional      | Backend + Session | 24 hours | 24 hours |
| Info      | None          | Memory Only | None | Session Only |

### Acknowledgment State Machine

```
┌─────────┐    acknowledge    ┌──────────────┐    resolve    ┌──────────┐
│ ACTIVE  │─────────────────►│ ACKNOWLEDGED │─────────────►│ RESOLVED │
└─────────┘                  └──────────────┘              └──────────┘
     │                               │
     │ dismiss (if optional ack)     │ auto-resolve
     ▼                               ▼
┌─────────┐                  ┌──────────┐
│DISMISSED│                  │ RESOLVED │
└─────────┘                  └──────────┘
     │
     │ resurface (if required ack)
     ▼
┌─────────┐
│ ACTIVE  │
└─────────┘
```

### Enhanced Alert Interface

```typescript
interface PersistedAlert extends ProcessedAlert {
  // Persistence fields
  persistenceLevel: 'memory' | 'local' | 'backend';
  syncVersion: number;
  lastModified: Date;
  deviceFingerprint: string;
  
  // Acknowledgment fields
  requiresAcknowledgment: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  acknowledgmentDevice?: string;
  
  // Dismissal fields
  isDismissedTemporarily?: boolean;
  dismissedAt?: Date;
  resurfaceAt?: Date;
  
  // Recovery fields
  expiresAt?: Date;
  recoverable: boolean;
  retentionPolicy: RetentionPolicy;
}

interface RetentionPolicy {
  priority: AlertPriority;
  retentionDays: number | null; // null = indefinite
  requiresAcknowledgment: boolean;
  autoExpire: boolean;
  cleanupStrategy: 'delete' | 'archive' | 'compress';
}
```

## Conflict Resolution Architecture

### Conflict Types and Resolution Strategies

#### 1. Acknowledgment Conflicts
**Problem**: Same alert acknowledged simultaneously on multiple devices
**Resolution**: First acknowledgment wins (timestamp-based)
```typescript
function resolveAcknowledgmentConflict(
  local: AlertAcknowledgment, 
  remote: AlertAcknowledgment
): AlertAcknowledgment {
  return local.acknowledgedAt < remote.acknowledgedAt ? local : remote;
}
```

#### 2. State Transition Conflicts
**Problem**: Alert dismissed on one device, acknowledged on another
**Resolution**: Acknowledgment takes precedence over dismissal
```typescript
function resolveStateConflict(
  localState: AlertState, 
  remoteState: AlertState
): AlertState {
  const precedence = ['acknowledged', 'resolved', 'dismissed', 'active'];
  const localPrecedence = precedence.indexOf(localState);
  const remotePrecedence = precedence.indexOf(remoteState);
  return localPrecedence < remotePrecedence ? localState : remoteState;
}
```

#### 3. Version Conflicts
**Problem**: Devices have different versions of alert data
**Resolution**: Vector clocks with last-write-wins fallback
```typescript
function resolveVersionConflict(
  local: PersistedAlert, 
  remote: PersistedAlert
): PersistedAlert {
  // Check for acknowledgment precedence first
  if (remote.acknowledgedAt && !local.acknowledgedAt) return remote;
  if (local.acknowledgedAt && !remote.acknowledgedAt) return local;
  
  // Use sync version for other conflicts
  if (remote.syncVersion > local.syncVersion) return remote;
  if (local.syncVersion > remote.syncVersion) return local;
  
  // Fallback to timestamp
  return remote.lastModified > local.lastModified ? remote : local;
}
```

## Data Retention Policies

### Priority-Based Retention

#### Critical Alerts
- **Retention**: Indefinite (never auto-delete)
- **Storage**: All three persistence layers
- **Acknowledgment**: Required and persistent
- **Cleanup**: Manual archive only

#### High Alerts  
- **Retention**: 30 days in backend, 7 days in IndexedDB
- **Storage**: All layers during active period
- **Acknowledgment**: Required, resurfaces if dismissed
- **Cleanup**: Automated after retention period

#### Medium Alerts
- **Retention**: 7 days in backend, 24 hours in IndexedDB  
- **Storage**: Backend + IndexedDB during active period
- **Acknowledgment**: Optional
- **Cleanup**: Graduated cleanup (compress → archive → delete)

#### Low Alerts
- **Retention**: 24 hours in backend, session-only in IndexedDB
- **Storage**: Minimal persistence
- **Acknowledgment**: Optional
- **Cleanup**: Session cleanup with summary aggregation

#### Info Alerts
- **Retention**: No persistence (memory only)
- **Storage**: Memory only, cleared on refresh
- **Acknowledgment**: Not required, auto-dismissed
- **Cleanup**: Immediate cleanup

### Cleanup Strategy Implementation

```typescript
class AlertCleanupService {
  async executeCleanup(): Promise<CleanupReport> {
    const report = new CleanupReport();
    
    // Phase 1: Expire alerts based on retention policy
    await this.expireAlerts(report);
    
    // Phase 2: Compress historical data
    await this.compressHistoricalAlerts(report);
    
    // Phase 3: Archive old alerts
    await this.archiveAgedAlerts(report);
    
    // Phase 4: Delete expired data
    await this.deleteExpiredAlerts(report);
    
    return report;
  }
  
  private async expireAlerts(report: CleanupReport): Promise<void> {
    const retentionPolicies = this.getRetentionPolicies();
    
    for (const policy of retentionPolicies) {
      const expiredAlerts = await this.findExpiredAlerts(policy);
      await this.markAlertsExpired(expiredAlerts);
      report.addExpired(policy.priority, expiredAlerts.length);
    }
  }
}
```

## Migration Strategy

### Four-Phase Migration Plan

#### Phase 1: Dual-Write Implementation
**Objective**: Implement new persistence without disrupting existing functionality
- Deploy new persistence layer alongside existing system
- All new alerts written to both old and new systems
- Read preference: new system first, fallback to old system
- Zero downtime deployment

#### Phase 2: Background Migration
**Objective**: Migrate existing data to new system
- Migrate localStorage data to IndexedDB with data transformation
- Convert existing alert formats to new PersistedAlert interface
- Assign appropriate persistence levels based on alert priority
- Create synthetic acknowledgment states for critical/high alerts

#### Phase 3: Backend Integration
**Objective**: Enable full cross-device synchronization
- Enable backend sync for migrated alerts
- Sync existing alerts to backend during low-traffic periods
- Implement conflict resolution for alerts in multiple locations
- Enable cross-device sync capabilities

#### Phase 4: Legacy Cleanup
**Objective**: Complete migration and remove legacy systems
- Switch read preference to new system exclusively
- Deprecate old localStorage format and cleanup code
- Remove backward compatibility layers
- Complete migration validation and monitoring

### Migration Implementation

```typescript
class AlertMigrationService {
  async migrateFromLegacyStorage(): Promise<MigrationReport> {
    const report = new MigrationReport();
    
    try {
      // Step 1: Load legacy data
      const legacyData = this.loadLegacyAlertStorage();
      if (!legacyData) {
        report.markNoMigrationNeeded();
        return report;
      }
      
      // Step 2: Transform to new format
      const transformedAlerts = await this.transformLegacyAlerts(legacyData);
      report.addTransformed(transformedAlerts.length);
      
      // Step 3: Write to IndexedDB
      await this.indexedDBService.bulkInsert(transformedAlerts);
      report.addPersisted(transformedAlerts.length);
      
      // Step 4: Sync to backend
      const syncResults = await this.backendSyncService.syncMigratedAlerts(transformedAlerts);
      report.addSynced(syncResults.successCount);
      report.addSyncErrors(syncResults.errors);
      
      // Step 5: Verify migration
      await this.verifyMigration(transformedAlerts);
      
      // Step 6: Mark migration complete
      this.markMigrationComplete();
      
    } catch (error) {
      report.addError(error);
      await this.rollbackMigration();
    }
    
    return report;
  }
  
  private transformLegacyAlerts(legacyData: any): PersistedAlert[] {
    return legacyData.alerts?.map(alert => ({
      ...alert,
      persistenceLevel: this.determinePersistenceLevel(alert.priority),
      syncVersion: 1,
      lastModified: new Date(),
      deviceFingerprint: this.deviceFingerprintService.getFingerprint(),
      requiresAcknowledgment: ['critical', 'high'].includes(alert.priority),
      recoverable: alert.priority !== 'info',
      retentionPolicy: this.getRetentionPolicy(alert.priority)
    })) || [];
  }
}
```

## Implementation Architecture

### Core Services

#### AlertPersistenceService
```typescript
class AlertPersistenceService {
  constructor(
    private memoryStore: ZustandAlertStore,
    private indexedDBService: IndexedDBAlertService,  
    private backendSyncService: BackendSyncService,
    private conflictResolver: ConflictResolutionService
  ) {}
  
  async persistAlert(alert: PersistedAlert): Promise<void> {
    // Write to all applicable layers
    await this.memoryStore.addAlert(alert);
    
    if (alert.persistenceLevel !== 'memory') {
      await this.indexedDBService.save(alert);
    }
    
    if (alert.persistenceLevel === 'backend') {
      await this.backendSyncService.syncAlert(alert);
    }
  }
  
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const acknowledgment = {
      alertId,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
      deviceFingerprint: this.deviceService.getFingerprint()
    };
    
    // Update all layers
    await this.memoryStore.acknowledgeAlert(alertId, acknowledgment);
    await this.indexedDBService.updateAcknowledgment(alertId, acknowledgment);
    await this.backendSyncService.syncAcknowledgment(acknowledgment);
    
    // Notify other tabs
    this.broadcastService.send({
      type: 'ALERT_ACKNOWLEDGED',
      payload: acknowledgment,
      timestamp: Date.now(),
      tabId: this.tabId
    });
  }
}
```

#### CrossTabSyncService
```typescript
class CrossTabSyncService {
  private broadcastChannel: BroadcastChannel;
  private isLeader: boolean = false;
  
  constructor() {
    this.broadcastChannel = new BroadcastChannel('alert-sync');
    this.setupEventHandlers();
    this.initiateLeaderElection();
  }
  
  private async initiateLeaderElection(): Promise<void> {
    // Leader election algorithm
    const electionId = Date.now() + Math.random();
    const candidates = await this.discoverOtherTabs();
    
    if (candidates.length === 0 || this.hasHighestPriority(electionId, candidates)) {
      await this.becomeLeader();
    } else {
      await this.becomeFollower();
    }
  }
  
  private async becomeLeader(): Promise<void> {
    this.isLeader = true;
    this.startBackgroundSync();
    this.broadcastLeadershipChange();
  }
  
  private async syncStateToFollowers(state: AlertState): Promise<void> {
    if (!this.isLeader) return;
    
    this.broadcastChannel.postMessage({
      type: 'STATE_SYNC',
      payload: state,
      timestamp: Date.now(),
      tabId: this.tabId
    });
  }
}
```

## Performance Considerations

### Optimization Strategies

#### 1. Lazy Loading
- Load alert history on-demand
- Implement virtual scrolling for large alert lists
- Progressive data loading for better perceived performance

#### 2. Caching Strategy
- Memory cache for frequently accessed alerts
- IndexedDB cache with TTL for session data
- Backend cache with appropriate invalidation

#### 3. Batch Operations
- Batch multiple alert operations into single API calls
- Debounce rapid state changes
- Bulk synchronization during idle periods

#### 4. Data Compression
- Compress alert payloads for storage and transmission
- Use efficient serialization formats (MessagePack, CBOR)
- Implement delta synchronization for state updates

## Security Architecture

### Data Protection
- **Encryption at Rest**: IndexedDB and backend storage encrypted
- **Encryption in Transit**: TLS 1.3 for all API communications
- **Data Integrity**: HMAC signatures for sync operations
- **Access Control**: User-based permissions for alert access

### Privacy Considerations
- **Data Minimization**: Store only necessary alert data
- **Retention Limits**: Automatic cleanup based on retention policies
- **User Control**: Users can delete their alert history
- **Audit Trail**: Track all alert-related operations

## Monitoring and Observability

### Metrics Collection
- Alert persistence success/failure rates
- Cross-device synchronization latency  
- Conflict resolution frequency
- Storage utilization by persistence layer

### Health Checks
- IndexedDB availability and performance
- Backend API connectivity and response times
- Cross-tab communication health
- Data consistency validation

### Alerting
- Failed synchronization operations
- High conflict resolution rates
- Storage quota approaching limits
- Unusual alert patterns or volumes

## Conclusion

This architecture provides a comprehensive solution for alert persistence and state management in the Rover Mission Control system. The multi-layer approach ensures reliability and performance while the cross-device synchronization enables seamless user experience across multiple devices and sessions.

The implementation prioritizes data consistency, user experience, and system reliability while maintaining the flexibility to handle various alert types and usage patterns. The phased migration strategy ensures a smooth transition from the existing system without disrupting ongoing operations.

Key benefits of this architecture:
- **Reliability**: Multi-layer redundancy prevents data loss
- **Performance**: Optimized for real-time operations
- **Scalability**: Handles large volumes of alerts efficiently  
- **Flexibility**: Supports various alert types and use cases
- **Maintainability**: Clean separation of concerns and well-defined interfaces
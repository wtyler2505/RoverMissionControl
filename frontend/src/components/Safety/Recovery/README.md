# Emergency Stop Recovery System

## Overview

The Emergency Stop Recovery System is a safety-critical implementation designed to provide guided, auditable recovery procedures following emergency stop activations in the rover mission control system. The system follows IEC 61508 functional safety standards and implements fail-safe design principles throughout.

## Key Features

### 1. Safety-Critical Design
- **Fail-Safe State Transitions**: All operations default to safe states on failure
- **Mandatory Verification Checkpoints**: Required operator confirmations at critical points
- **Hardware/Software Integrity Checks**: Comprehensive system validation before restart
- **Automatic Rollback Capabilities**: Safe system rollback on detection of failures
- **Complete Audit Trail**: Full logging of all operations for compliance

### 2. Step-by-Step Recovery Wizard
- **Guided User Interface**: Clear visual guidance through each recovery step
- **Progressive Disclosure**: Information presented when needed to reduce cognitive load
- **Contextual Help**: Instructions and guidance specific to each recovery phase
- **Real-time Progress Tracking**: Visual indicators of recovery progress and completion

### 3. System Integration
- **Hardware Monitoring**: Real-time monitoring of all hardware components
- **Software Validation**: Verification of software subsystem integrity
- **Communication Channels**: Testing of all communication pathways
- **Emergency Hardware**: Validation of emergency stop hardware functionality

## Architecture

### Components

#### Frontend Components
```
src/components/Safety/Recovery/
├── EmergencyRecoveryIntegration.tsx    # Main integration component
├── EmergencyStopRecoveryWizard.tsx     # Step-by-step recovery wizard
├── RecoveryDashboard.tsx               # Recovery status dashboard
└── index.ts                            # Component exports
```

#### Services and Hooks
```
src/services/
└── recoveryManager.ts                  # Recovery business logic

src/hooks/
└── useEmergencyRecovery.ts            # React hook for recovery state

src/types/
└── recovery.ts                        # TypeScript definitions
```

#### Backend API
```
backend/hardware/
└── emergency_recovery_routes.py       # FastAPI recovery endpoints
```

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Recovery Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │  System Status   │  │ Recovery Control │  │ Audit Trail  │  │
│  └─────────────────┘  └─────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                 Recovery Wizard                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │               Step-by-Step Guidance                     │ │
│  │  1. Initial Assessment     4. System Integrity         │ │
│  │  2. Hardware Verification  5. Operator Confirmation    │ │
│  │  3. Software Validation    6. Final Verification       │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            Component Checks & Tests                     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                Recovery Manager Service                      │
├─────────────────────────────────────────────────────────────┤
│  • Session Management        • System Diagnostics          │
│  • Step Execution            • Audit Logging               │
│  • Rollback Procedures       • Safety Validation           │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              Hardware Integration Layer                      │
├─────────────────────────────────────────────────────────────┤
│  • Emergency Stop Hardware   • System Components           │
│  • Health Monitoring         • Diagnostic Systems          │
└─────────────────────────────────────────────────────────────┘
```

## Recovery Process Flow

### 1. Initial Assessment (Required)
- Review emergency stop activation reason
- Check for immediate safety hazards
- Verify operator authority and clearance
- Confirm area is clear of personnel

### 2. Hardware System Verification (Required)
- Check motor controllers and drives
- Verify sensor connectivity and readings
- Test actuator responses
- Confirm power system stability
- Validate emergency stop hardware integrity

### 3. Software System Validation (Required)
- Restart critical software services
- Verify database connectivity
- Test WebSocket connections
- Validate telemetry data flow
- Confirm navigation system status

### 4. System Integrity Check (Required)
- Run built-in diagnostic tests
- Verify system response times
- Check for memory leaks or errors
- Validate safety system responses
- Confirm backup systems availability

### 5. Operator Confirmation (Required)
- Review all system checks and results
- Confirm area is clear and safe for operation
- Verify emergency procedures are in place
- Document any remaining concerns
- Provide final authorization for system restart

### 6. Final System Verification (Required)
- Clear emergency stop condition
- Verify normal operation indicators
- Test basic system functions
- Confirm telemetry and monitoring active
- Document recovery completion

## Usage

### Basic Integration

```tsx
import { EmergencyRecoveryIntegration } from './components/Safety/Recovery';

function App() {
  return (
    <EmergencyRecoveryIntegration
      configuration={{
        maxRecoveryTimeMs: 3600000,
        requireTwoPersonConfirmation: true,
        enableAuditLogging: true,
      }}
      enableRealTimeUpdates={true}
      onNavigate={(route) => console.log('Navigate to:', route)}
    />
  );
}
```

### Custom Recovery Hook

```tsx
import { useEmergencyRecovery, EmergencyStopCause } from './hooks/useEmergencyRecovery';

function CustomRecoveryComponent() {
  const {
    context,
    session,
    startRecovery,
    executeStep,
    canStartRecovery,
  } = useEmergencyRecovery();

  const handleStartRecovery = async () => {
    if (canStartRecovery) {
      await startRecovery(
        'operator-123',
        'John Doe',
        EmergencyStopCause.MANUAL_ACTIVATION
      );
    }
  };

  return (
    <div>
      <h1>Recovery Status: {context.emergencyStopStatus.isActive ? 'ACTIVE' : 'INACTIVE'}</h1>
      {canStartRecovery && (
        <button onClick={handleStartRecovery}>
          Start Recovery
        </button>
      )}
    </div>
  );
}
```

### Backend Integration

```python
from backend.hardware.emergency_recovery_routes import router, initialize_recovery_system
from backend.hardware.emergency_stop_manager import EmergencyStopManager

# Initialize recovery system
emergency_manager = EmergencyStopManager(config)
initialize_recovery_system(emergency_manager)

# Add routes to FastAPI app
app.include_router(router)
```

## Configuration

### Recovery Configuration Options

```typescript
interface RecoveryConfiguration {
  maxRecoveryTimeMs: number;              // Maximum recovery time allowed
  requireTwoPersonConfirmation: boolean;  // Require two-person authorization
  allowSkipNonCriticalSteps: boolean;     // Allow skipping optional steps
  automaticRollbackOnFailure: boolean;    // Auto-rollback on failure
  requireHardwareVerification: boolean;   // Require hardware checks
  requireSoftwareVerification: boolean;   // Require software checks
  enableAuditLogging: boolean;            // Enable comprehensive logging
  suspendOnCommunicationLoss: boolean;    // Suspend on comm loss
  maxRetryAttempts: number;               // Maximum retry attempts
  stepTimeoutMs: number;                  // Individual step timeout
  verificationTimeoutMs: number;          // Verification test timeout
  rolesToAllowRecovery: string[];         // Authorized user roles
  criticalComponents: SystemComponent[];  // Critical system components
  emergencyContacts: string[];            // Emergency contact list
}
```

### System Components

```typescript
enum SystemComponent {
  MOTORS = 'motors',
  SENSORS = 'sensors',
  ACTUATORS = 'actuators',
  COMMUNICATIONS = 'communications',
  POWER_SYSTEM = 'power_system',
  NAVIGATION = 'navigation',
  TELEMETRY = 'telemetry',
  SAFETY_SYSTEMS = 'safety_systems',
  EMERGENCY_HARDWARE = 'emergency_hardware',
}
```

## API Endpoints

### Recovery Session Management

- `GET /api/recovery/status` - Get system status
- `POST /api/recovery/sessions` - Start recovery session
- `GET /api/recovery/sessions` - List recovery sessions
- `GET /api/recovery/sessions/{id}` - Get specific session
- `POST /api/recovery/sessions/{id}/steps/{step_id}/execute` - Execute step
- `POST /api/recovery/sessions/{id}/steps/{step_id}/skip` - Skip step
- `POST /api/recovery/sessions/{id}/abort` - Abort session
- `GET /api/recovery/audit` - Get audit log

## Safety Features

### Fail-Safe Design
- **Default Safe State**: System defaults to emergency stop state on any failure
- **Positive Safety Logic**: Operations require positive confirmation to proceed
- **Independent Safety Channels**: Safety functions independent of normal operation
- **Watchdog Monitoring**: Continuous monitoring with automatic timeout handling

### Audit and Compliance
- **Complete Audit Trail**: Every action logged with timestamp and operator ID
- **Tamper-Proof Logging**: Audit logs protected from modification
- **Compliance Reporting**: Built-in reports for safety compliance
- **Event Correlation**: Full traceability of events and actions

### Role-Based Access Control
- **Operator Roles**: Different permission levels for different operators
- **Two-Person Rules**: Critical operations can require two-person authorization
- **Session Management**: Proper session handling and timeout management
- **Authorization Tracking**: Complete tracking of who authorized what

## Testing

### Component Testing
```bash
# Run component tests
npm run test:recovery

# Run with coverage
npm run test:recovery -- --coverage
```

### Integration Testing
```bash
# Run integration tests
npm run test:integration:recovery

# Run end-to-end tests
npm run test:e2e:recovery
```

### Safety Testing
```bash
# Run safety-critical tests
npm run test:safety:recovery

# Run fault injection tests
npm run test:fault-injection
```

## Compliance

This system is designed to meet:
- **IEC 61508** - Functional Safety of Electrical/Electronic/Programmable Electronic Safety-related Systems
- **IEC 62061** - Safety of machinery - Functional safety of safety-related electrical, electronic and programmable electronic control systems
- **ISO 13849** - Safety of machinery - Safety-related parts of control systems

## Maintenance

### Regular Checks
- Verify audit log integrity
- Test emergency stop hardware
- Validate communication channels
- Check system component health
- Review recovery templates

### Updates
- System component definitions
- Recovery step templates
- Safety configuration parameters
- User role permissions
- Audit log retention policies

## Troubleshooting

### Common Issues

1. **Recovery Session Won't Start**
   - Verify emergency stop is active
   - Check user permissions
   - Validate system connectivity

2. **Steps Failing Verification**
   - Check component health status
   - Verify communication channels
   - Review hardware connections

3. **Audit Log Issues**
   - Check storage permissions
   - Verify logging configuration
   - Review retention policies

### Debug Mode

Enable debug mode for detailed logging:

```typescript
const recovery = useEmergencyRecovery({
  configuration: {
    enableDebugLogging: true,
    logLevel: 'debug',
  }
});
```

## Support

For technical support and safety-critical issues:
- Review system documentation
- Check audit logs for error details
- Contact system administrators
- Follow emergency escalation procedures

---

**⚠️ SAFETY WARNING**: This system handles safety-critical operations. Any modifications must be reviewed by qualified safety engineers and undergo proper testing before deployment in production environments.
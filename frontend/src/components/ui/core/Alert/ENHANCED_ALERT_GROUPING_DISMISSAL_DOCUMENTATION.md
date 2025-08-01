# Enhanced Alert Grouping and Dismissal System Documentation

## Overview

The Enhanced Alert Grouping and Dismissal System provides comprehensive alert management capabilities for the Rover Mission Control application. This system implements sophisticated grouping algorithms, multiple dismissal options, priority-specific behaviors, and advanced user interface components to handle mission-critical alert scenarios.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                Enhanced Alert System Architecture                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │   Alert Store   │◄──►│ Grouping Manager │◄──►│ UI Components│ │
│  │   (Zustand)     │    │   (Enhanced)     │    │  (React)    │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│           │                       │                      │      │
│           ▼                       ▼                      ▼      │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │  Persistence    │    │ Dismissal Engine │    │ Undo Manager│ │
│  │   Service       │    │                  │    │             │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Enhanced Alert Grouping Manager

**File**: `EnhancedAlertGroupingManager.ts`

The core engine that handles alert grouping, dismissal logic, and state management.

#### Key Features:
- **Smart Grouping**: Multiple criteria-based grouping (source, priority, title similarity, timing)
- **Related Alert Detection**: Advanced similarity algorithms using Levenshtein distance
- **Dismissal Engine**: Priority-specific dismissal behaviors with undo support
- **Performance Optimization**: Efficient algorithms for high-volume scenarios

#### Grouping Criteria:
```typescript
interface AlertGroupCriteria {
  messagePattern?: RegExp;
  titleSimilarity?: number; // 0-1 threshold
  sourceSimilarity?: boolean;
  timingWindow?: number; // milliseconds
  priorityGrouping?: boolean;
  metadataKeys?: string[];
  customGroupingFn?: (alerts: ProcessedAlert[]) => Map<string, ProcessedAlert[]>;
}
```

#### Usage Example:
```typescript
const groupingManager = new EnhancedAlertGroupingManager({
  groupingCriteria: {
    sourceSimilarity: true,
    titleSimilarity: 0.8,
    timingWindow: 30000, // 30 seconds
    priorityGrouping: true
  }
});

// Analyze and group alerts
const groups = groupingManager.analyzeAndGroup(alerts);
```

### 2. Dismissal Types and Behaviors

#### Available Dismissal Types:
- **Manual**: Immediate dismissal with optional reason
- **Timed**: Scheduled dismissal after specified duration
- **Bulk**: Multi-select dismissal with filtering
- **Conditional**: Rule-based dismissal with criteria
- **Auto-Priority**: Automatic based on priority rules

#### Priority-Specific Behaviors:
- **Critical**: Persistent until acknowledged, requires explicit action
- **High**: Stays visible until acknowledged, blocking behavior
- **Medium**: Auto-dismisses after 3+ seconds of viewing
- **Low**: Auto-dismisses after 1-minute timeout
- **Info**: Auto-dismisses after 15 seconds, alert center only

#### Dismissal Example:
```typescript
// Manual dismissal with reason
await groupingManager.dismissAlert('alert-123', 'manual', {
  reason: 'Issue resolved',
  user: 'operator@mission.com'
});

// Bulk dismissal with criteria
await groupingManager.bulkDismiss({
  alertIds: ['alert-1', 'alert-2'],
  groupIds: ['group-1']
}, 'bulk', {
  reason: 'Maintenance window'
});
```

### 3. UI Components

#### AlertDismissalControls
**File**: `components/AlertDismissalControls.tsx`

Individual alert dismissal interface with behavior feedback.

```typescript
<AlertDismissalControls
  alertId="alert-123"
  groupingManager={groupingManager}
  onDismiss={handleDismiss}
  compact={false}
/>
```

#### BulkDismissalManager
**File**: `components/BulkDismissalManager.tsx`

Advanced bulk operations interface with filtering and selection.

```typescript
<BulkDismissalManager
  groupingManager={groupingManager}
  availableAlerts={alerts}
  availableGroups={groups}
  onBulkDismiss={handleBulkDismiss}
  onClose={() => setShowBulkManager(false)}
/>
```

#### AlertUndoManager
**File**: `components/AlertUndoManager.tsx`

Undo functionality with toast notifications and history.

```typescript
<AlertUndoManager
  groupingManager={groupingManager}
  position="bottom-right"
  maxVisible={3}
  onUndo={handleUndo}
/>
```

#### EnhancedAlertContainer
**File**: `EnhancedAlertContainer.tsx`

Main container integrating all features with responsive design.

```typescript
<EnhancedAlertContainer
  position="top-right"
  maxVisible={5}
  groupingCriteria={groupingCriteria}
  enableBulkActions={true}
  enableUndo={true}
/>
```

## Configuration Options

### Grouping Configuration
```typescript
const groupingCriteria: AlertGroupCriteria = {
  // Enable source-based grouping
  sourceSimilarity: true,
  
  // Group by priority levels
  priorityGrouping: true,
  
  // Title similarity threshold (0-1)
  titleSimilarity: 0.7,
  
  // Time window for temporal grouping (ms)
  timingWindow: 30000,
  
  // Metadata keys to consider for grouping
  metadataKeys: ['category', 'subsystem'],
  
  // Custom grouping function
  customGroupingFn: (alerts) => {
    // Custom logic here
    return groupMap;
  }
};
```

### Dismissal Rules Configuration
```typescript
const customRules: DismissalRule[] = [
  {
    id: 'custom-critical',
    priority: 'critical',
    behavior: 'persistent',
    requiresAcknowledgment: true,
    conditions: {
      explicitAction: true,
      minViewTime: 5000
    }
  }
];
```

## Integration Guide

### 1. Basic Setup
```typescript
import { EnhancedAlertContainer } from './components/ui/core/Alert/EnhancedAlertContainer';
import { useAlertStore } from './stores/alertStore';

function App() {
  return (
    <div>
      {/* Your app content */}
      
      {/* Enhanced Alert System */}
      <EnhancedAlertContainer
        position="top-right"
        maxVisible={5}
        enableBulkActions={true}
        enableUndo={true}
      />
    </div>
  );
}
```

### 2. Adding Alerts with Grouping
```typescript
const { addAlert } = useAlertStore();

// Add alert with grouping hint
await addAlert({
  title: 'System Alert',
  message: 'Sensor reading anomaly detected',
  priority: 'high',
  source: 'hardware',
  groupId: 'sensor-group', // Optional grouping hint
  metadata: {
    sensorId: 'temp-01',
    category: 'hardware'
  }
});
```

### 3. Custom Grouping Logic
```typescript
const customGroupingCriteria = {
  customGroupingFn: (alerts: ProcessedAlert[]) => {
    const groups = new Map<string, ProcessedAlert[]>();
    
    // Group by sensor type
    alerts.forEach(alert => {
      const sensorType = alert.data?.metadata?.sensorType;
      if (sensorType) {
        const key = `sensor-${sensorType}`;
        const group = groups.get(key) || [];
        group.push(alert);
        groups.set(key, group);
      }
    });
    
    return groups;
  }
};
```

## Advanced Features

### 1. Undo Functionality
- **Undo Window**: 5-minute expiration by default
- **Visual Feedback**: Toast notifications with countdown
- **History Management**: Full undo history with filtering
- **Batch Undo**: Support for bulk operation undo

### 2. Cross-Tab Synchronization
- **Broadcast Channel API**: Real-time sync across tabs
- **Leader Election**: Coordinate actions across tabs
- **Conflict Resolution**: Handle concurrent modifications

### 3. Performance Optimizations
- **Efficient Algorithms**: O(log n) complexity for critical operations
- **Memory Management**: Automatic cleanup and garbage collection
- **Virtual Scrolling**: Handle large alert volumes efficiently
- **Debounced Processing**: Batch operations for performance

## Testing Strategy

### Unit Tests
- **Grouping Algorithms**: Similarity detection, group formation
- **Dismissal Logic**: Priority-specific behaviors, undo functionality
- **State Management**: Store updates, persistence integration

### Integration Tests
- **Component Integration**: UI component interactions
- **Store Integration**: Alert store and grouping manager sync
- **Cross-Tab Sync**: Multi-tab synchronization testing

### E2E Tests
- **User Workflows**: Complete dismissal and undo workflows
- **Performance Tests**: High-volume alert scenarios
- **Accessibility Tests**: Screen reader and keyboard navigation

## Accessibility Features

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Full keyboard support for all interactions
- **Screen Reader Support**: Proper ARIA attributes and announcements
- **Color Contrast**: Meets minimum contrast ratios
- **Focus Management**: Clear focus indicators and logical flow

### Accessibility Examples
```typescript
// ARIA attributes for grouped alerts
<div
  role="region"
  aria-label={`Alert group: ${group.groupKey}`}
  aria-describedby={`group-summary-${group.id}`}
>
  {/* Group content */}
</div>

// Screen reader announcements
<div
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {dismissalFeedback}
</div>
```

## Error Handling

### Graceful Degradation
- **Network Failures**: Offline operation support
- **Storage Failures**: Fallback to memory-only mode
- **Component Errors**: Error boundaries with recovery

### Error Recovery
```typescript
try {
  await groupingManager.dismissAlert(alertId, 'manual');
} catch (error) {
  console.error('Dismissal failed:', error);
  // Show user-friendly error message
  showErrorToast('Failed to dismiss alert. Please try again.');
}
```

## Performance Guidelines

### Best Practices
1. **Batch Operations**: Use bulk dismissal for multiple alerts
2. **Debounce Updates**: Avoid rapid-fire state changes
3. **Limit Visible Alerts**: Use maxVisible prop to control rendering
4. **Cleanup Resources**: Properly dispose of timers and subscriptions

### Performance Monitoring
```typescript
// Monitor grouping performance
const startTime = performance.now();
const groups = groupingManager.analyzeAndGroup(alerts);
const duration = performance.now() - startTime;

if (duration > 100) {
  console.warn(`Slow grouping operation: ${duration}ms`);
}
```

## Troubleshooting

### Common Issues

#### Alerts Not Grouping
- **Check Criteria**: Verify grouping criteria configuration
- **Debug Similarity**: Log similarity scores for debugging
- **Review Metadata**: Ensure required metadata is present

#### Dismissal Not Working
- **Check Permissions**: Verify dismissal permissions for priority
- **Review Rules**: Check dismissal rule configuration
- **Debug State**: Log dismissal state changes

#### Undo Not Available
- **Check Timing**: Verify undo window hasn't expired
- **Review Actions**: Ensure action is undoable
- **Debug History**: Check undo action history

### Debug Tools
```typescript
// Enable debug logging
groupingManager.setDebugMode(true);

// Get diagnostic information
const diagnostics = groupingManager.getDiagnostics();
console.log('Grouping diagnostics:', diagnostics);

// Monitor performance
groupingManager.addPerformanceMonitor((metrics) => {
  console.log('Performance metrics:', metrics);
});
```

## Migration Guide

### From Basic Alert System
1. **Install Dependencies**: No additional dependencies required
2. **Update Components**: Replace AlertContainer with EnhancedAlertContainer
3. **Configure Grouping**: Add grouping criteria configuration
4. **Test Integration**: Verify existing alert functionality works

### Breaking Changes
- **None**: Fully backward compatible with existing alert system
- **Optional Features**: All new features are opt-in

## Contributing

### Development Setup
1. **Clone Repository**: Get latest codebase
2. **Install Dependencies**: Run `npm install`
3. **Start Development**: Run `npm run dev`
4. **Run Tests**: Run `npm test`

### Adding New Features
1. **Follow TypeScript**: Use strict typing for all new code
2. **Write Tests**: Include comprehensive test coverage
3. **Update Documentation**: Update this documentation
4. **Accessibility**: Ensure WCAG 2.1 AA compliance

## API Reference

### EnhancedAlertGroupingManager Methods

#### `analyzeAndGroup(alerts: ProcessedAlert[]): Map<string, AlertGroup>`
Analyzes alerts and creates groups based on configured criteria.

#### `dismissAlert(alertId: string, type: DismissalType, options?: any): Promise<boolean>`
Dismisses a single alert with specified dismissal type.

#### `bulkDismiss(items: BulkItems, type: DismissalType, options?: any): Promise<BulkResult>`
Performs bulk dismissal operation on multiple alerts or groups.

#### `undoDismissal(actionId: string): Promise<boolean>`
Undoes a previous dismissal action if within undo window.

#### `getDismissalFeedback(alertId: string): DismissalFeedback | null`
Gets dismissal behavior feedback for UI display.

### Component Props

#### EnhancedAlertContainer Props
```typescript
interface EnhancedAlertContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxVisible?: number;
  groupingCriteria?: AlertGroupCriteria;
  enableBulkActions?: boolean;
  enableUndo?: boolean;
  className?: string;
}
```

## License

This implementation is part of the Rover Mission Control System and follows the project's licensing terms.

## Support

For technical support or questions about this implementation:
1. **Check Documentation**: Review this documentation first
2. **Search Issues**: Check existing GitHub issues
3. **Create Issue**: Open new issue with detailed description
4. **Contact Team**: Reach out to development team

---

*Last Updated: July 31, 2025*
*Version: 1.0.0*
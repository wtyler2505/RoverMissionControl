# WebSocket Protocol Components

This directory contains React components for managing and monitoring WebSocket protocol selection and performance.

## Components

### ProtocolSelector

A comprehensive protocol selection component with manual switching and auto-optimization capabilities.

**Features:**
- Protocol dropdown with descriptions
- Auto-optimization toggle
- Compression status display
- Performance recommendations
- Real-time metrics display

**Props:**
- `variant?: 'standard' | 'compact'` - Display variant (default: 'standard')
- `showRecommendations?: boolean` - Show protocol recommendations (default: true)
- `showMetrics?: boolean` - Show current protocol metrics (default: true)
- `onProtocolChange?: (protocol: Protocol, isManual: boolean) => void` - Callback when protocol changes

**Usage:**
```tsx
import { ProtocolSelector } from './components/WebSocket';

<ProtocolSelector
  showRecommendations
  showMetrics
  onProtocolChange={(protocol, isManual) => {
    console.log(`Changed to ${protocol}`);
  }}
/>
```

### ProtocolMonitor

A detailed monitoring component showing real-time protocol performance metrics with comparison and history.

**Features:**
- Real-time performance metrics (latency, throughput, error rate)
- Protocol comparison table
- Protocol switch history
- Expandable/collapsible design
- Metrics export functionality

**Props:**
- `defaultExpanded?: boolean` - Initial expanded state (default: false)
- `showHistory?: boolean` - Show protocol switch history (default: true)
- `showComparison?: boolean` - Show protocol comparison table (default: true)
- `refreshInterval?: number` - Metrics refresh interval in ms (default: 2000)
- `maxHistoryItems?: number` - Maximum history items to show (default: 10)

**Usage:**
```tsx
import { ProtocolMonitor } from './components/WebSocket';

<ProtocolMonitor
  defaultExpanded
  showHistory
  showComparison
  refreshInterval={2000}
/>
```

### ProtocolIndicator

A minimal inline indicator for showing current protocol status with performance color coding.

**Features:**
- Multiple display variants (chip, icon, text)
- Performance color coding (green=optimal, yellow=ok, red=poor)
- Compression indicator
- Detailed metrics tooltip
- Fixed positioning option

**Props:**
- `variant?: 'chip' | 'icon' | 'text'` - Display variant (default: 'chip')
- `showCompression?: boolean` - Show compression indicator (default: true)
- `showMetrics?: boolean` - Show metrics in tooltip (default: true)
- `size?: 'small' | 'medium'` - Component size (default: 'small')
- `position?: 'inline' | 'fixed'` - Positioning mode (default: 'inline')

**Usage:**
```tsx
import { ProtocolIndicator } from './components/WebSocket';

// In a toolbar
<ProtocolIndicator variant="chip" />

// As an icon
<ProtocolIndicator variant="icon" size="small" />

// As text
<ProtocolIndicator variant="text" showCompression />

// Fixed position overlay
<ProtocolIndicator variant="chip" position="fixed" />
```

## Integration Examples

### In App Header
```tsx
<AppBar position="static">
  <Toolbar>
    <Typography variant="h6" sx={{ flexGrow: 1 }}>
      Application Title
    </Typography>
    <ProtocolIndicator variant="chip" />
  </Toolbar>
</AppBar>
```

### In Dashboard
```tsx
<Grid container spacing={3}>
  <Grid item xs={12} md={6}>
    <ProtocolSelector />
  </Grid>
  <Grid item xs={12}>
    <ProtocolMonitor defaultExpanded />
  </Grid>
</Grid>
```

### In Status Bar
```tsx
<Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
  <Stack direction="row" spacing={2} alignItems="center">
    <ProtocolIndicator variant="icon" size="small" />
    <ConnectionStatus compact />
  </Stack>
</Box>
```

## Protocol Types

The components support the following protocols:
- **JSON**: Human-readable, widely compatible
- **MessagePack**: Binary format with efficient serialization
- **CBOR**: Concise Binary Object Representation
- **Binary**: Raw binary protocol

## Performance Metrics

The components track and display:
- **Latency**: Encoding + decoding time (ms)
- **Throughput**: Data transfer rate (bytes/second)
- **Error Rate**: Percentage of failed messages
- **Compression Ratio**: Size reduction percentage
- **Message Count**: Total messages processed

## Color Coding

Performance indicators use color coding:
- 🟢 **Green**: Optimal performance
- 🟡 **Yellow**: Acceptable performance
- 🔴 **Red**: Poor performance

Thresholds:
- Latency: <10ms (green), <50ms (yellow), >50ms (red)
- Throughput: >10KB/s (green), >1KB/s (yellow), <1KB/s (red)
- Error Rate: <1% (green), <5% (yellow), >5% (red)
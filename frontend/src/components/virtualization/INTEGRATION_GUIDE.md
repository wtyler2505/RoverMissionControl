# Virtualization Integration Guide

This guide explains how to integrate and use the comprehensive virtualization system for optimal performance with large datasets.

## Quick Start

```typescript
import { VirtualizedList, VirtualizedTable, VirtualizationUtils } from '../components/virtualization';

// Check if virtualization is recommended
const shouldVirtualize = VirtualizationUtils.shouldVirtualize(items.length);

if (shouldVirtualize) {
  // Use virtualized components
}
```

## Core Components

### 1. VirtualizedList

Universal virtualization component for lists and grids.

```typescript
import { VirtualizedList } from '../components/virtualization';

const MyComponent = () => {
  const items = [/* your data */];
  
  const renderItem = ({ index, style, data, isVisible }) => (
    <div style={style}>
      {/* Your item content */}
      <h3>{data.title}</h3>
      <p>{data.description}</p>
    </div>
  );

  return (
    <VirtualizedList
      items={items.map(item => ({ id: item.id, data: item }))}
      itemHeight={120}
      height={600}
      renderItem={renderItem}
      overscanCount={5}
      ariaLabel="My list"
    />
  );
};
```

#### Variable Height Items

```typescript
<VirtualizedList
  items={items}
  itemHeight={(index) => calculateHeight(items[index])}
  itemSize="variable"
  estimatedItemSize={100}
  height={600}
  renderItem={renderItem}
/>
```

#### Grid Layout

```typescript
<VirtualizedList
  items={items}
  itemHeight={200}
  height={600}
  isGrid
  columnCount={3}
  columnWidth={300}
  renderItem={renderGridItem}
/>
```

#### Infinite Loading

```typescript
<VirtualizedList
  items={items}
  itemHeight={80}
  height={600}
  renderItem={renderItem}
  hasNextPage={hasMore}
  isNextPageLoading={loading}
  loadNextPage={loadMore}
/>
```

### 2. VirtualizedTable

Specialized table virtualization with advanced features.

```typescript
import { VirtualizedTable, TableColumn } from '../components/virtualization';

const columns: TableColumn[] = [
  {
    id: 'name',
    label: 'Name',
    width: 200,
    sortable: true,
    sticky: 'left', // Pin to left
  },
  {
    id: 'status',
    label: 'Status',
    width: 120,
    render: (value) => (
      <Chip label={value} color={value === 'active' ? 'success' : 'default'} />
    ),
  },
  {
    id: 'actions',
    label: 'Actions',
    width: 100,
    sticky: 'right', // Pin to right
    render: (_, row) => (
      <IconButton onClick={() => handleAction(row)}>
        <MoreVert />
      </IconButton>
    ),
  },
];

const MyTable = () => {
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const tableRows = data.map(item => ({
    id: item.id,
    data: item,
    selected: selectedRows.has(item.id),
  }));

  return (
    <VirtualizedTable
      columns={columns}
      rows={tableRows}
      height={600}
      selectable
      selectedRows={selectedRows}
      onRowSelect={(id, selected) => {
        const newSet = new Set(selectedRows);
        if (selected) newSet.add(id);
        else newSet.delete(id);
        setSelectedRows(newSet);
      }}
      sortBy={sortBy}
      sortDirection={sortDirection}
      onSort={setSortBy}
      stickyHeader
      striped
    />
  );
};
```

## Specialized Components

### 3. VirtualizedCommunicationLogViewer

Replace the standard log viewer for better performance:

```typescript
// Before
import { CommunicationLogViewer } from '../CommunicationLogs';

// After
import { VirtualizedCommunicationLogViewer } from '../components/virtualization';

// Usage is identical - just better performance!
<VirtualizedCommunicationLogViewer />
```

### 4. VirtualizedAlertHistoryPanel

Enhanced alert panel with virtualization:

```typescript
// Before
import { AlertHistoryPanel } from '../ui/core/Alert';

// After
import { VirtualizedAlertHistoryPanel } from '../components/virtualization';

<VirtualizedAlertHistoryPanel
  persistenceService={alertService}
  isOpen={panelOpen}
  onClose={() => setPanelOpen(false)}
  onAlertSelect={handleAlertSelect}
/>
```

### 5. VirtualizedHALDeviceList

Optimized device list for large device counts:

```typescript
// Before
import { HALDeviceList } from '../HAL';

// After
import { VirtualizedHALDeviceList } from '../components/virtualization';

// Usage is identical with performance improvements
<VirtualizedHALDeviceList />
```

## Performance Optimization

### Utility Functions

```typescript
import { VirtualizationUtils, VIRTUALIZATION_CONSTANTS } from '../components/virtualization';

// Check if virtualization is recommended
const shouldVirtualize = VirtualizationUtils.shouldVirtualize(
  items.length,
  estimatedItemHeight
);

// Calculate optimal item height
const itemHeight = VirtualizationUtils.calculateItemHeight(
  content,
  containerWidth,
  fontSize
);

// Get optimal overscan count
const overscanCount = VirtualizationUtils.getOptimalOverscan(
  items.length,
  'high' // performance level
);

// Estimate memory usage
const memoryInfo = VirtualizationUtils.estimateMemoryUsage(
  totalItems,
  renderedItems,
  itemSize
);
```

### Performance Thresholds

```typescript
const { PERFORMANCE_THRESHOLDS } = VIRTUALIZATION_CONSTANTS;

if (items.length > PERFORMANCE_THRESHOLDS.LARGE_LIST) {
  // Use high-performance settings
  overscanCount = 2;
  enableLazyLoading = true;
} else if (items.length > PERFORMANCE_THRESHOLDS.MEDIUM_LIST) {
  // Use balanced settings
  overscanCount = 5;
}
```

## Accessibility Features

All virtualization components maintain full accessibility:

```typescript
<VirtualizedList
  items={items}
  height={600}
  renderItem={renderItem}
  // Accessibility props
  ariaLabel="Product list"
  itemRole="listitem"
  // These are preserved automatically:
  // - ARIA attributes
  // - Keyboard navigation
  // - Screen reader announcements
  // - Focus management
/>
```

### Custom ARIA Labels

```typescript
const renderItem = ({ index, style, data, isVisible }) => (
  <div 
    style={style}
    role="listitem"
    aria-label={`${data.name} - ${data.status}`}
    aria-rowindex={index + 1}
  >
    {/* Content */}
  </div>
);
```

## Migration Guide

### From Standard Lists

```typescript
// Before
<ul>
  {items.map(item => (
    <li key={item.id}>
      <ItemComponent item={item} />
    </li>
  ))}
</ul>

// After
<VirtualizedList
  items={items.map(item => ({ id: item.id, data: item }))}
  itemHeight={80}
  height={400}
  renderItem={({ style, data }) => (
    <div style={style}>
      <ItemComponent item={data} />
    </div>
  )}
/>
```

### From Material-UI Tables

```typescript
// Before
<Table>
  <TableHead>
    {/* headers */}
  </TableHead>
  <TableBody>
    {rows.map(row => (
      <TableRow key={row.id}>
        {/* cells */}
      </TableRow>
    ))}
  </TableBody>
</Table>

// After
<VirtualizedTable
  columns={columnConfig}
  rows={tableRows}
  height={600}
  selectable
  stickyHeader
/>
```

## Best Practices

### 1. When to Use Virtualization

- **Always use** for >100 items
- **Consider using** for >50 items with complex rendering
- **Must use** for >1000 items

### 2. Performance Tips

```typescript
// ✅ Good: Memoize expensive computations
const memoizedItems = useMemo(() => 
  rawData.map(transformItem), 
  [rawData]
);

// ✅ Good: Use stable keys
items.map(item => ({ id: item.id, data: item }))

// ❌ Bad: Inline object creation
items.map(item => ({ id: Math.random(), data: item }))

// ✅ Good: Optimize render function
const renderItem = useCallback(({ style, data }) => (
  <div style={style}>
    <OptimizedComponent data={data} />
  </div>
), []);
```

### 3. Memory Management

```typescript
// Monitor memory usage in development
if (process.env.NODE_ENV === 'development') {
  console.log(VirtualizationUtils.estimateMemoryUsage(
    totalItems,
    renderedItems,
    itemSize
  ));
}
```

### 4. Responsive Design

```typescript
// Adjust based on screen size
const getColumnCount = () => {
  const width = window.innerWidth;
  if (width < 600) return 1;
  if (width < 900) return 2;
  return 3;
};

<VirtualizedList
  isGrid
  columnCount={getColumnCount()}
  columnWidth={300}
  // ... other props
/>
```

## Troubleshooting

### Common Issues

1. **Items not rendering**
   - Check that `id` is unique for each item
   - Ensure `height` prop is set correctly

2. **Poor scrolling performance**
   - Reduce `overscanCount`
   - Simplify item rendering
   - Use `React.memo` for item components

3. **Accessibility issues**
   - Ensure proper ARIA labels
   - Test with screen readers
   - Verify keyboard navigation

4. **Layout jumps**
   - Use consistent item heights
   - Provide accurate `estimatedItemSize`

### Debug Mode

```typescript
// Enable development metrics
<VirtualizedList
  items={items}
  height={600}
  renderItem={renderItem}
  // Development panel shows automatically in dev mode
/>
```

## Demo Component

Test all features with the included demo:

```typescript
import { VirtualizationDemo } from '../components/virtualization/VirtualizationDemo';

// Comprehensive demo with:
// - Performance metrics
// - Different view modes
// - Configurable parameters
// - Memory usage visualization
<VirtualizationDemo />
```

## Support

For questions or issues:
1. Check this integration guide
2. Review the demo component
3. Test with the provided utilities
4. Monitor performance metrics in development mode

Remember: Virtualization provides massive performance benefits but requires careful implementation. Always test with realistic data sizes and monitor performance metrics.
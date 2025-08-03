# Timeline Annotations System

A comprehensive, collaborative annotation system for timeline charts in the Rover Mission Control system. This system enables real-time collaboration, rich text editing, threaded discussions, and advanced filtering capabilities.

## 🚀 Features

### Core Functionality
- **Click-to-add annotations** at any time point on the timeline
- **Rich text editor** with Markdown support using Monaco Editor
- **Threaded replies** and nested conversations
- **User attribution** with timestamps and roles
- **Color-coded annotations** by category or user
- **Hover tooltips** with annotation previews
- **Visual markers** on timeline with category icons

### Collaboration Features
- **Real-time collaborative updates** via WebSocket
- **User presence indicators** showing who's online
- **Collaborative cursors** showing where users are working
- **Conflict resolution** for concurrent edits
- **Mention system** (@username) with notifications
- **Reaction system** with emoji responses

### Advanced Features
- **Filtering system** by author, date, category, visibility, status
- **Search functionality** across all annotation content
- **Export capabilities** (JSON, CSV, PDF)
- **Import functionality** for batch operations
- **Version history** with change tracking
- **Attachment support** (images, documents, links)
- **Permissions system** with role-based access control
- **Offline queue** for when connection is lost

## 📁 File Structure

```
timeline/
├── TimelineAnnotations.tsx          # Main annotation overlay component
├── AnnotationThread.tsx             # Thread display and management
├── AnnotationSidebar.tsx           # Filtering and management sidebar
├── useAnnotationCollaboration.ts   # WebSocket collaboration hook
├── AnnotationExporter.ts           # Export utilities
├── TimelineAnnotationExample.tsx   # Complete usage example
└── README_Annotations.md           # This documentation
```

## 🔧 Components

### TimelineAnnotations
The main overlay component that handles annotation display and interaction.

```tsx
import { TimelineAnnotations } from './timeline';

<TimelineAnnotations
  timelineRef={timelineRef}
  xScale={xScale}
  yScale={yScale}
  width={1000}
  height={600}
  margin={{ top: 40, right: 40, bottom: 60, left: 200 }}
  annotations={annotations}
  categories={categories}
  currentUser={currentUser}
  onAnnotationAdd={handleAdd}
  onAnnotationUpdate={handleUpdate}
  onAnnotationDelete={handleDelete}
  isCollaborativeMode={true}
  allowRichText={true}
/>
```

### AnnotationThread
Displays individual annotation threads with replies and reactions.

```tsx
import { AnnotationThread } from './timeline';

<AnnotationThread
  annotation={annotation}
  currentUser={currentUser}
  allowRichText={true}
  onReply={handleReply}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onReaction={handleReaction}
/>
```

### AnnotationSidebar
Provides filtering, search, and management capabilities.

```tsx
import { AnnotationSidebar } from './timeline';

<AnnotationSidebar
  open={sidebarOpen}
  onClose={() => setSidebarOpen(false)}
  annotations={annotations}
  categories={categories}
  authors={authors}
  filter={filter}
  onFilterChange={setFilter}
  onExport={handleExport}
/>
```

## 🔗 Real-time Collaboration

### useAnnotationCollaboration Hook
Manages WebSocket connections and collaborative features.

```tsx
import { useAnnotationCollaboration } from './timeline';

const collaboration = useAnnotationCollaboration(annotations, {
  enabled: true,
  currentUser: currentUser,
  onAnnotationUpdate: handleUpdate,
  onUserJoin: handleUserJoin,
  onConflict: handleConflict
});

// Broadcast changes
collaboration.broadcastAnnotationAdded(newAnnotation);
collaboration.broadcastAnnotationUpdated(updatedAnnotation, previousVersion);
collaboration.broadcastAnnotationDeleted(annotationId);
```

### WebSocket Events
The system handles these real-time events:
- `annotation_added` - New annotation created
- `annotation_updated` - Annotation modified
- `annotation_deleted` - Annotation removed
- `user_joined` - User joined session
- `user_left` - User left session
- `cursor_moved` - User cursor position updated

### Conflict Resolution
When concurrent edits occur, the system provides resolution options:
- **Use Local** - Keep your changes
- **Use Remote** - Accept remote changes
- **Merge** - Combine both versions

## 📤 Export System

### AnnotationExporter
Comprehensive export functionality with multiple formats.

```tsx
import { AnnotationExporter, exportAnnotationsToJSON } from './timeline';

// Direct export
const result = await exportAnnotationsToJSON(annotations, {
  includeReplies: true,
  includeAttachments: true,
  filters: currentFilter
});

// Class-based export with options
const exporter = new AnnotationExporter();
const result = await exporter.exportAnnotations(annotations, {
  format: 'pdf',
  groupBy: 'category',
  sortBy: 'timestamp',
  includeVersionHistory: true
});

// Download the result
AnnotationExporter.downloadExport(result);
```

### Export Formats
- **JSON** - Complete data with all metadata
- **CSV** - Tabular format for spreadsheet analysis
- **PDF** - Formatted report document (HTML in current implementation)

## 🏗️ Data Structure

### TimelineAnnotation
```typescript
interface TimelineAnnotation {
  id: string;
  timestamp: Date;
  endTimestamp?: Date;
  content: string;
  htmlContent?: string;
  author: AnnotationAuthor;
  category: AnnotationCategory;
  tags: string[];
  visibility: 'public' | 'private' | 'team';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'published' | 'archived';
  replies: TimelineAnnotation[];
  attachments: AnnotationAttachment[];
  mentions: string[];
  reactions: AnnotationReaction[];
  version: number;
  history: AnnotationVersion[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
  parentId?: string;
  threadId: string;
}
```

### AnnotationCategory
```typescript
interface AnnotationCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
}
```

### AnnotationAuthor
```typescript
interface AnnotationAuthor {
  id: string;
  name: string;
  avatar?: string;
  role: 'operator' | 'supervisor' | 'engineer' | 'analyst' | 'admin';
  permissions: AnnotationPermission[];
}
```

## 🔐 Permissions System

### Permission Levels
- **read** - View annotations
- **write** - Create and edit annotations
- **delete** - Delete annotations
- **moderate** - Manage all annotations

### Permission Scopes
- **own** - Only user's own annotations
- **team** - Team members' annotations
- **all** - All annotations in system

### Example Usage
```typescript
const permissions: AnnotationPermission[] = [
  { action: 'read', scope: 'all' },
  { action: 'write', scope: 'team' },
  { action: 'delete', scope: 'own' }
];
```

## 🎨 Styling and Theming

The annotation system integrates with Material-UI theming:

```typescript
// Custom category colors
const categories: AnnotationCategory[] = [
  { id: 'obs', name: 'Observation', color: theme.palette.primary.main },
  { id: 'issue', name: 'Issue', color: theme.palette.error.main },
  { id: 'milestone', name: 'Milestone', color: theme.palette.success.main }
];

// Responsive design
const isMobile = useMediaQuery(theme.breakpoints.down('md'));
```

## 🔍 Filtering and Search

### Available Filters
- **Authors** - Filter by annotation creators
- **Categories** - Filter by annotation types
- **Date Range** - Filter by time periods
- **Visibility** - Public, private, or team annotations
- **Status** - Draft, published, or archived
- **Tags** - Filter by annotation tags
- **Search Query** - Full-text search across content

### Usage Example
```typescript
const filter: AnnotationFilter = {
  authors: ['user-1', 'user-2'],
  categories: ['observation', 'issue'],
  dateRange: { start: startDate, end: endDate },
  searchQuery: 'battery',
  visibility: ['public', 'team']
};
```

## 🚦 Getting Started

### 1. Basic Setup
```tsx
import React, { useState, useRef } from 'react';
import { TimelineAnnotations } from './components/Charts/timeline';

const MyTimelineComponent = () => {
  const [annotations, setAnnotations] = useState([]);
  const timelineRef = useRef(null);
  
  return (
    <div style={{ position: 'relative' }}>
      {/* Your timeline chart */}
      <svg ref={timelineRef} width={1000} height={600} />
      
      {/* Annotation overlay */}
      <TimelineAnnotations
        timelineRef={timelineRef}
        xScale={xScale}
        yScale={yScale}
        annotations={annotations}
        currentUser={currentUser}
        onAnnotationAdd={setAnnotations}
      />
    </div>
  );
};
```

### 2. With Collaboration
```tsx
import { useAnnotationCollaboration } from './components/Charts/timeline';

const CollaborativeTimeline = () => {
  const collaboration = useAnnotationCollaboration(annotations, {
    enabled: true,
    currentUser: currentUser,
    onAnnotationUpdate: handleRemoteUpdate
  });
  
  return (
    <TimelineAnnotations
      // ... other props
      isCollaborativeMode={collaboration.isConnected}
      onCollaborativeUpdate={collaboration.broadcastAnnotationUpdated}
    />
  );
};
```

### 3. Complete Example
See `TimelineAnnotationExample.tsx` for a full implementation with all features enabled.

## 🔧 Configuration Options

### Performance Settings
```typescript
const performanceOptions = {
  virtualizationThreshold: 50,    // Enable virtualization above this count
  maxAnnotationsDisplay: 100,     // Limit displayed annotations
  debounceSearch: 300,           // Search debounce delay (ms)
  collaborationHeartbeat: 30000  // Heartbeat interval (ms)
};
```

### Feature Toggles
```typescript
const featureFlags = {
  showCategories: true,
  showFilters: true,
  showSearch: true,
  showExport: true,
  showVersionHistory: true,
  allowRichText: true,
  enableCollaboration: true,
  enableMentions: true,
  enableReactions: true,
  enableAttachments: true
};
```

## 🐛 Troubleshooting

### Common Issues

**Annotations not appearing**
- Check if `timelineRef` is properly connected
- Verify `xScale` and `yScale` are correctly configured
- Ensure annotations have valid timestamps within the timeline range

**Collaboration not working**
- Verify WebSocket connection URL is correct
- Check if the collaboration server is running
- Ensure user permissions allow collaboration

**Export failures**
- Check browser console for specific error messages
- Verify annotation data structure is complete
- Ensure sufficient memory for large exports

### Debug Mode
Enable debug logging:
```typescript
const collaboration = useAnnotationCollaboration(annotations, {
  // ... other options
  debug: true
});
```

## 🔮 Future Enhancements

### Planned Features
- **Voice annotations** with audio recording
- **Video annotations** with timestamp sync
- **Drawing annotations** with sketch tools
- **Template system** for common annotation types
- **Bulk operations** for annotation management
- **Advanced analytics** and reporting
- **Mobile app support** with touch gestures
- **Offline mode** with sync when online
- **API integration** with external systems
- **Custom notification** system

### Integration Opportunities
- **Slack/Teams** notifications for mentions
- **JIRA/GitHub** issue linking
- **Calendar** integration for scheduled annotations
- **Email** digest summaries
- **Dashboard** widgets for annotation metrics

## 📚 Related Documentation

- [Timeline Chart Documentation](./README.md)
- [Chart Accessibility Guide](../accessibility/AccessibilityGuide.md)
- [WebSocket Services](../../../services/websocket/README.md)
- [Mission Control Architecture](../../layout/MissionControl/ARCHITECTURE.md)

## 🤝 Contributing

When contributing to the annotation system:

1. **Follow TypeScript** strict mode requirements
2. **Add comprehensive tests** for new features
3. **Update documentation** for API changes
4. **Consider accessibility** in all UI changes
5. **Test collaboration features** with multiple users
6. **Validate export formats** with sample data
7. **Check performance** with large datasets

## 📄 License

This annotation system is part of the Rover Mission Control project and follows the same licensing terms.
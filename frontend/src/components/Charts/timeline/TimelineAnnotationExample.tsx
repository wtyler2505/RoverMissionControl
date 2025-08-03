/**
 * TimelineAnnotationExample - Complete Example Implementation
 * 
 * Demonstrates the full annotation system including:
 * - Timeline chart with annotations
 * - Real-time collaboration
 * - Annotation sidebar
 * - Export functionality
 * - Comprehensive filtering
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  useTheme
} from '@mui/material';
import { Comment as CommentIcon, GetApp as ExportIcon } from '@mui/icons-material';
import * as d3 from 'd3';
import { addDays, subDays } from 'date-fns';

import {
  TimelineChart,
  TimelineAnnotations,
  AnnotationSidebar,
  useAnnotationCollaboration,
  AnnotationExporter
} from './index';
import {
  TimelineAnnotation,
  AnnotationAuthor,
  AnnotationCategory,
  AnnotationFilter,
  GanttTask,
  MissionEvent,
  ExportResult
} from './index';

// Mock data
const MOCK_CURRENT_USER: AnnotationAuthor = {
  id: 'user-1',
  name: 'John Operator',
  avatar: '/avatars/john.jpg',
  role: 'operator',
  permissions: [
    { action: 'read', scope: 'all' },
    { action: 'write', scope: 'own' },
    { action: 'delete', scope: 'own' }
  ]
};

const MOCK_CATEGORIES: AnnotationCategory[] = [
  { id: 'observation', name: 'Observation', color: '#2196F3', icon: 'visibility' },
  { id: 'issue', name: 'Issue', color: '#F44336', icon: 'warning' },
  { id: 'milestone', name: 'Milestone', color: '#4CAF50', icon: 'flag' },
  { id: 'decision', name: 'Decision', color: '#FF9800', icon: 'gavel' },
  { id: 'note', name: 'Note', color: '#9C27B0', icon: 'note' }
];

const MOCK_AUTHORS: AnnotationAuthor[] = [
  MOCK_CURRENT_USER,
  {
    id: 'user-2',
    name: 'Sarah Engineer',
    avatar: '/avatars/sarah.jpg',
    role: 'engineer',
    permissions: [
      { action: 'read', scope: 'all' },
      { action: 'write', scope: 'all' },
      { action: 'delete', scope: 'team' }
    ]
  },
  {
    id: 'user-3',
    name: 'Mike Supervisor',
    avatar: '/avatars/mike.jpg',
    role: 'supervisor',
    permissions: [
      { action: 'read', scope: 'all' },
      { action: 'write', scope: 'all' },
      { action: 'delete', scope: 'all' },
      { action: 'moderate', scope: 'all' }
    ]
  }
];

const MOCK_TASKS: GanttTask[] = [
  {
    id: 'task-1',
    name: 'Initialize Rover Systems',
    startDate: new Date(),
    endDate: addDays(new Date(), 2),
    progress: 75,
    status: 'in-progress',
    priority: 'high',
    category: 'system'
  },
  {
    id: 'task-2',
    name: 'Calibrate Sensors',
    startDate: addDays(new Date(), 1),
    endDate: addDays(new Date(), 3),
    progress: 30,
    status: 'in-progress',
    priority: 'medium',
    category: 'calibration',
    dependencies: ['task-1']
  },
  {
    id: 'task-3',
    name: 'Test Communication Link',
    startDate: addDays(new Date(), 2),
    endDate: addDays(new Date(), 4),
    progress: 0,
    status: 'pending',
    priority: 'critical',
    category: 'communication'
  }
];

const MOCK_EVENTS: MissionEvent[] = [
  {
    id: 'event-1',
    timestamp: addDays(new Date(), 1),
    type: 'milestone',
    severity: 'info',
    title: 'System Initialization Complete',
    description: 'All rover systems have been successfully initialized'
  },
  {
    id: 'event-2',
    timestamp: addDays(new Date(), 2),
    type: 'alert',
    severity: 'warning',
    title: 'Low Battery Warning',
    description: 'Battery level dropping faster than expected'
  }
];

const generateMockAnnotations = (): TimelineAnnotation[] => [
  {
    id: 'ann-1',
    timestamp: new Date(),
    threadId: 'thread-1',
    content: 'System initialization proceeding normally. All subsystems responding correctly.',
    author: MOCK_AUTHORS[0],
    category: MOCK_CATEGORIES[0], // Observation
    tags: ['initialization', 'systems'],
    visibility: 'public',
    priority: 'medium',
    status: 'published',
    replies: [
      {
        id: 'ann-1-reply-1',
        timestamp: addDays(new Date(), 0.1),
        threadId: 'thread-1',
        parentId: 'ann-1',
        content: 'Confirmed. Telemetry shows all green.',
        author: MOCK_AUTHORS[1],
        category: MOCK_CATEGORIES[0],
        tags: ['telemetry'],
        visibility: 'public',
        priority: 'low',
        status: 'published',
        replies: [],
        attachments: [],
        mentions: [],
        reactions: [
          { emoji: '👍', count: 2, users: ['user-1', 'user-3'] }
        ],
        version: 1,
        history: [],
        createdAt: addDays(new Date(), 0.1),
        updatedAt: addDays(new Date(), 0.1),
        metadata: {}
      }
    ],
    attachments: [],
    mentions: ['user-2'],
    reactions: [
      { emoji: '👍', count: 3, users: ['user-1', 'user-2', 'user-3'] },
      { emoji: '✅', count: 1, users: ['user-2'] }
    ],
    version: 1,
    history: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {}
  },
  {
    id: 'ann-2',
    timestamp: addDays(new Date(), 1),
    threadId: 'thread-2',
    content: 'Battery drain rate higher than expected during sensor calibration. Investigating power management.',
    author: MOCK_AUTHORS[1],
    category: MOCK_CATEGORIES[1], // Issue
    tags: ['battery', 'power', 'sensors'],
    visibility: 'team',
    priority: 'high',
    status: 'published',
    replies: [],
    attachments: [
      {
        id: 'att-1',
        name: 'power_consumption_graph.png',
        type: 'image',
        url: '/attachments/power_consumption_graph.png',
        size: 245760,
        uploadedAt: addDays(new Date(), 1)
      }
    ],
    mentions: ['user-3'],
    reactions: [
      { emoji: '⚠️', count: 2, users: ['user-1', 'user-3'] }
    ],
    version: 2,
    history: [
      {
        version: 1,
        content: 'Battery drain rate higher than expected during sensor calibration.',
        author: 'user-2',
        timestamp: addDays(new Date(), 1),
        changes: 'Added investigation note'
      }
    ],
    createdAt: addDays(new Date(), 1),
    updatedAt: addDays(new Date(), 1.1),
    metadata: {}
  },
  {
    id: 'ann-3',
    timestamp: addDays(new Date(), 2),
    threadId: 'thread-3',
    content: 'Decision: Proceeding with communication link test despite battery concerns. Monitor closely.',
    author: MOCK_AUTHORS[2],
    category: MOCK_CATEGORIES[3], // Decision
    tags: ['decision', 'communication', 'risk'],
    visibility: 'public',
    priority: 'critical',
    status: 'published',
    replies: [],
    attachments: [],
    mentions: ['user-1', 'user-2'],
    reactions: [
      { emoji: '⚡', count: 1, users: ['user-1'] },
      { emoji: '🤔', count: 1, users: ['user-2'] }
    ],
    version: 1,
    history: [],
    createdAt: addDays(new Date(), 2),
    updatedAt: addDays(new Date(), 2),
    metadata: {}
  }
];

/**
 * TimelineAnnotationExample Component
 * Complete example showcasing all annotation features
 */
export const TimelineAnnotationExample: React.FC = () => {
  const theme = useTheme();
  const timelineRef = useRef<SVGSVGElement>(null);
  
  // State
  const [annotations, setAnnotations] = useState<TimelineAnnotation[]>(generateMockAnnotations());
  const [filter, setFilter] = useState<AnnotationFilter>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({
    open: false,
    message: '',
    severity: 'info'
  });
  const [exportDialog, setExportDialog] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Timeline configuration
  const startDate = subDays(new Date(), 1);
  const endDate = addDays(new Date(), 5);
  const currentTime = new Date();

  // Scales
  const xScale = useMemo(() => {
    return d3.scaleTime()
      .domain([startDate, endDate])
      .range([0, 800]); // Inner width
  }, [startDate, endDate]);

  const yScale = useMemo(() => {
    return d3.scaleBand()
      .domain(MOCK_TASKS.map(t => t.id))
      .range([0, 400]) // Inner height
      .padding(0.2);
  }, []);

  // Collaboration
  const collaboration = useAnnotationCollaboration(annotations, {
    enabled: true,
    currentUser: MOCK_CURRENT_USER,
    onAnnotationUpdate: (annotation) => {
      setAnnotations(prev => prev.map(a => a.id === annotation.id ? annotation : a));
      setSnackbar({
        open: true,
        message: `Annotation updated by ${annotation.author.name}`,
        severity: 'info'
      });
    },
    onAnnotationDelete: (annotationId) => {
      setAnnotations(prev => prev.filter(a => a.id !== annotationId));
      setSnackbar({
        open: true,
        message: 'Annotation deleted',
        severity: 'warning'
      });
    },
    onUserJoin: (user) => {
      setSnackbar({
        open: true,
        message: `${user.name} joined the session`,
        severity: 'info'
      });
    },
    onUserLeave: (userId) => {
      const user = MOCK_AUTHORS.find(a => a.id === userId);
      setSnackbar({
        open: true,
        message: `${user?.name || 'User'} left the session`,
        severity: 'info'
      });
    }
  });

  // Handle annotation addition
  const handleAnnotationAdd = useCallback((newAnnotation: Omit<TimelineAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => {
    const annotation: TimelineAnnotation = {
      ...newAnnotation,
      id: `ann-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setAnnotations(prev => [...prev, annotation]);
    collaboration.broadcastAnnotationAdded(annotation);
    
    setSnackbar({
      open: true,
      message: 'Annotation added successfully',
      severity: 'success'
    });
  }, [collaboration]);

  // Handle annotation update
  const handleAnnotationUpdate = useCallback((id: string, updates: Partial<TimelineAnnotation>) => {
    setAnnotations(prev => prev.map(annotation => {
      if (annotation.id === id) {
        const previousVersion = annotation.version;
        const updatedAnnotation = {
          ...annotation,
          ...updates,
          version: annotation.version + 1,
          updatedAt: new Date()
        };
        
        collaboration.broadcastAnnotationUpdated(updatedAnnotation, previousVersion);
        return updatedAnnotation;
      }
      return annotation;
    }));
    
    setSnackbar({
      open: true,
      message: 'Annotation updated successfully',
      severity: 'success'
    });
  }, [collaboration]);

  // Handle annotation deletion
  const handleAnnotationDelete = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    collaboration.broadcastAnnotationDeleted(id);
    
    setSnackbar({
      open: true,
      message: 'Annotation deleted successfully',
      severity: 'success'
    });
  }, [collaboration]);

  // Handle reply
  const handleReply = useCallback((parentId: string, reply: Omit<TimelineAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => {
    const replyAnnotation: TimelineAnnotation = {
      ...reply,
      id: `reply-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setAnnotations(prev => prev.map(annotation => {
      if (annotation.id === parentId) {
        return {
          ...annotation,
          replies: [...annotation.replies, replyAnnotation]
        };
      }
      return annotation;
    }));
    
    setSnackbar({
      open: true,
      message: 'Reply added successfully',
      severity: 'success'
    });
  }, []);

  // Handle export
  const handleExport = useCallback(async (format: 'json' | 'csv' | 'pdf', options?: any) => {
    setExporting(true);
    
    try {
      const exporter = new AnnotationExporter();
      const result: ExportResult = await exporter.exportAnnotations(annotations, {
        format,
        includeReplies: true,
        includeAttachments: true,
        includeMentions: true,
        includeReactions: true,
        filters: filter,
        ...options
      });
      
      if (result.success) {
        AnnotationExporter.downloadExport(result);
        setSnackbar({
          open: true,
          message: `Annotations exported as ${format.toUpperCase()}`,
          severity: 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: `Export failed: ${result.error}`,
          severity: 'error'
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setExporting(false);
      setExportDialog(false);
    }
  }, [annotations, filter]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" fontWeight="bold">
          Timeline Annotations Demo
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {collaboration.isConnected && (
            <Alert severity="success" sx={{ py: 0.5 }}>
              Connected ({collaboration.onlineUsers.length} users online)
            </Alert>
          )}
          
          <Button
            startIcon={<CommentIcon />}
            onClick={() => setSidebarOpen(true)}
            variant="outlined"
          >
            Annotations ({annotations.length})
          </Button>
          
          <Button
            startIcon={<ExportIcon />}
            onClick={() => setExportDialog(true)}
            variant="outlined"
          >
            Export
          </Button>
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', position: 'relative' }}>
        {/* Timeline Chart */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Paper sx={{ height: '100%', position: 'relative' }}>
            <TimelineChart
              ref={timelineRef}
              tasks={MOCK_TASKS}
              events={MOCK_EVENTS}
              annotations={annotations}
              startDate={startDate}
              endDate={endDate}
              currentTime={currentTime}
              width={1000}
              height={600}
              margin={{ top: 40, right: 40, bottom: 60, left: 200 }}
              showAnnotations={true}
              showEvents={true}
              showDependencies={true}
              showProgress={true}
            />
            
            {/* Annotation Overlay */}
            <TimelineAnnotations
              timelineRef={timelineRef}
              xScale={xScale}
              yScale={yScale}
              width={1000}
              height={600}
              margin={{ top: 40, right: 40, bottom: 60, left: 200 }}
              annotations={annotations}
              categories={MOCK_CATEGORIES}
              currentUser={MOCK_CURRENT_USER}
              availableUsers={MOCK_AUTHORS}
              onAnnotationAdd={handleAnnotationAdd}
              onAnnotationUpdate={handleAnnotationUpdate}
              onAnnotationDelete={handleAnnotationDelete}
              onAnnotationReply={handleReply}
              isCollaborativeMode={collaboration.isConnected}
              showCategories={true}
              showFilters={true}
              showSearch={true}
              showExport={true}
              allowRichText={true}
            />
          </Paper>
        </Box>

        {/* Annotation Sidebar */}
        <AnnotationSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          annotations={annotations}
          categories={MOCK_CATEGORIES}
          authors={MOCK_AUTHORS}
          currentUser={MOCK_CURRENT_USER}
          filter={filter}
          onFilterChange={setFilter}
          onExport={handleExport}
          width={360}
        />
      </Box>

      {/* Export Dialog */}
      <Dialog open={exportDialog} onClose={() => setExportDialog(false)}>
        <DialogTitle>Export Annotations</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Choose export format for {annotations.length} annotations
          </Typography>
          
          {exporting && <LinearProgress sx={{ mb: 2 }} />}
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => handleExport('json')}
              disabled={exporting}
              fullWidth
            >
              JSON (Complete Data)
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleExport('csv')}
              disabled={exporting}
              fullWidth
            >
              CSV (Spreadsheet)
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleExport('pdf')}
              disabled={exporting}
              fullWidth
            >
              PDF (Report)
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog(false)} disabled={exporting}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Collaboration Conflicts */}
      {collaboration.conflicts.map(conflict => (
        <Dialog
          key={conflict.annotationId}
          open={true}
          onClose={() => collaboration.resolveConflict(conflict, 'use_remote')}
        >
          <DialogTitle>Annotation Conflict</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              This annotation was modified by another user while you were editing it.
            </Alert>
            
            <Typography variant="subtitle2" gutterBottom>
              Your version:
            </Typography>
            <Paper sx={{ p: 1, mb: 2, bgcolor: 'grey.50' }}>
              <Typography variant="body2">
                {conflict.localVersion.content}
              </Typography>
            </Paper>
            
            <Typography variant="subtitle2" gutterBottom>
              Remote version:
            </Typography>
            <Paper sx={{ p: 1, bgcolor: 'grey.50' }}>
              <Typography variant="body2">
                {conflict.remoteVersion.content}
              </Typography>
            </Paper>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => collaboration.resolveConflict(conflict, 'use_local')}>
              Use My Version
            </Button>
            <Button onClick={() => collaboration.resolveConflict(conflict, 'use_remote')}>
              Use Remote Version
            </Button>
            <Button 
              onClick={() => collaboration.resolveConflict(conflict, 'merge')}
              variant="contained"
            >
              Merge Both
            </Button>
          </DialogActions>
        </Dialog>
      ))}
    </Box>
  );
};

export default TimelineAnnotationExample;
/**
 * TimelineAnnotations - Collaborative Timeline Annotation System
 * 
 * A comprehensive annotation system for timeline charts supporting:
 * - Click-to-add annotations with rich text editing
 * - Threaded comments and replies
 * - Real-time collaborative features
 * - User attribution and permissions
 * - Category-based organization
 * - Export capabilities
 * - Mention system and attachments
 * - Search and filtering
 * - Version history
 */

import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  useRef,
  memo
} from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Avatar,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  Badge,
  Popover,
  InputAdornment,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  Collapse,
  Alert,
  LinearProgress,
  useTheme,
  alpha,
  styled
} from '@mui/material';
import {
  Add as AddIcon,
  Comment as CommentIcon,
  Reply as ReplyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  AttachFile as AttachFileIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
  PersonAdd as MentionIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
  Send as SendIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Category as CategoryIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  StarBorder as StarBorderIcon,
  Star as StarIcon,
  Lock as LockIcon,
  Public as PublicIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import * as d3 from 'd3';
import DOMPurify from 'dompurify';
import { v4 as uuidv4 } from 'uuid';
import Editor from '@monaco-editor/react';

// Types and Interfaces
export interface TimelineAnnotation {
  id: string;
  timestamp: Date;
  endTimestamp?: Date; // For range annotations
  content: string;
  htmlContent?: string; // Rich text content
  author: AnnotationAuthor;
  category: AnnotationCategory;
  tags: string[];
  visibility: 'public' | 'private' | 'team';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'published' | 'archived';
  replies: TimelineAnnotation[];
  attachments: AnnotationAttachment[];
  mentions: string[]; // User IDs mentioned
  reactions: AnnotationReaction[];
  version: number;
  history: AnnotationVersion[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
  position?: { x: number; y: number }; // Screen coordinates
  parentId?: string; // For replies
  threadId: string; // Top-level thread identifier
}

export interface AnnotationAuthor {
  id: string;
  name: string;
  avatar?: string;
  role: 'operator' | 'supervisor' | 'engineer' | 'analyst' | 'admin';
  permissions: AnnotationPermission[];
}

export interface AnnotationCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
}

export interface AnnotationAttachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'video' | 'audio' | 'link';
  url: string;
  size?: number;
  uploadedAt: Date;
}

export interface AnnotationReaction {
  emoji: string;
  count: number;
  users: string[]; // User IDs who reacted
}

export interface AnnotationVersion {
  version: number;
  content: string;
  htmlContent?: string;
  author: string;
  timestamp: Date;
  changes: string; // Description of changes
}

export interface AnnotationPermission {
  action: 'read' | 'write' | 'delete' | 'moderate';
  scope: 'own' | 'team' | 'all';
}

export interface AnnotationFilter {
  authors?: string[];
  categories?: string[];
  dateRange?: { start: Date; end: Date };
  tags?: string[];
  visibility?: ('public' | 'private' | 'team')[];
  status?: ('draft' | 'published' | 'archived')[];
  searchQuery?: string;
}

export interface MentionUser {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
}

// Styled Components
const AnnotationMarker = styled(Box)<{ 
  category: AnnotationCategory; 
  isActive?: boolean;
  hasReplies?: boolean;
}>(({ theme, category, isActive, hasReplies }) => ({
  position: 'absolute',
  width: 12,
  height: 12,
  borderRadius: '50%',
  backgroundColor: category.color,
  border: `2px solid ${theme.palette.background.paper}`,
  cursor: 'pointer',
  zIndex: 1000,
  transition: 'all 0.2s ease-in-out',
  boxShadow: isActive 
    ? `0 0 0 4px ${alpha(category.color, 0.3)}` 
    : hasReplies 
      ? `0 0 0 2px ${alpha(category.color, 0.5)}`
      : 'none',
  transform: isActive ? 'scale(1.5)' : 'scale(1)',
  '&:hover': {
    transform: 'scale(1.3)',
    boxShadow: `0 0 0 3px ${alpha(category.color, 0.4)}`
  }
}));

const AnnotationTooltip = styled(Paper)(({ theme }) => ({
  maxWidth: 300,
  padding: theme.spacing(1),
  fontSize: '0.875rem',
  pointerEvents: 'none'
}));

const RichEditor = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  minHeight: 150,
  '& .monaco-editor': {
    borderRadius: theme.shape.borderRadius
  }
}));

// Default Categories
const DEFAULT_CATEGORIES: AnnotationCategory[] = [
  { id: 'observation', name: 'Observation', color: '#2196F3', icon: 'visibility' },
  { id: 'issue', name: 'Issue', color: '#F44336', icon: 'warning' },
  { id: 'milestone', name: 'Milestone', color: '#4CAF50', icon: 'flag' },
  { id: 'decision', name: 'Decision', color: '#FF9800', icon: 'gavel' },
  { id: 'note', name: 'Note', color: '#9C27B0', icon: 'note' },
  { id: 'question', name: 'Question', color: '#00BCD4', icon: 'help' }
];

// Props Interface
export interface TimelineAnnotationsProps {
  // Timeline configuration
  timelineRef: React.RefObject<SVGSVGElement>;
  xScale: d3.ScaleTime<number, number>;
  yScale: d3.ScaleBand<string>;
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  
  // Data
  annotations: TimelineAnnotation[];
  categories?: AnnotationCategory[];
  currentUser: AnnotationAuthor;
  availableUsers?: MentionUser[];
  
  // Event handlers
  onAnnotationAdd?: (annotation: Omit<TimelineAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onAnnotationUpdate?: (id: string, updates: Partial<TimelineAnnotation>) => void;
  onAnnotationDelete?: (id: string) => void;
  onAnnotationReply?: (parentId: string, reply: Omit<TimelineAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onMentionUser?: (userId: string, annotationId: string) => void;
  onExport?: (format: 'json' | 'csv' | 'pdf') => void;
  
  // Real-time collaboration
  onCollaborativeUpdate?: (annotation: TimelineAnnotation) => void;
  isCollaborativeMode?: boolean;
  
  // UI Configuration
  showCategories?: boolean;
  showFilters?: boolean;
  showSearch?: boolean;
  showExport?: boolean;
  showVersionHistory?: boolean;
  allowRichText?: boolean;
  maxAnnotationsDisplay?: number;
  
  // Accessibility
  ariaLabel?: string;
  
  // Performance
  virtualizationThreshold?: number;
}

/**
 * TimelineAnnotations Component
 * Main component for handling timeline annotations with collaborative features
 */
export const TimelineAnnotations: React.FC<TimelineAnnotationsProps> = memo(({
  timelineRef,
  xScale,
  yScale,
  width,
  height,
  margin,
  annotations = [],
  categories = DEFAULT_CATEGORIES,
  currentUser,
  availableUsers = [],
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  onAnnotationReply,
  onMentionUser,
  onExport,
  onCollaborativeUpdate,
  isCollaborativeMode = false,
  showCategories = true,
  showFilters = true,
  showSearch = true,
  showExport = true,
  showVersionHistory = true,
  allowRichText = true,
  maxAnnotationsDisplay = 100,
  virtualizationThreshold = 50,
  ariaLabel = "Timeline annotations"
}) => {
  const theme = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<TimelineAnnotation | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<TimelineAnnotation | null>(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<TimelineAnnotation | null>(null);
  const [filter, setFilter] = useState<AnnotationFilter>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [addPosition, setAddPosition] = useState<{ x: number; y: number; timestamp: Date } | null>(null);
  
  // Dialog states
  const [annotationDialog, setAnnotationDialog] = useState(false);
  const [filterDialog, setFilterDialog] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [versionHistory, setVersionHistory] = useState<AnnotationVersion[]>([]);
  
  // Rich text editor state
  const [editorContent, setEditorContent] = useState('');
  const [editorMode, setEditorMode] = useState<'plain' | 'rich'>('plain');
  
  // Refs
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Filter and search annotations
  const filteredAnnotations = useMemo(() => {
    let filtered = [...annotations];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ann => 
        ann.content.toLowerCase().includes(query) ||
        ann.author.name.toLowerCase().includes(query) ||
        ann.tags.some(tag => tag.toLowerCase().includes(query)) ||
        ann.category.name.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter
    if (filter.categories?.length) {
      filtered = filtered.filter(ann => filter.categories!.includes(ann.category.id));
    }
    
    // Apply author filter
    if (filter.authors?.length) {
      filtered = filtered.filter(ann => filter.authors!.includes(ann.author.id));
    }
    
    // Apply date range filter
    if (filter.dateRange) {
      filtered = filtered.filter(ann => 
        ann.timestamp >= filter.dateRange!.start && 
        ann.timestamp <= filter.dateRange!.end
      );
    }
    
    // Apply visibility filter
    if (filter.visibility?.length) {
      filtered = filtered.filter(ann => filter.visibility!.includes(ann.visibility));
    }
    
    // Apply status filter
    if (filter.status?.length) {
      filtered = filtered.filter(ann => filter.status!.includes(ann.status));
    }
    
    // Sort by timestamp
    filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Limit display if needed
    if (filtered.length > maxAnnotationsDisplay) {
      filtered = filtered.slice(0, maxAnnotationsDisplay);
    }
    
    return filtered;
  }, [annotations, filter, searchQuery, maxAnnotationsDisplay]);

  // Handle timeline click to add annotation
  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    if (!timelineRef.current || !onAnnotationAdd) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - margin.left;
    const y = event.clientY - rect.top - margin.top;
    
    // Convert x position to timestamp
    const timestamp = xScale.invert(x);
    
    setAddPosition({ x: event.clientX, y: event.clientY, timestamp });
    setAnnotationDialog(true);
    setIsAdding(true);
  }, [timelineRef, xScale, margin, onAnnotationAdd]);

  // Handle annotation save
  const handleAnnotationSave = useCallback(async (annotationData: {
    content: string;
    htmlContent?: string;
    category: AnnotationCategory;
    tags: string[];
    visibility: 'public' | 'private' | 'team';
    priority: 'low' | 'medium' | 'high' | 'critical';
    mentions: string[];
    attachments: AnnotationAttachment[];
  }) => {
    if (!addPosition && !editingAnnotation) return;
    
    if (editingAnnotation) {
      // Update existing annotation
      const updates: Partial<TimelineAnnotation> = {
        ...annotationData,
        updatedAt: new Date(),
        version: editingAnnotation.version + 1,
        history: [
          ...editingAnnotation.history,
          {
            version: editingAnnotation.version,
            content: editingAnnotation.content,
            htmlContent: editingAnnotation.htmlContent,
            author: editingAnnotation.author.id,
            timestamp: editingAnnotation.updatedAt,
            changes: 'Content updated'
          }
        ]
      };
      
      onAnnotationUpdate?.(editingAnnotation.id, updates);
    } else if (addPosition) {
      // Create new annotation
      const newAnnotation: Omit<TimelineAnnotation, 'id' | 'createdAt' | 'updatedAt'> = {
        timestamp: addPosition.timestamp,
        threadId: uuidv4(),
        author: currentUser,
        replies: [],
        reactions: [],
        version: 1,
        history: [],
        status: 'published',
        metadata: {},
        ...annotationData
      };
      
      onAnnotationAdd?.(newAnnotation);
    }
    
    setAnnotationDialog(false);
    setIsAdding(false);
    setEditingAnnotation(null);
    setAddPosition(null);
    setEditorContent('');
  }, [addPosition, editingAnnotation, currentUser, onAnnotationAdd, onAnnotationUpdate]);

  // Handle annotation reply
  const handleReplyAdd = useCallback((parentId: string, content: string, htmlContent?: string) => {
    if (!onAnnotationReply) return;
    
    const parent = annotations.find(ann => ann.id === parentId);
    if (!parent) return;
    
    const reply: Omit<TimelineAnnotation, 'id' | 'createdAt' | 'updatedAt'> = {
      timestamp: new Date(),
      threadId: parent.threadId,
      parentId,
      content,
      htmlContent,
      author: currentUser,
      category: parent.category,
      tags: [],
      visibility: parent.visibility,
      priority: 'medium',
      status: 'published',
      replies: [],
      attachments: [],
      mentions: [],
      reactions: [],
      version: 1,
      history: [],
      metadata: {}
    };
    
    onAnnotationReply(parentId, reply);
  }, [annotations, currentUser, onAnnotationReply]);

  // Render annotation markers on timeline
  const renderAnnotationMarkers = useCallback(() => {
    if (!timelineRef.current) return null;
    
    return filteredAnnotations.map(annotation => {
      const x = xScale(annotation.timestamp);
      const y = yScale.bandwidth() / 2; // Center vertically
      
      if (x < 0 || x > width - margin.left - margin.right) return null;
      
      const isActive = selectedAnnotation?.id === annotation.id;
      const hasReplies = annotation.replies.length > 0;
      
      return (
        <AnnotationMarker
          key={annotation.id}
          category={annotation.category}
          isActive={isActive}
          hasReplies={hasReplies}
          style={{
            left: margin.left + x - 6,
            top: margin.top + y - 6
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedAnnotation(annotation);
          }}
          onMouseEnter={() => setHoveredAnnotation(annotation)}
          onMouseLeave={() => setHoveredAnnotation(null)}
          role="button"
          tabIndex={0}
          aria-label={`Annotation by ${annotation.author.name}: ${annotation.content.substring(0, 50)}...`}
        />
      );
    });
  }, [filteredAnnotations, xScale, yScale, width, margin, selectedAnnotation]);

  // Render annotation tooltip
  const renderTooltip = useCallback(() => {
    if (!hoveredAnnotation) return null;
    
    return (
      <Popover
        open={!!hoveredAnnotation}
        anchorReference="anchorPosition"
        anchorPosition={{ top: 100, left: 100 }}
        onClose={() => setHoveredAnnotation(null)}
        disableRestoreFocus
        PaperComponent={AnnotationTooltip}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight="bold">
            {hoveredAnnotation.author.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {format(hoveredAnnotation.timestamp, 'MMM dd, yyyy HH:mm')}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {hoveredAnnotation.content.substring(0, 100)}
            {hoveredAnnotation.content.length > 100 && '...'}
          </Typography>
          {hoveredAnnotation.replies.length > 0 && (
            <Typography variant="caption" color="primary">
              {hoveredAnnotation.replies.length} replies
            </Typography>
          )}
        </Box>
      </Popover>
    );
  }, [hoveredAnnotation]);

  // Rich text editor component
  const RichTextEditor = memo(({ 
    value, 
    onChange, 
    height = 200 
  }: { 
    value: string; 
    onChange: (value: string) => void; 
    height?: number; 
  }) => (
    <RichEditor>
      <Editor
        height={height}
        defaultLanguage="markdown"
        value={value}
        onChange={(value) => onChange(value || '')}
        theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'vs'}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbers: 'off',
          folding: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 0,
          renderLineHighlight: 'none'
        }}
      />
    </RichEditor>
  ));

  // Annotation dialog component
  const AnnotationDialog = memo(() => {
    const [content, setContent] = useState(editingAnnotation?.content || '');
    const [selectedCategory, setSelectedCategory] = useState<AnnotationCategory>(
      editingAnnotation?.category || categories[0]
    );
    const [selectedTags, setSelectedTags] = useState<string[]>(editingAnnotation?.tags || []);
    const [visibility, setVisibility] = useState<'public' | 'private' | 'team'>(
      editingAnnotation?.visibility || 'public'
    );
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(
      editingAnnotation?.priority || 'medium'
    );
    const [mentions, setMentions] = useState<string[]>(editingAnnotation?.mentions || []);
    const [attachments, setAttachments] = useState<AnnotationAttachment[]>(
      editingAnnotation?.attachments || []
    );
    
    const handleSave = () => {
      if (!content.trim()) return;
      
      handleAnnotationSave({
        content: content.trim(),
        htmlContent: allowRichText ? DOMPurify.sanitize(content) : undefined,
        category: selectedCategory,
        tags: selectedTags,
        visibility,
        priority,
        mentions,
        attachments
      });
    };
    
    return (
      <Dialog
        open={annotationDialog}
        onClose={() => setAnnotationDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '60vh' }
        }}
      >
        <DialogTitle>
          {editingAnnotation ? 'Edit Annotation' : 'Add New Annotation'}
          {addPosition && (
            <Typography variant="caption" display="block" color="text.secondary">
              At {format(addPosition.timestamp, 'MMM dd, yyyy HH:mm:ss')}
            </Typography>
          )}
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Content Editor */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Content
              </Typography>
              {allowRichText ? (
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  height={200}
                />
              ) : (
                <TextField
                  multiline
                  rows={6}
                  fullWidth
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your annotation..."
                />
              )}
            </Box>
            
            {/* Category Selection */}
            <FormControl>
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory.id}
                onChange={(e) => {
                  const category = categories.find(cat => cat.id === e.target.value);
                  if (category) setSelectedCategory(category);
                }}
                label="Category"
              >
                {categories.map(category => (
                  <MenuItem key={category.id} value={category.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box 
                        sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          backgroundColor: category.color 
                        }} 
                      />
                      {category.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {/* Additional Options */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Visibility</InputLabel>
                <Select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  label="Visibility"
                >
                  <MenuItem value="public">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PublicIcon fontSize="small" />
                      Public
                    </Box>
                  </MenuItem>
                  <MenuItem value="team">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon fontSize="small" />
                      Team
                    </Box>
                  </MenuItem>
                  <MenuItem value="private">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LockIcon fontSize="small" />
                      Private
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
              
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  label="Priority"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            {/* Tags Input */}
            <TextField
              label="Tags (comma-separated)"
              value={selectedTags.join(', ')}
              onChange={(e) => setSelectedTags(
                e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
              )}
              helperText="Add tags to categorize your annotation"
            />
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setAnnotationDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            variant="contained"
            disabled={!content.trim()}
          >
            {editingAnnotation ? 'Update' : 'Add'} Annotation
          </Button>
        </DialogActions>
      </Dialog>
    );
  });

  // Main component render
  return (
    <Box
      ref={overlayRef}
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000
      }}
      aria-label={ariaLabel}
    >
      {/* Click overlay for adding annotations */}
      <Box
        sx={{
          position: 'absolute',
          left: margin.left,
          top: margin.top,
          width: width - margin.left - margin.right,
          height: height - margin.top - margin.bottom,
          pointerEvents: 'auto',
          cursor: 'crosshair'
        }}
        onClick={handleTimelineClick}
      />
      
      {/* Annotation markers */}
      {renderAnnotationMarkers()}
      
      {/* Tooltip */}
      {renderTooltip()}
      
      {/* Annotation dialog */}
      <AnnotationDialog />
      
      {/* Toolbar */}
      <Paper
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          pointerEvents: 'auto',
          zIndex: 1001
        }}
        elevation={2}
      >
        {showSearch && (
          <TextField
            size="small"
            placeholder="Search annotations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ width: 200 }}
          />
        )}
        
        {showFilters && (
          <Tooltip title="Filter annotations">
            <IconButton
              size="small"
              onClick={() => setFilterDialog(true)}
              color={Object.keys(filter).length > 0 ? 'primary' : 'default'}
            >
              <FilterIcon />
            </IconButton>
          </Tooltip>
        )}
        
        <Tooltip title="Toggle hidden annotations">
          <IconButton
            size="small"
            onClick={() => setShowHidden(!showHidden)}
            color={showHidden ? 'primary' : 'default'}
          >
            {showHidden ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </IconButton>
        </Tooltip>
        
        {showExport && (
          <Tooltip title="Export annotations">
            <IconButton
              size="small"
              onClick={() => setExportDialog(true)}
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        )}
        
        <Chip
          label={`${filteredAnnotations.length} annotations`}
          size="small"
          variant="outlined"
        />
      </Paper>
    </Box>
  );
});

TimelineAnnotations.displayName = 'TimelineAnnotations';

export default TimelineAnnotations;
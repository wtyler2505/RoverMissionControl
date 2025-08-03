/**
 * AnnotationSidebar - Annotation Management Sidebar
 * 
 * Provides comprehensive annotation management including:
 * - Filtering and search capabilities
 * - Category management
 * - User management and permissions
 * - Export functionality
 * - Bulk operations
 * - Statistics and analytics
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  ListItemAvatar,
  Divider,
  Badge,
  Tooltip,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  LinearProgress,
  useTheme,
  alpha,
  styled
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Category as CategoryIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  ClearAll as ClearAllIcon,
  SelectAll as SelectAllIcon,
  GetApp as ExportIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, startOfDay, endOfDay, subDays, subWeeks, subMonths } from 'date-fns';

import { 
  TimelineAnnotation, 
  AnnotationFilter, 
  AnnotationCategory, 
  AnnotationAuthor,
  MentionUser
} from './TimelineAnnotations';

// Styled Components
const SidebarHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: theme.palette.background.paper
}));

const FilterSection = styled(AccordionDetails)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5)
}));

const StatsCard = styled(Card)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  backgroundColor: alpha(theme.palette.primary.main, 0.05),
  borderLeft: `4px solid ${theme.palette.primary.main}`
}));

const CategoryChip = styled(Chip)<{ categoryColor?: string }>(({ theme, categoryColor }) => ({
  margin: theme.spacing(0.25),
  backgroundColor: categoryColor ? alpha(categoryColor, 0.1) : undefined,
  borderColor: categoryColor,
  '&.MuiChip-outlined': {
    borderColor: categoryColor
  }
}));

// Props Interface
export interface AnnotationSidebarProps {
  open: boolean;
  onClose: () => void;
  annotations: TimelineAnnotation[];
  categories: AnnotationCategory[];
  authors: AnnotationAuthor[];
  currentUser: AnnotationAuthor;
  filter: AnnotationFilter;
  onFilterChange: (filter: AnnotationFilter) => void;
  onExport?: (format: 'json' | 'csv' | 'pdf', options?: any) => void;
  onImport?: (data: any) => void;
  onCategoryCreate?: (category: Omit<AnnotationCategory, 'id'>) => void;
  onCategoryUpdate?: (id: string, updates: Partial<AnnotationCategory>) => void;
  onCategoryDelete?: (id: string) => void;
  onBulkAction?: (action: 'delete' | 'archive' | 'export', annotationIds: string[]) => void;
  width?: number;
}

// Predefined date ranges
const DATE_RANGES = [
  { label: 'Today', getValue: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }) },
  { label: 'Last 7 days', getValue: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: 'Last 30 days', getValue: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { label: 'Last 3 months', getValue: () => ({ start: subMonths(new Date(), 3), end: new Date() }) },
];

// Export formats
const EXPORT_FORMATS = [
  { value: 'json', label: 'JSON', description: 'Complete data with metadata' },
  { value: 'csv', label: 'CSV', description: 'Tabular format for spreadsheets' },
  { value: 'pdf', label: 'PDF', description: 'Formatted report document' },
];

/**
 * AnnotationSidebar Component
 * Main sidebar component for annotation management
 */
export const AnnotationSidebar: React.FC<AnnotationSidebarProps> = memo(({
  open,
  onClose,
  annotations,
  categories,
  authors,
  currentUser,
  filter,
  onFilterChange,
  onExport,
  onImport,
  onCategoryCreate,
  onCategoryUpdate,
  onCategoryDelete,
  onBulkAction,
  width = 360
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState(filter.searchQuery || '');
  const [selectedAnnotations, setSelectedAnnotations] = useState<Set<string>>(new Set());
  const [exportDialog, setExportDialog] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [bulkMenuAnchor, setBulkMenuAnchor] = useState<null | HTMLElement>(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    color: '#2196F3',
    description: ''
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const filtered = annotations.filter(ann => {
      let matches = true;
      
      if (filter.authors?.length) {
        matches = matches && filter.authors.includes(ann.author.id);
      }
      
      if (filter.categories?.length) {
        matches = matches && filter.categories.includes(ann.category.id);
      }
      
      if (filter.dateRange) {
        matches = matches && ann.timestamp >= filter.dateRange.start && ann.timestamp <= filter.dateRange.end;
      }
      
      if (filter.visibility?.length) {
        matches = matches && filter.visibility.includes(ann.visibility);
      }
      
      if (filter.status?.length) {
        matches = matches && filter.status.includes(ann.status);
      }
      
      return matches;
    });
    
    return {
      total: annotations.length,
      filtered: filtered.length,
      byCategory: categories.map(cat => ({
        ...cat,
        count: filtered.filter(ann => ann.category.id === cat.id).length
      })),
      byAuthor: authors.map(author => ({
        ...author,
        count: filtered.filter(ann => ann.author.id === author.id).length
      })),
      byStatus: {
        published: filtered.filter(ann => ann.status === 'published').length,
        draft: filtered.filter(ann => ann.status === 'draft').length,
        archived: filtered.filter(ann => ann.status === 'archived').length
      },
      withReplies: filtered.filter(ann => ann.replies.length > 0).length,
      withAttachments: filtered.filter(ann => ann.attachments.length > 0).length
    };
  }, [annotations, categories, authors, filter]);

  // Handle search
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    onFilterChange({ ...filter, searchQuery: query });
  }, [filter, onFilterChange]);

  // Handle category filter toggle
  const handleCategoryToggle = useCallback((categoryId: string) => {
    const currentCategories = filter.categories || [];
    const newCategories = currentCategories.includes(categoryId)
      ? currentCategories.filter(id => id !== categoryId)
      : [...currentCategories, categoryId];
    
    onFilterChange({ ...filter, categories: newCategories });
  }, [filter, onFilterChange]);

  // Handle author filter toggle
  const handleAuthorToggle = useCallback((authorId: string) => {
    const currentAuthors = filter.authors || [];
    const newAuthors = currentAuthors.includes(authorId)
      ? currentAuthors.filter(id => id !== authorId)
      : [...currentAuthors, authorId];
    
    onFilterChange({ ...filter, authors: newAuthors });
  }, [filter, onFilterChange]);

  // Handle date range selection
  const handleDateRangeSelect = useCallback((range: { start: Date; end: Date } | null) => {
    onFilterChange({ ...filter, dateRange: range || undefined });
  }, [filter, onFilterChange]);

  // Handle visibility filter
  const handleVisibilityToggle = useCallback((visibility: 'public' | 'private' | 'team') => {
    const currentVisibility = filter.visibility || [];
    const newVisibility = currentVisibility.includes(visibility)
      ? currentVisibility.filter(v => v !== visibility)
      : [...currentVisibility, visibility];
    
    onFilterChange({ ...filter, visibility: newVisibility });
  }, [filter, onFilterChange]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    onFilterChange({});
  }, [onFilterChange]);

  // Handle bulk operations
  const handleBulkAction = useCallback((action: 'delete' | 'archive' | 'export') => {
    if (selectedAnnotations.size === 0) return;
    
    onBulkAction?.(action, Array.from(selectedAnnotations));
    setSelectedAnnotations(new Set());
    setBulkMenuAnchor(null);
  }, [selectedAnnotations, onBulkAction]);

  // Handle export
  const handleExport = useCallback((format: 'json' | 'csv' | 'pdf') => {
    onExport?.(format, { filter, selectedAnnotations: Array.from(selectedAnnotations) });
    setExportDialog(false);
  }, [onExport, filter, selectedAnnotations]);

  // Handle category creation
  const handleCategoryCreate = useCallback(() => {
    if (!newCategory.name.trim()) return;
    
    onCategoryCreate?.({
      name: newCategory.name.trim(),
      color: newCategory.color,
      description: newCategory.description.trim() || undefined
    });
    
    setNewCategory({ name: '', color: '#2196F3', description: '' });
    setCategoryDialog(false);
  }, [newCategory, onCategoryCreate]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="temporary"
      PaperProps={{
        sx: { width, display: 'flex', flexDirection: 'column' }
      }}
    >
      {/* Header */}
      <SidebarHeader>
        <Typography variant="h6" fontWeight="bold">
          Annotations
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </SidebarHeader>

      {/* Statistics */}
      <Box sx={{ p: 2 }}>
        <StatsCard>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="h4" color="primary" fontWeight="bold">
              {stats.filtered}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              of {stats.total} annotations
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip label={`${stats.withReplies} with replies`} size="small" />
              <Chip label={`${stats.withAttachments} with files`} size="small" />
            </Box>
          </CardContent>
        </StatsCard>
      </Box>

      {/* Search */}
      <Box sx={{ p: 2, pt: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search annotations..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {/* Filters */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Categories Filter */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CategoryIcon fontSize="small" />
              <Typography variant="subtitle2">Categories</Typography>
              {(filter.categories?.length || 0) > 0 && (
                <Badge badgeContent={filter.categories?.length} color="primary" />
              )}
            </Box>
          </AccordionSummary>
          <FilterSection>
            <FormGroup>
              {stats.byCategory.map(category => (
                <FormControlLabel
                  key={category.id}
                  control={
                    <Checkbox
                      checked={filter.categories?.includes(category.id) || false}
                      onChange={() => handleCategoryToggle(category.id)}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <Box 
                        sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          backgroundColor: category.color 
                        }} 
                      />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {category.name}
                      </Typography>
                      <Chip label={category.count} size="small" />
                    </Box>
                  }
                />
              ))}
            </FormGroup>
            
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCategoryDialog(true)}
              variant="outlined"
            >
              Add Category
            </Button>
          </FilterSection>
        </Accordion>

        {/* Authors Filter */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon fontSize="small" />
              <Typography variant="subtitle2">Authors</Typography>
              {(filter.authors?.length || 0) > 0 && (
                <Badge badgeContent={filter.authors?.length} color="primary" />
              )}
            </Box>
          </AccordionSummary>
          <FilterSection>
            <FormGroup>
              {stats.byAuthor.map(author => (
                <FormControlLabel
                  key={author.id}
                  control={
                    <Checkbox
                      checked={filter.authors?.includes(author.id) || false}
                      onChange={() => handleAuthorToggle(author.id)}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <Avatar 
                        src={author.avatar}
                        sx={{ width: 20, height: 20 }}
                      >
                        {author.name.charAt(0)}
                      </Avatar>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {author.name}
                      </Typography>
                      <Chip label={author.count} size="small" />
                    </Box>
                  }
                />
              ))}
            </FormGroup>
          </FilterSection>
        </Accordion>

        {/* Date Range Filter */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon fontSize="small" />
              <Typography variant="subtitle2">Date Range</Typography>
              {filter.dateRange && <Badge color="primary" variant="dot" />}
            </Box>
          </AccordionSummary>
          <FilterSection>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {DATE_RANGES.map(range => (
                <Button
                  key={range.label}
                  size="small"
                  variant="outlined"
                  onClick={() => handleDateRangeSelect(range.getValue())}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  {range.label}
                </Button>
              ))}
              
              <Divider sx={{ my: 1 }} />
              
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                onClick={() => handleDateRangeSelect(null)}
              >
                Clear Date Filter
              </Button>
            </Box>
          </FilterSection>
        </Accordion>

        {/* Visibility Filter */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VisibilityIcon fontSize="small" />
              <Typography variant="subtitle2">Visibility</Typography>
              {(filter.visibility?.length || 0) > 0 && (
                <Badge badgeContent={filter.visibility?.length} color="primary" />
              )}
            </Box>
          </AccordionSummary>
          <FilterSection>
            <FormGroup>
              {['public', 'team', 'private'].map(visibility => (
                <FormControlLabel
                  key={visibility}
                  control={
                    <Checkbox
                      checked={filter.visibility?.includes(visibility as any) || false}
                      onChange={() => handleVisibilityToggle(visibility as any)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                      {visibility}
                    </Typography>
                  }
                />
              ))}
            </FormGroup>
          </FilterSection>
        </Accordion>

        {/* Status Filter */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssessmentIcon fontSize="small" />
              <Typography variant="subtitle2">Status</Typography>
              {(filter.status?.length || 0) > 0 && (
                <Badge badgeContent={filter.status?.length} color="primary" />
              )}
            </Box>
          </AccordionSummary>
          <FilterSection>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2">Published</Typography>
                <Chip label={stats.byStatus.published} size="small" />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2">Draft</Typography>
                <Chip label={stats.byStatus.draft} size="small" />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2">Archived</Typography>
                <Chip label={stats.byStatus.archived} size="small" />
              </Box>
            </Box>
          </FilterSection>
        </Accordion>
      </Box>

      {/* Actions */}
      <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ClearAllIcon />}
            onClick={handleClearFilters}
            fullWidth
          >
            Clear Filters
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={() => setExportDialog(true)}
            fullWidth
          >
            Export
          </Button>
        </Box>
        
        {selectedAnnotations.size > 0 && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={(e) => setBulkMenuAnchor(e.currentTarget)}
            >
              {selectedAnnotations.size} Selected
            </Button>
            <Button
              size="small"
              onClick={() => setSelectedAnnotations(new Set())}
            >
              Clear
            </Button>
          </Box>
        )}
      </Box>

      {/* Export Dialog */}
      <Dialog open={exportDialog} onClose={() => setExportDialog(false)}>
        <DialogTitle>Export Annotations</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose format and export {stats.filtered} filtered annotations
          </Typography>
          
          <List>
            {EXPORT_FORMATS.map(format => (
              <ListItemButton
                key={format.value}
                onClick={() => handleExport(format.value as any)}
              >
                <ListItemText
                  primary={format.label}
                  secondary={format.description}
                />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)}>
        <DialogTitle>Create New Category</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Category Name"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              fullWidth
            />
            
            <FormControl fullWidth>
              <InputLabel>Color</InputLabel>
              <Select
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                label="Color"
              >
                {['#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#00BCD4'].map(color => (
                  <MenuItem key={color} value={color}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box 
                        sx={{ 
                          width: 20, 
                          height: 20, 
                          borderRadius: '50%', 
                          backgroundColor: color 
                        }} 
                      />
                      {color}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              label="Description (optional)"
              value={newCategory.description}
              onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCategoryCreate}
            variant="contained"
            disabled={!newCategory.name.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Actions Menu */}
      <Menu
        anchorEl={bulkMenuAnchor}
        open={Boolean(bulkMenuAnchor)}
        onClose={() => setBulkMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleBulkAction('export')}>
          <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Export Selected</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleBulkAction('archive')}>
          <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Archive Selected</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => handleBulkAction('delete')}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Delete Selected</ListItemText>
        </MenuItem>
      </Menu>
    </Drawer>
  );
});

AnnotationSidebar.displayName = 'AnnotationSidebar';

export default AnnotationSidebar;
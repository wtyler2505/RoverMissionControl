/**
 * Template Gallery Component
 * Displays available command templates in a searchable, filterable gallery
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Alert,
  Pagination,
  Stack,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Paper
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  MoreVert as MoreIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingIcon
} from '@mui/icons-material';

import {
  CommandTemplate,
  TemplateFilters,
  TemplateSortOptions,
  templateService
} from '../../services/templateService';
import { CommandType } from '../../../../shared/types/command-queue.types';
import { TemplatePreview } from './TemplatePreview';
import { TemplateExecutor } from './TemplateExecutor';

interface TemplateGalleryProps {
  onCreateTemplate: () => void;
  onEditTemplate: (template: CommandTemplate) => void;
  onExecuteTemplate?: (template: CommandTemplate) => void;
  showCreateButton?: boolean;
  filterByCategory?: string;
  filterByCommandType?: CommandType;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  onCreateTemplate,
  onEditTemplate,
  onExecuteTemplate,
  showCreateButton = true,
  filterByCategory,
  filterByCommandType
}) => {
  // State
  const [templates, setTemplates] = useState<CommandTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(12);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(filterByCategory || '');
  const [selectedCommandType, setSelectedCommandType] = useState(filterByCommandType || '');
  const [includeShared, setIncludeShared] = useState(true);
  const [includeSystem, setIncludeSystem] = useState(true);
  const [sortBy, setSortBy] = useState<TemplateSortOptions>({
    sortBy: 'name',
    sortOrder: 'asc'
  });
  
  // UI State
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CommandTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showExecutor, setShowExecutor] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  
  // Load templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filters: TemplateFilters = {
        search: searchQuery,
        category: selectedCategory,
        commandType: selectedCommandType as CommandType,
        includeShared,
        includeSystem
      };
      
      const response = await templateService.listTemplates(
        filters,
        page,
        pageSize,
        sortBy
      );
      
      setTemplates(response.templates);
      setTotalPages(response.pages);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedCommandType, includeShared, includeSystem, page, pageSize, sortBy]);
  
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);
  
  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('templateFavorites');
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
  }, []);
  
  // Save favorites to localStorage
  const toggleFavorite = (templateId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(templateId)) {
      newFavorites.delete(templateId);
    } else {
      newFavorites.add(templateId);
    }
    setFavorites(newFavorites);
    localStorage.setItem('templateFavorites', JSON.stringify(Array.from(newFavorites)));
  };
  
  // Handle template actions
  const handleTemplateAction = async (action: string, template: CommandTemplate) => {
    setAnchorEl(null);
    setSelectedTemplate(template);
    
    switch (action) {
      case 'execute':
        if (onExecuteTemplate) {
          onExecuteTemplate(template);
        } else {
          setShowExecutor(true);
        }
        break;
        
      case 'preview':
        setShowPreview(true);
        break;
        
      case 'edit':
        onEditTemplate(template);
        break;
        
      case 'duplicate':
        try {
          const newName = `${template.name} (Copy)`;
          const duplicated = await templateService.duplicateTemplate(template.id, newName);
          await loadTemplates();
          onEditTemplate(duplicated);
        } catch (err) {
          console.error('Failed to duplicate template:', err);
        }
        break;
        
      case 'share':
        setShowShareDialog(true);
        break;
        
      case 'export':
        try {
          const exportData = await templateService.exportTemplate(template.id);
          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `template-${template.name.toLowerCase().replace(/\s+/g, '-')}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('Failed to export template:', err);
        }
        break;
        
      case 'delete':
        if (window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
          try {
            await templateService.deleteTemplate(template.id);
            await loadTemplates();
          } catch (err) {
            console.error('Failed to delete template:', err);
          }
        }
        break;
    }
  };
  
  // Render template card
  const renderTemplateCard = (template: CommandTemplate) => {
    const isFavorite = favorites.has(template.id);
    
    return (
      <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: 3
            }
          }}
        >
          <CardContent sx={{ flex: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="start">
              <Typography variant="h6" component="h3" gutterBottom>
                {template.name}
              </Typography>
              <IconButton
                size="small"
                onClick={() => toggleFavorite(template.id)}
              >
                {isFavorite ? (
                  <StarIcon color="primary" />
                ) : (
                  <StarBorderIcon />
                )}
              </IconButton>
            </Box>
            
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 2,
                height: '2.5em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {template.description || 'No description'}
            </Typography>
            
            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1 }}>
              <Chip
                label={template.commandType.replace(/_/g, ' ')}
                size="small"
                color="primary"
              />
              <Chip
                label={template.category}
                size="small"
                variant="outlined"
              />
              {template.isSystem && (
                <Tooltip title="System Template">
                  <Chip
                    icon={<LockIcon />}
                    label="System"
                    size="small"
                    color="secondary"
                  />
                </Tooltip>
              )}
              {template.isPublic && (
                <Tooltip title="Public Template">
                  <PublicIcon fontSize="small" color="action" />
                </Tooltip>
              )}
            </Stack>
            
            {template.usageCount > 0 && (
              <Box display="flex" alignItems="center" gap={1} mt={1}>
                <TrendingIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  Used {template.usageCount} times
                </Typography>
              </Box>
            )}
            
            {template.lastUsedAt && (
              <Box display="flex" alignItems="center" gap={1}>
                <ScheduleIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  Last used {new Date(template.lastUsedAt).toLocaleDateString()}
                </Typography>
              </Box>
            )}
          </CardContent>
          
          <CardActions>
            <Button
              size="small"
              startIcon={<PlayIcon />}
              onClick={() => handleTemplateAction('execute', template)}
            >
              Execute
            </Button>
            <Box flex={1} />
            <IconButton
              size="small"
              onClick={(e) => {
                setAnchorEl(e.currentTarget);
                setSelectedTemplate(template);
              }}
            >
              <MoreIcon />
            </IconButton>
          </CardActions>
        </Card>
      </Grid>
    );
  };
  
  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Command Templates</Typography>
        {showCreateButton && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreateTemplate}
          >
            Create Template
          </Button>
        )}
      </Box>
      
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Category"
              >
                <MenuItem value="">All Categories</MenuItem>
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="movement">Movement</MenuItem>
                <MenuItem value="sensor">Sensor</MenuItem>
                <MenuItem value="system">System</MenuItem>
                <MenuItem value="diagnostic">Diagnostic</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Command Type</InputLabel>
              <Select
                value={selectedCommandType}
                onChange={(e) => setSelectedCommandType(e.target.value)}
                label="Command Type"
              >
                <MenuItem value="">All Types</MenuItem>
                {Object.values(CommandType).map(type => (
                  <MenuItem key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort By</InputLabel>
              <Select
                value={`${sortBy.sortBy}-${sortBy.sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy({
                    sortBy: field as any,
                    sortOrder: order as any
                  });
                }}
                label="Sort By"
              >
                <MenuItem value="name-asc">Name (A-Z)</MenuItem>
                <MenuItem value="name-desc">Name (Z-A)</MenuItem>
                <MenuItem value="created_at-desc">Newest First</MenuItem>
                <MenuItem value="created_at-asc">Oldest First</MenuItem>
                <MenuItem value="usage_count-desc">Most Used</MenuItem>
                <MenuItem value="last_used_at-desc">Recently Used</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeShared}
                    onChange={(e) => setIncludeShared(e.target.checked)}
                    size="small"
                  />
                }
                label="Shared"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={includeSystem}
                    onChange={(e) => setIncludeSystem(e.target.checked)}
                    size="small"
                  />
                }
                label="System"
              />
            </Stack>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Template Grid */}
      {loading ? (
        <Grid container spacing={3}>
          {[...Array(8)].map((_, i) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="100%" height={60} />
                  <Stack direction="row" spacing={1}>
                    <Skeleton variant="rectangular" width={80} height={24} />
                    <Skeleton variant="rectangular" width={60} height={24} />
                  </Stack>
                </CardContent>
                <CardActions>
                  <Skeleton variant="rectangular" width={80} height={36} />
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : templates.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No templates found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Try adjusting your filters or create a new template
          </Typography>
          {showCreateButton && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreateTemplate}
            >
              Create First Template
            </Button>
          )}
        </Paper>
      ) : (
        <>
          <Grid container spacing={3}>
            {templates.map(renderTemplateCard)}
          </Grid>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
      
      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => handleTemplateAction('preview', selectedTemplate!)}>
          <ListItemIcon>
            <PlayIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Preview</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleTemplateAction('execute', selectedTemplate!)}>
          <ListItemIcon>
            <PlayIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Execute</ListItemText>
        </MenuItem>
        
        <Divider />
        
        {selectedTemplate?.canEdit && (
          <MenuItem onClick={() => handleTemplateAction('edit', selectedTemplate)}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}
        
        <MenuItem onClick={() => handleTemplateAction('duplicate', selectedTemplate!)}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        
        {selectedTemplate?.canShare && (
          <MenuItem onClick={() => handleTemplateAction('share', selectedTemplate)}>
            <ListItemIcon>
              <ShareIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Share</ListItemText>
          </MenuItem>
        )}
        
        <MenuItem onClick={() => handleTemplateAction('export', selectedTemplate!)}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>
        
        {selectedTemplate?.canDelete && (
          <>
            <Divider />
            <MenuItem
              onClick={() => handleTemplateAction('delete', selectedTemplate)}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
      
      {/* Preview Dialog */}
      {showPreview && selectedTemplate && (
        <TemplatePreview
          template={selectedTemplate}
          onClose={() => {
            setShowPreview(false);
            setSelectedTemplate(null);
          }}
          onExecute={onExecuteTemplate ? () => {
            setShowPreview(false);
            onExecuteTemplate(selectedTemplate);
          } : undefined}
        />
      )}
      
      {/* Executor Dialog */}
      {showExecutor && selectedTemplate && (
        <TemplateExecutor
          template={selectedTemplate}
          onClose={() => {
            setShowExecutor(false);
            setSelectedTemplate(null);
          }}
          onSuccess={() => {
            setShowExecutor(false);
            setSelectedTemplate(null);
            loadTemplates(); // Refresh usage count
          }}
        />
      )}
      
      {/* Import Dialog */}
      <Dialog open={showImportDialog} onClose={() => setShowImportDialog(false)}>
        <DialogTitle>Import Template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Select a template JSON file to import
          </Typography>
          <input
            type="file"
            accept=".json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  const text = await file.text();
                  const data = JSON.parse(text);
                  await templateService.importTemplate(data);
                  setShowImportDialog(false);
                  await loadTemplates();
                } catch (err) {
                  console.error('Failed to import template:', err);
                  alert('Failed to import template. Please check the file format.');
                }
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
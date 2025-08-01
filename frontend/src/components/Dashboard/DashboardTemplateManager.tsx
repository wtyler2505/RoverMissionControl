/**
 * DashboardTemplateManager - UI for selecting and managing dashboard templates
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Typography,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Tabs,
  Tab,
  alpha
} from '@mui/material';
import {
  Search,
  Close,
  GridView,
  ViewList,
  Favorite,
  FavoriteBorder,
  Download,
  Upload,
  Share,
  ContentCopy,
  Edit,
  Delete,
  Check,
  Warning,
  Info,
  Star,
  Schedule,
  Dashboard,
  Analytics,
  Engineering,
  Speed,
  BugReport,
  Science,
  Emergency
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  DashboardTemplate,
  DashboardCategory,
  DashboardContext,
  TemplateValidationResult,
  TemplateRecommendation,
  MissionPhase
} from '../../types/dashboardTemplates';
import { DASHBOARD_TEMPLATES, getTemplatesByCategory } from './templates/MissionTemplates';
import { DashboardTemplatePreview } from './DashboardTemplatePreview';
import { DashboardTemplateValidator } from '../../services/DashboardTemplateValidator';
import { DashboardTemplateEngine } from '../../services/DashboardTemplateEngine';

/**
 * Props for DashboardTemplateManager
 */
export interface DashboardTemplateManagerProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: DashboardTemplate) => void;
  context: DashboardContext;
  currentDashboardId?: string;
  favorites?: string[];
  onToggleFavorite?: (templateId: string) => void;
  onImportTemplate?: (template: DashboardTemplate) => void;
  onExportTemplate?: (templateId: string) => void;
}

/**
 * Styled components
 */
const TemplateCard = styled(Card)<{ $selected?: boolean }>(({ theme, $selected }) => ({
  height: '100%',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  border: `2px solid ${$selected ? theme.palette.primary.main : 'transparent'}`,
  position: 'relative',
  
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    borderColor: alpha(theme.palette.primary.main, 0.3)
  }
}));

const TemplateThumbnail = styled(CardMedia)(({ theme }) => ({
  height: 160,
  backgroundColor: theme.palette.action.hover,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden'
}));

const CategoryIcon = styled(Box)(({ theme }) => ({
  fontSize: 64,
  opacity: 0.3,
  color: theme.palette.text.secondary
}));

const FavoriteButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  backgroundColor: alpha(theme.palette.background.paper, 0.8),
  
  '&:hover': {
    backgroundColor: theme.palette.background.paper
  }
}));

const ValidationChip = styled(Chip)<{ $status: 'valid' | 'warning' | 'error' }>(({ theme, $status }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  left: theme.spacing(1),
  backgroundColor: $status === 'valid' 
    ? alpha(theme.palette.success.main, 0.9)
    : $status === 'warning'
    ? alpha(theme.palette.warning.main, 0.9)
    : alpha(theme.palette.error.main, 0.9),
  color: theme.palette.common.white
}));

const TabPanel = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(3)
}));

/**
 * Get category icon
 */
const getCategoryIcon = (category: DashboardCategory) => {
  switch (category) {
    case DashboardCategory.MONITORING:
      return <Dashboard sx={{ fontSize: 'inherit' }} />;
    case DashboardCategory.ANALYSIS:
      return <Analytics sx={{ fontSize: 'inherit' }} />;
    case DashboardCategory.DIAGNOSTICS:
      return <Engineering sx={{ fontSize: 'inherit' }} />;
    case DashboardCategory.OPTIMIZATION:
      return <Speed sx={{ fontSize: 'inherit' }} />;
    case DashboardCategory.SCIENCE:
      return <Science sx={{ fontSize: 'inherit' }} />;
    case DashboardCategory.EMERGENCY:
      return <Emergency sx={{ fontSize: 'inherit' }} />;
    default:
      return <Dashboard sx={{ fontSize: 'inherit' }} />;
  }
};

/**
 * DashboardTemplateManager component
 */
export const DashboardTemplateManager: React.FC<DashboardTemplateManagerProps> = ({
  open,
  onClose,
  onSelectTemplate,
  context,
  currentDashboardId,
  favorites = [],
  onToggleFavorite,
  onImportTemplate,
  onExportTemplate
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<DashboardTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<DashboardCategory | 'all' | 'recommended'>('recommended');
  const [showPreview, setShowPreview] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [validationResults, setValidationResults] = useState<Map<string, TemplateValidationResult>>(new Map());
  const [isValidating, setIsValidating] = useState(false);

  // Initialize services
  const validator = useMemo(() => new DashboardTemplateValidator(), []);
  const engine = useMemo(() => new DashboardTemplateEngine(), []);

  // Get recommended templates
  const recommendations = useMemo(() => {
    return engine.recommendTemplates(context);
  }, [context, engine]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let templates = DASHBOARD_TEMPLATES;

    // Filter by category
    if (selectedCategory !== 'all' && selectedCategory !== 'recommended') {
      templates = getTemplatesByCategory(selectedCategory);
    } else if (selectedCategory === 'recommended') {
      templates = recommendations.map(r => r.template);
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      templates = templates.filter(template =>
        template.name.toLowerCase().includes(search) ||
        template.description.toLowerCase().includes(search) ||
        template.tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }

    return templates;
  }, [selectedCategory, searchTerm, recommendations]);

  // Validate templates
  useEffect(() => {
    const validateTemplates = async () => {
      setIsValidating(true);
      const results = new Map<string, TemplateValidationResult>();

      for (const template of filteredTemplates) {
        const result = await validator.validateTemplate(template, context);
        results.set(template.id, result);
      }

      setValidationResults(results);
      setIsValidating(false);
    };

    validateTemplates();
  }, [filteredTemplates, context, validator]);

  // Handle template selection
  const handleSelectTemplate = useCallback((template: DashboardTemplate) => {
    setSelectedTemplate(template);
  }, []);

  // Handle template application
  const handleApplyTemplate = useCallback(() => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      onClose();
    }
  }, [selectedTemplate, onSelectTemplate, onClose]);

  // Handle preview
  const handlePreview = useCallback((template: DashboardTemplate) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  }, []);

  // Handle menu actions
  const handleMenuAction = useCallback((action: string) => {
    if (!selectedTemplate) return;

    switch (action) {
      case 'copy':
        // Copy template to clipboard
        navigator.clipboard.writeText(JSON.stringify(selectedTemplate, null, 2));
        break;
      case 'export':
        onExportTemplate?.(selectedTemplate.id);
        break;
      case 'share':
        // Share functionality would go here
        break;
    }

    setMenuAnchor(null);
  }, [selectedTemplate, onExportTemplate]);

  // Handle import
  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const template = JSON.parse(text) as DashboardTemplate;
      
      // Validate imported template
      const validation = await validator.validateTemplate(template, context);
      if (validation.valid) {
        onImportTemplate?.(template);
      } else {
        console.error('Invalid template:', validation.errors);
      }
    } catch (error) {
      console.error('Failed to import template:', error);
    }
  }, [context, validator, onImportTemplate]);

  // Get validation status
  const getValidationStatus = (templateId: string): 'valid' | 'warning' | 'error' | undefined => {
    const result = validationResults.get(templateId);
    if (!result) return undefined;
    
    if (!result.valid) return 'error';
    if (result.warnings.length > 0) return 'warning';
    return 'valid';
  };

  // Get recommendation score
  const getRecommendationScore = (templateId: string): number | undefined => {
    const recommendation = recommendations.find(r => r.template.id === templateId);
    return recommendation?.score;
  };

  // Render template card
  const renderTemplateCard = (template: DashboardTemplate) => {
    const isFavorite = favorites.includes(template.id);
    const isSelected = selectedTemplate?.id === template.id;
    const validationStatus = getValidationStatus(template.id);
    const recommendationScore = getRecommendationScore(template.id);

    return (
      <Grid item xs={12} sm={6} md={4} key={template.id}>
        <TemplateCard
          $selected={isSelected}
          onClick={() => handleSelectTemplate(template)}
          onDoubleClick={() => handleApplyTemplate()}
        >
          <TemplateThumbnail>
            {template.thumbnail ? (
              <img src={template.thumbnail} alt={template.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <CategoryIcon>{getCategoryIcon(template.category)}</CategoryIcon>
            )}
            
            {validationStatus && (
              <ValidationChip
                $status={validationStatus}
                size="small"
                icon={validationStatus === 'valid' ? <Check /> : <Warning />}
                label={validationStatus}
              />
            )}
            
            <FavoriteButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite?.(template.id);
              }}
            >
              {isFavorite ? <Favorite color="error" /> : <FavoriteBorder />}
            </FavoriteButton>
            
            {recommendationScore !== undefined && (
              <Tooltip title={`Recommendation score: ${recommendationScore}%`}>
                <Badge
                  badgeContent={`${recommendationScore}%`}
                  color="primary"
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    '& .MuiBadge-badge': {
                      fontSize: '0.7rem'
                    }
                  }}
                >
                  <Star color="primary" />
                </Badge>
              </Tooltip>
            )}
          </TemplateThumbnail>
          
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {template.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {template.description}
            </Typography>
            
            <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={template.category}
                color="primary"
                variant="outlined"
              />
              <Chip
                size="small"
                icon={<Dashboard />}
                label={`${template.panels.length} panels`}
              />
            </Stack>
            
            {template.tags && template.tags.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
                {template.tags.slice(0, 3).map(tag => (
                  <Chip key={tag} size="small" label={tag} variant="outlined" />
                ))}
                {template.tags.length > 3 && (
                  <Chip size="small" label={`+${template.tags.length - 3}`} variant="outlined" />
                )}
              </Stack>
            )}
          </CardContent>
          
          <CardActions>
            <Button size="small" onClick={() => handlePreview(template)}>
              Preview
            </Button>
            <Button
              size="small"
              color="primary"
              disabled={validationStatus === 'error'}
              onClick={(e) => {
                e.stopPropagation();
                handleApplyTemplate();
              }}
            >
              Apply
            </Button>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTemplate(template);
                setMenuAnchor(e.currentTarget);
              }}
            >
              <Info />
            </IconButton>
          </CardActions>
        </TemplateCard>
      </Grid>
    );
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h5">Dashboard Templates</Typography>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Import template">
                <IconButton component="label">
                  <Upload />
                  <input
                    type="file"
                    accept=".json"
                    hidden
                    onChange={handleImport}
                  />
                </IconButton>
              </Tooltip>
              
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, value) => value && setViewMode(value)}
                size="small"
              >
                <ToggleButton value="grid">
                  <GridView />
                </ToggleButton>
                <ToggleButton value="list">
                  <ViewList />
                </ToggleButton>
              </ToggleButtonGroup>
              
              <IconButton onClick={onClose}>
                <Close />
              </IconButton>
            </Stack>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              fullWidth
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />
            
            <Tabs
              value={selectedCategory}
              onChange={(_, value) => setSelectedCategory(value)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab 
                label="Recommended" 
                value="recommended"
                icon={<Star />}
                iconPosition="start"
              />
              <Tab label="All" value="all" />
              <Tab label="Monitoring" value={DashboardCategory.MONITORING} />
              <Tab label="Analysis" value={DashboardCategory.ANALYSIS} />
              <Tab label="Diagnostics" value={DashboardCategory.DIAGNOSTICS} />
              <Tab label="Optimization" value={DashboardCategory.OPTIMIZATION} />
              <Tab label="Science" value={DashboardCategory.SCIENCE} />
              <Tab label="Emergency" value={DashboardCategory.EMERGENCY} />
            </Tabs>
            
            {selectedCategory === 'recommended' && recommendations.length > 0 && (
              <Alert severity="info" icon={<Info />}>
                Templates recommended based on current mission phase ({context.missionPhase}) 
                and active systems.
              </Alert>
            )}
            
            {isValidating && (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            )}
            
            {!isValidating && (
              <Grid container spacing={2}>
                {filteredTemplates.map(renderTemplateCard)}
              </Grid>
            )}
            
            {!isValidating && filteredTemplates.length === 0 && (
              <Box textAlign="center" py={4}>
                <Typography variant="h6" color="text.secondary">
                  No templates found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your search or filters
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleApplyTemplate}
            disabled={!selectedTemplate || getValidationStatus(selectedTemplate.id) === 'error'}
          >
            Apply Template
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Template preview dialog */}
      {selectedTemplate && (
        <DashboardTemplatePreview
          open={showPreview}
          template={selectedTemplate}
          context={context}
          validationResult={validationResults.get(selectedTemplate.id)}
          onClose={() => setShowPreview(false)}
          onApply={handleApplyTemplate}
        />
      )}
      
      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleMenuAction('copy')}>
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy Template</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('export')}>
          <ListItemIcon>
            <Download fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export Template</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('share')}>
          <ListItemIcon>
            <Share fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share Template</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default DashboardTemplateManager;
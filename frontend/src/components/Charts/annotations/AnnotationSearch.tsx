/**
 * Annotation Search Component
 * Advanced search interface for finding and filtering annotations
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Paper,
  Chip,
  Typography,
  Button,
  Collapse,
  Grid,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  DatePicker,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ArrowForward as ArrowIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Label as TagIcon,
  CalendarToday as DateIcon,
  Warning as SeverityIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';
import {
  EnhancedAnnotation,
  EnhancedAnnotationSearchParams
} from '../../../types/enterprise-annotations';
import useAnnotationStore from '../../../stores/annotationStore';
import { format } from 'date-fns';

interface AnnotationSearchProps {
  chartId?: string;
  onSelectAnnotation: (annotation: EnhancedAnnotation) => void;
  onClose?: () => void;
}

export const AnnotationSearch: React.FC<AnnotationSearchProps> = ({
  chartId,
  onSelectAnnotation,
  onClose
}) => {
  const { 
    annotations, 
    searchResults, 
    setSearchResults, 
    clearSearchResults,
    isLoading
  } = useAnnotationStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<EnhancedAnnotationSearchParams>({
    chartId,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    limit: 50
  });
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Debounced search function
  const performSearch = useCallback(
    debounce(async (params: EnhancedAnnotationSearchParams) => {
      // Simulate API search - replace with actual API call
      const allAnnotations = Array.from(annotations.values());
      
      let filtered = allAnnotations;

      // Apply filters
      if (params.query) {
        const query = params.query.toLowerCase();
        filtered = filtered.filter(a => 
          a.title?.toLowerCase().includes(query) ||
          a.text?.toLowerCase().includes(query) ||
          a.tags?.some(tag => tag.toLowerCase().includes(query)) ||
          a.createdBy.toLowerCase().includes(query)
        );
      }

      if (params.chartId) {
        filtered = filtered.filter(a => a.chartId === params.chartId);
      }

      if (params.userId) {
        filtered = filtered.filter(a => a.createdBy === params.userId);
      }

      if (params.tags && params.tags.length > 0) {
        filtered = filtered.filter(a => 
          a.tags?.some(tag => params.tags?.includes(tag))
        );
      }

      if (params.severity && params.severity.length > 0) {
        filtered = filtered.filter(a => 
          params.severity?.includes(a.severity || '')
        );
      }

      if (params.dateRange) {
        const { start, end } = params.dateRange;
        filtered = filtered.filter(a => 
          a.createdAt >= start && a.createdAt <= end
        );
      }

      // Sort results
      filtered.sort((a, b) => {
        const field = params.sortBy || 'createdAt';
        const aValue = (a as any)[field];
        const bValue = (b as any)[field];
        
        if (params.sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      // Apply limit
      if (params.limit) {
        filtered = filtered.slice(0, params.limit);
      }

      setSearchResults(filtered.map(a => a.id));
    }, 300),
    [annotations, setSearchResults]
  );

  useEffect(() => {
    performSearch(filters);
  }, [filters, performSearch]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setFilters({ ...filters, query: value });
    
    // Add to recent searches
    if (value.trim() && !recentSearches.includes(value)) {
      setRecentSearches([value, ...recentSearches.slice(0, 4)]);
    }
  };

  const handleFilterChange = (field: keyof EnhancedAnnotationSearchParams, value: any) => {
    setFilters({ ...filters, [field]: value });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      chartId,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 50
    });
    clearSearchResults();
  };

  const getSearchResultAnnotations = (): EnhancedAnnotation[] => {
    return searchResults
      .map(id => annotations.get(id))
      .filter((a): a is EnhancedAnnotation => a !== undefined);
  };

  const renderAnnotationItem = (annotation: EnhancedAnnotation) => {
    const severityColors = {
      info: '#2196f3',
      warning: '#ff9800',
      critical: '#f44336',
      success: '#4caf50'
    };

    return (
      <ListItem
        button
        onClick={() => onSelectAnnotation(annotation)}
        key={annotation.id}
      >
        <ListItemAvatar>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              annotation.version > 1 ? (
                <Avatar sx={{ width: 20, height: 20, bgcolor: 'primary.main', fontSize: 10 }}>
                  {annotation.version}
                </Avatar>
              ) : null
            }
          >
            <Avatar sx={{ bgcolor: severityColors[annotation.severity || 'info'] }}>
              {annotation.type.charAt(0).toUpperCase()}
            </Avatar>
          </Badge>
        </ListItemAvatar>
        
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">
                {annotation.title || annotation.text || `${annotation.type} annotation`}
              </Typography>
              {annotation.locked && (
                <Chip label="Locked" size="small" color="warning" />
              )}
            </Box>
          }
          secondary={
            <Box>
              <Typography variant="caption" color="text.secondary">
                By {annotation.createdBy} • {format(annotation.createdAt, 'MMM d, yyyy HH:mm')}
              </Typography>
              {annotation.tags && annotation.tags.length > 0 && (
                <Box sx={{ mt: 0.5 }}>
                  {annotation.tags.map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      size="small"
                      sx={{ mr: 0.5, height: 20 }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          }
        />
        
        <ListItemSecondaryAction>
          <IconButton edge="end" onClick={() => onSelectAnnotation(annotation)}>
            <ArrowIcon />
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Search Header */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search annotations..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => handleSearchChange('')}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            )
          }}
        />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Button
            size="small"
            startIcon={<FilterIcon />}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            Advanced Filters
          </Button>
          
          {Object.keys(filters).length > 3 && (
            <Button size="small" onClick={clearFilters}>
              Clear All
            </Button>
          )}
        </Box>
      </Box>

      {/* Recent Searches */}
      {!searchQuery && recentSearches.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Recent searches
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            {recentSearches.map((search, index) => (
              <Chip
                key={index}
                label={search}
                size="small"
                icon={<HistoryIcon />}
                onClick={() => handleSearchChange(search)}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Advanced Filters */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Autocomplete
                    size="small"
                    options={['user1', 'user2', 'user3']} // Replace with actual users
                    value={filters.userId || null}
                    onChange={(_, value) => handleFilterChange('userId', value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Created by"
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <InputAdornment position="start">
                                <PersonIcon />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </>
                          )
                        }}
                      />
                    )}
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <Autocomplete
                    size="small"
                    multiple
                    options={['tag1', 'tag2', 'tag3']} // Replace with actual tags
                    value={filters.tags || []}
                    onChange={(_, value) => handleFilterChange('tags', value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Tags"
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <InputAdornment position="start">
                                <TagIcon />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </>
                          )
                        }}
                      />
                    )}
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Severity</InputLabel>
                    <Select
                      multiple
                      value={filters.severity || []}
                      onChange={(e) => handleFilterChange('severity', e.target.value)}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      <MenuItem value="info">Info</MenuItem>
                      <MenuItem value="warning">Warning</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                      <MenuItem value="success">Success</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={6}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Sort by</InputLabel>
                    <Select
                      value={filters.sortBy}
                      onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                    >
                      <MenuItem value="createdAt">Date Created</MenuItem>
                      <MenuItem value="updatedAt">Date Updated</MenuItem>
                      <MenuItem value="severity">Severity</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      <Divider sx={{ mb: 2 }} />

      {/* Search Results */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : searchResults.length === 0 ? (
          <Alert severity="info">
            {searchQuery || Object.keys(filters).length > 3
              ? 'No annotations found matching your criteria'
              : 'Start typing to search annotations'}
          </Alert>
        ) : (
          <List>
            {getSearchResultAnnotations().map((annotation, index) => (
              <React.Fragment key={annotation.id}>
                {renderAnnotationItem(annotation)}
                {index < searchResults.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* Results Summary */}
      {searchResults.length > 0 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Found {searchResults.length} annotation{searchResults.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default AnnotationSearch;
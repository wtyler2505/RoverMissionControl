import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  InputBase,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Chip,
  Box,
  Popper,
  Fade,
  ClickAwayListener,
  CircularProgress,
  Alert,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search,
  Clear,
  DeviceHub,
  History,
  TrendingUp,
  Close,
  FilterList,
  Cable,
  Memory,
  Router,
  Wifi,
  Bluetooth,
  CheckCircle,
  PowerOff,
  Error as ErrorIcon,
  Warning,
  Info,
} from '@mui/icons-material';
import { useHALContext } from './HALContext';
import { HALDevice, HALActivity } from './types';

interface SearchResult {
  type: 'device' | 'activity' | 'command';
  item: HALDevice | HALActivity | any;
  relevance: number;
}

interface SearchSuggestion {
  text: string;
  category: string;
  icon: React.ReactElement;
}

export const HALSearchBar: React.FC = () => {
  const theme = useTheme();
  const { devices, activities, selectDevice } = useHALContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('hal-recent-searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Perform search
  useEffect(() => {
    const searchTimer = setTimeout(() => {
      if (searchTerm.trim()) {
        performSearch(searchTerm);
      } else {
        setResults([]);
        setSuggestions(generateSuggestions());
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [searchTerm, devices, activities]);

  const performSearch = (term: string) => {
    setIsSearching(true);
    const searchResults: SearchResult[] = [];
    const lowerTerm = term.toLowerCase();

    // Search devices
    devices.forEach(device => {
      let relevance = 0;
      
      if (device.name.toLowerCase().includes(lowerTerm)) relevance += 10;
      if (device.id.toLowerCase().includes(lowerTerm)) relevance += 8;
      if (device.type.toLowerCase().includes(lowerTerm)) relevance += 6;
      if (device.protocol.toLowerCase().includes(lowerTerm)) relevance += 5;
      if (device.address?.toLowerCase().includes(lowerTerm)) relevance += 4;
      if (device.firmwareVersion?.toLowerCase().includes(lowerTerm)) relevance += 3;
      
      // Check capabilities
      device.capabilities.forEach(cap => {
        if (cap.name.toLowerCase().includes(lowerTerm)) relevance += 2;
        if (cap.description?.toLowerCase().includes(lowerTerm)) relevance += 1;
      });

      if (relevance > 0) {
        searchResults.push({ type: 'device', item: device, relevance });
      }
    });

    // Search activities
    activities.slice(0, 50).forEach(activity => {
      let relevance = 0;
      
      if (activity.message.toLowerCase().includes(lowerTerm)) relevance += 8;
      if (activity.type.toLowerCase().includes(lowerTerm)) relevance += 6;
      if (activity.deviceName?.toLowerCase().includes(lowerTerm)) relevance += 5;
      
      if (relevance > 0) {
        searchResults.push({ type: 'activity', item: activity, relevance });
      }
    });

    // Sort by relevance
    searchResults.sort((a, b) => b.relevance - a.relevance);
    
    setResults(searchResults.slice(0, 10)); // Limit to top 10 results
    setIsSearching(false);
  };

  const generateSuggestions = (): SearchSuggestion[] => {
    const suggestions: SearchSuggestion[] = [];

    // Protocol suggestions
    const protocols = [...new Set(devices.map(d => d.protocol))];
    protocols.forEach(protocol => {
      suggestions.push({
        text: `protocol:${protocol}`,
        category: 'Filter',
        icon: getProtocolIcon(protocol),
      });
    });

    // Type suggestions
    const types = [...new Set(devices.map(d => d.type))];
    types.forEach(type => {
      suggestions.push({
        text: `type:${type}`,
        category: 'Filter',
        icon: <DeviceHub />,
      });
    });

    // Status suggestions
    suggestions.push(
      { text: 'status:connected', category: 'Filter', icon: <CheckCircle /> },
      { text: 'status:disconnected', category: 'Filter', icon: <PowerOff /> },
      { text: 'status:error', category: 'Filter', icon: <ErrorIcon /> }
    );

    // Common searches
    suggestions.push(
      { text: 'firmware updates', category: 'Common', icon: <TrendingUp /> },
      { text: 'recent errors', category: 'Common', icon: <ErrorIcon /> },
      { text: 'diagnostic results', category: 'Common', icon: <Info /> }
    );

    return suggestions.slice(0, 6);
  };

  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case 'wifi':
        return <Wifi />;
      case 'bluetooth':
        return <Bluetooth />;
      case 'ethernet':
      case 'serial':
      case 'usb':
        return <Cable />;
      case 'i2c':
      case 'spi':
        return <Memory />;
      case 'can':
        return <Router />;
      default:
        return <DeviceHub />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle sx={{ color: theme.palette.success.main }} />;
      case 'disconnected':
        return <PowerOff sx={{ color: theme.palette.text.disabled }} />;
      case 'error':
        return <ErrorIcon sx={{ color: theme.palette.error.main }} />;
      case 'updating':
        return <Info sx={{ color: theme.palette.info.main }} />;
      case 'simulated':
        return <Warning sx={{ color: theme.palette.warning.main }} />;
      default:
        return <DeviceHub />;
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setShowResults(true);
    
    // Add to recent searches
    if (term.trim() && !recentSearches.includes(term)) {
      const updated = [term, ...recentSearches].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('hal-recent-searches', JSON.stringify(updated));
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    if (result.type === 'device') {
      selectDevice(result.item as HALDevice);
    }
    setShowResults(false);
    setSearchTerm('');
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setResults([]);
    inputRef.current?.focus();
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('hal-recent-searches');
  };

  const renderResultItem = (result: SearchResult) => {
    if (result.type === 'device') {
      const device = result.item as HALDevice;
      return (
        <ListItem
          button
          onClick={() => handleSelectResult(result)}
          sx={{
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          <ListItemIcon>{getStatusIcon(device.status)}</ListItemIcon>
          <ListItemText
            primary={device.name}
            secondary={
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                  label={device.type}
                  size="small"
                  sx={{ height: 20 }}
                />
                <Chip
                  label={device.protocol.toUpperCase()}
                  size="small"
                  sx={{ height: 20 }}
                  icon={getProtocolIcon(device.protocol)}
                />
                {device.address && (
                  <Typography variant="caption" color="text.secondary">
                    {device.address}
                  </Typography>
                )}
              </Box>
            }
          />
          <ListItemSecondaryAction>
            <Chip
              label={device.status}
              size="small"
              color={
                device.status === 'connected' ? 'success' :
                device.status === 'error' ? 'error' :
                'default'
              }
            />
          </ListItemSecondaryAction>
        </ListItem>
      );
    } else if (result.type === 'activity') {
      const activity = result.item as HALActivity;
      return (
        <ListItem
          sx={{
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          <ListItemIcon>
            <Info color={activity.severity as any} />
          </ListItemIcon>
          <ListItemText
            primary={activity.message}
            secondary={new Date(activity.timestamp).toLocaleString()}
          />
        </ListItem>
      );
    }
    return null;
  };

  return (
    <ClickAwayListener onClickAway={() => setShowResults(false)}>
      <Box sx={{ position: 'relative', width: '100%', maxWidth: 600 }}>
        <Paper
          ref={searchRef}
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            performSearch(searchTerm);
          }}
          sx={{
            p: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: showResults ? theme.shadows[4] : theme.shadows[1],
            transition: 'box-shadow 0.3s',
          }}
        >
          <IconButton sx={{ p: '10px' }} aria-label="search">
            <Search />
          </IconButton>
          <InputBase
            ref={inputRef}
            sx={{ ml: 1, flex: 1 }}
            placeholder="Search devices, activities, commands..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setShowResults(true)}
          />
          {isSearching && (
            <CircularProgress size={20} sx={{ mr: 1 }} />
          )}
          {searchTerm && (
            <IconButton
              sx={{ p: '10px' }}
              aria-label="clear"
              onClick={handleClearSearch}
            >
              <Clear />
            </IconButton>
          )}
          <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
          <IconButton
            color="primary"
            sx={{ p: '10px' }}
            aria-label="filters"
          >
            <FilterList />
          </IconButton>
        </Paper>

        <Popper
          open={showResults}
          anchorEl={searchRef.current}
          placement="bottom-start"
          transition
          style={{ width: searchRef.current?.offsetWidth, zIndex: 1300 }}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={350}>
              <Paper
                sx={{
                  mt: 1,
                  maxHeight: 400,
                  overflow: 'auto',
                  boxShadow: theme.shadows[8],
                }}
              >
                {/* Search Results */}
                {results.length > 0 && (
                  <>
                    <Box sx={{ p: 2, pb: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Search Results ({results.length})
                      </Typography>
                    </Box>
                    <List dense>
                      {results.map((result, index) => (
                        <React.Fragment key={index}>
                          {renderResultItem(result)}
                        </React.Fragment>
                      ))}
                    </List>
                  </>
                )}

                {/* No Results */}
                {searchTerm && results.length === 0 && !isSearching && (
                  <Alert severity="info" sx={{ m: 2 }}>
                    No results found for "{searchTerm}"
                  </Alert>
                )}

                {/* Suggestions */}
                {!searchTerm && suggestions.length > 0 && (
                  <>
                    <Box sx={{ p: 2, pb: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Suggestions
                      </Typography>
                    </Box>
                    <List dense>
                      {suggestions.map((suggestion, index) => (
                        <ListItem
                          key={index}
                          button
                          onClick={() => handleSearch(suggestion.text)}
                        >
                          <ListItemIcon>{suggestion.icon}</ListItemIcon>
                          <ListItemText
                            primary={suggestion.text}
                            secondary={suggestion.category}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}

                {/* Recent Searches */}
                {!searchTerm && recentSearches.length > 0 && (
                  <>
                    <Divider />
                    <Box sx={{ p: 2, pb: 1, display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Recent Searches
                      </Typography>
                      <IconButton size="small" onClick={handleClearRecent}>
                        <Clear fontSize="small" />
                      </IconButton>
                    </Box>
                    <List dense>
                      {recentSearches.map((search, index) => (
                        <ListItem
                          key={index}
                          button
                          onClick={() => handleSearch(search)}
                        >
                          <ListItemIcon>
                            <History />
                          </ListItemIcon>
                          <ListItemText primary={search} />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </Paper>
            </Fade>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default HALSearchBar;
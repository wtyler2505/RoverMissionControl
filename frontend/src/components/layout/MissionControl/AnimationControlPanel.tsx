/**
 * AnimationControlPanel Component
 * 
 * Control UI for animation playback, library management, and blending.
 * Integrates with AnimationSystem and TimelineEditor.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Slider,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Collapse,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Alert,
  LinearProgress,
  Tooltip,
  Menu,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  FastRewind,
  FastForward,
  Loop,
  Layers,
  Add,
  Delete,
  Edit,
  Save,
  FolderOpen,
  Upload,
  Download,
  FilterList,
  Sort,
  Search,
  ExpandLess,
  ExpandMore,
  Visibility,
  VisibilityOff,
  Lock,
  LockOpen,
  VolumeUp,
  VolumeMute,
  Blend,
  Animation,
  Timeline,
  MovieFilter,
  Speed,
  ContentCopy,
  ContentPaste,
  Settings,
  PlayCircle,
  StopCircle
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import {
  AnimationClip,
  AnimationLayer,
  AnimationSystemRef,
  BlendMode,
  ProceduralAnimation,
  PhysicsAnimation,
  ROVER_PRESET_ANIMATIONS,
  PROCEDURAL_PRESETS
} from './AnimationSystem';
import TimelineEditor from './TimelineEditor';

// ========== Types ==========

interface AnimationLibraryItem {
  clip: AnimationClip;
  category: string;
  tags: string[];
  favorite: boolean;
  lastUsed?: Date;
  useCount: number;
}

interface LayerControl {
  layer: AnimationLayer;
  expanded: boolean;
  solo: boolean;
}

interface AnimationControlPanelProps {
  animationSystemRef: React.RefObject<AnimationSystemRef>;
  onAnimationSelect?: (clip: AnimationClip) => void;
  height?: number;
  'data-testid'?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// ========== Constants ==========

const ANIMATION_CATEGORIES = [
  'Movement',
  'Camera',
  'Tools',
  'Calibration',
  'Emergency',
  'Custom'
];

const BLEND_MODE_ICONS: Record<BlendMode, React.ReactElement> = {
  override: <Layers />,
  additive: <Add />,
  multiply: <FilterList />,
  screen: <MovieFilter />
};

// ========== Tab Panel Component ==========

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`animation-tabpanel-${index}`}
      aria-labelledby={`animation-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// ========== Animation Control Panel Component ==========

export const AnimationControlPanel: React.FC<AnimationControlPanelProps> = ({
  animationSystemRef,
  onAnimationSelect,
  height = 600,
  'data-testid': testId = 'animation-control-panel'
}) => {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [tabValue, setTabValue] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [masterVolume, setMasterVolume] = useState(1);
  const [selectedClip, setSelectedClip] = useState<AnimationClip | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Library state
  const [library, setLibrary] = useState<AnimationLibraryItem[]>(() => {
    // Initialize with preset animations
    return ROVER_PRESET_ANIMATIONS.map(clip => ({
      clip,
      category: clip.metadata?.tags?.includes('emergency') ? 'Emergency' :
                clip.metadata?.tags?.includes('camera') ? 'Camera' :
                clip.metadata?.tags?.includes('arm') ? 'Movement' :
                clip.metadata?.tags?.includes('calibration') ? 'Calibration' :
                clip.metadata?.tags?.includes('tool') ? 'Tools' : 'Custom',
      tags: clip.metadata?.tags || [],
      favorite: false,
      useCount: 0
    }));
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'usage'>('name');

  // Layer state
  const [layers, setLayers] = useState<LayerControl[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<string>('base');

  // Procedural state
  const [proceduralAnims, setProceduralAnims] = useState<ProceduralAnimation[]>([]);
  const [physicsAnims, setPhysicsAnims] = useState<PhysicsAnimation[]>([]);

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClip, setEditingClip] = useState<AnimationClip | null>(null);
  const [importExportDialog, setImportExportDialog] = useState<'import' | 'export' | null>(null);

  // Playback control
  const play = useCallback(() => {
    if (!animationSystemRef.current || !selectedClip) return;
    
    animationSystemRef.current.play(selectedClip.id, selectedLayer);
    setIsPlaying(true);
  }, [animationSystemRef, selectedClip, selectedLayer]);

  const pause = useCallback(() => {
    if (!animationSystemRef.current || !selectedClip) return;
    
    animationSystemRef.current.pause(selectedClip.id, selectedLayer);
    setIsPlaying(false);
  }, [animationSystemRef, selectedClip, selectedLayer]);

  const stop = useCallback(() => {
    if (!animationSystemRef.current || !selectedClip) return;
    
    animationSystemRef.current.stop(selectedClip.id, selectedLayer);
    setIsPlaying(false);
    setCurrentTime(0);
  }, [animationSystemRef, selectedClip, selectedLayer]);

  // Library management
  const addToLibrary = useCallback((clip: AnimationClip) => {
    const newItem: AnimationLibraryItem = {
      clip,
      category: 'Custom',
      tags: clip.metadata?.tags || [],
      favorite: false,
      useCount: 0
    };
    
    setLibrary(prev => [...prev, newItem]);
    
    // Add to animation system
    if (animationSystemRef.current) {
      animationSystemRef.current.addClip(clip);
    }
  }, [animationSystemRef]);

  const updateLibraryItem = useCallback((clipId: string, updates: Partial<AnimationLibraryItem>) => {
    setLibrary(prev => prev.map(item => 
      item.clip.id === clipId ? { ...item, ...updates } : item
    ));
  }, []);

  const deleteFromLibrary = useCallback((clipId: string) => {
    setLibrary(prev => prev.filter(item => item.clip.id !== clipId));
  }, []);

  // Layer management
  const createLayer = useCallback((name: string, blendMode: BlendMode = 'override') => {
    if (!animationSystemRef.current) return;
    
    const layerId = `layer_${Date.now()}`;
    animationSystemRef.current.createLayer(layerId, name, blendMode);
    
    const newLayer: AnimationLayer = {
      id: layerId,
      name,
      states: [],
      weight: 1,
      blendMode,
      enabled: true
    };
    
    setLayers(prev => [...prev, {
      layer: newLayer,
      expanded: true,
      solo: false
    }]);
  }, [animationSystemRef]);

  // Filter and sort library
  const filteredLibrary = React.useMemo(() => {
    let filtered = library;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.clip.name.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query)) ||
        item.clip.metadata?.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.clip.name.localeCompare(b.clip.name);
        case 'date':
          return (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0);
        case 'usage':
          return b.useCount - a.useCount;
        default:
          return 0;
      }
    });

    return filtered;
  }, [library, selectedCategory, searchQuery, sortBy]);

  // Import/Export
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.clip) {
          addToLibrary(data.clip);
        } else if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.clip) addToLibrary(item.clip);
          });
        }
        setImportExportDialog(null);
      } catch (error) {
        console.error('Failed to import animation:', error);
      }
    };
    reader.readAsText(file);
  }, [addToLibrary]);

  const handleExport = useCallback((clipId?: string) => {
    const dataToExport = clipId
      ? library.find(item => item.clip.id === clipId)
      : library;

    const json = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = clipId ? `animation_${clipId}.json` : 'animation_library.json';
    a.click();
    URL.revokeObjectURL(url);
    
    setImportExportDialog(null);
  }, [library]);

  // Render helpers
  const renderLibraryItem = (item: AnimationLibraryItem) => {
    const isSelected = selectedClip?.id === item.clip.id;

    return (
      <ListItem
        key={item.clip.id}
        button
        selected={isSelected}
        onClick={() => {
          setSelectedClip(item.clip);
          updateLibraryItem(item.clip.id, {
            lastUsed: new Date(),
            useCount: item.useCount + 1
          });
          if (onAnimationSelect) {
            onAnimationSelect(item.clip);
          }
        }}
        sx={{
          borderRadius: 1,
          mb: 0.5,
          '&.Mui-selected': {
            bgcolor: 'primary.dark',
            '&:hover': {
              bgcolor: 'primary.dark'
            }
          }
        }}
      >
        <ListItemIcon>
          <Animation color={isSelected ? 'primary' : 'inherit'} />
        </ListItemIcon>
        <ListItemText
          primary={item.clip.name}
          secondary={
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
              <Chip
                label={item.category}
                size="small"
                variant="outlined"
              />
              {item.clip.loop && (
                <Chip
                  label="Loop"
                  size="small"
                  icon={<Loop />}
                  variant="outlined"
                />
              )}
              <Typography variant="caption" color="text.secondary">
                {item.clip.duration.toFixed(1)}s
              </Typography>
            </Stack>
          }
        />
        <ListItemSecondaryAction>
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                updateLibraryItem(item.clip.id, { favorite: !item.favorite });
              }}
            >
              {item.favorite ? <VolumeUp color="primary" /> : <VolumeMute />}
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setEditingClip(item.clip);
                setEditDialogOpen(true);
              }}
            >
              <Edit />
            </IconButton>
          </Stack>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  const renderLayerControl = (control: LayerControl, index: number) => {
    const { layer, expanded, solo } = control;

    return (
      <Box key={layer.id} sx={{ mb: 1 }}>
        <Paper
          elevation={1}
          sx={{
            p: 1,
            bgcolor: selectedLayer === layer.id ? 'action.selected' : 'background.paper'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton
              size="small"
              onClick={() => {
                setLayers(prev => prev.map((l, i) =>
                  i === index ? { ...l, expanded: !l.expanded } : l
                ));
              }}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>

            <Typography
              variant="body2"
              sx={{ flex: 1, cursor: 'pointer' }}
              onClick={() => setSelectedLayer(layer.id)}
            >
              {layer.name}
            </Typography>

            <Chip
              label={layer.states.length}
              size="small"
              color={layer.states.some(s => s.isPlaying) ? 'primary' : 'default'}
            />

            <Tooltip title={`Blend Mode: ${layer.blendMode}`}>
              <Box>{BLEND_MODE_ICONS[layer.blendMode]}</Box>
            </Tooltip>

            <Slider
              value={layer.weight}
              onChange={(e, value) => {
                // Update layer weight
                const newLayers = [...layers];
                newLayers[index].layer.weight = value as number;
                setLayers(newLayers);
              }}
              min={0}
              max={1}
              step={0.01}
              sx={{ width: 80 }}
            />

            <ToggleButtonGroup size="small">
              <ToggleButton
                value="enabled"
                selected={layer.enabled}
                onChange={() => {
                  const newLayers = [...layers];
                  newLayers[index].layer.enabled = !layer.enabled;
                  setLayers(newLayers);
                }}
              >
                {layer.enabled ? <Visibility /> : <VisibilityOff />}
              </ToggleButton>
              <ToggleButton
                value="solo"
                selected={solo}
                onChange={() => {
                  setLayers(prev => prev.map((l, i) =>
                    i === index ? { ...l, solo: !l.solo } : { ...l, solo: false }
                  ));
                }}
              >
                <VolumeUp />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Collapse in={expanded}>
            <Box sx={{ mt: 1, pl: 4 }}>
              {layer.states.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No animations in this layer
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {layer.states.map((state, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" sx={{ flex: 1 }}>
                        {library.find(item => item.clip.id === state.clipId)?.clip.name || state.clipId}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(state.time / (library.find(item => item.clip.id === state.clipId)?.clip.duration || 1)) * 100}
                        sx={{ width: 60, height: 4 }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (animationSystemRef.current) {
                            animationSystemRef.current.stop(state.clipId, layer.id);
                          }
                        }}
                      >
                        <Stop fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Collapse>
        </Paper>
      </Box>
    );
  };

  return (
    <Paper
      sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      data-testid={testId}
    >
      {/* Header */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Library" icon={<FolderOpen />} iconPosition="start" />
          <Tab label="Layers" icon={<Layers />} iconPosition="start" />
          <Tab label="Timeline" icon={<Timeline />} iconPosition="start" />
          <Tab label="Procedural" icon={<Settings />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Playback Controls */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Stack spacing={2}>
          {/* Main controls */}
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton
              onClick={isPlaying ? pause : play}
              disabled={!selectedClip}
              color="primary"
              size="large"
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>

            <IconButton onClick={stop} disabled={!selectedClip}>
              <Stop />
            </IconButton>

            <Divider orientation="vertical" flexItem />

            {/* Time display */}
            <Typography variant="body2" sx={{ minWidth: 100 }}>
              {selectedClip ? `${currentTime.toFixed(2)}s / ${selectedClip.duration.toFixed(2)}s` : '--:-- / --:--'}
            </Typography>

            {/* Timeline scrubber */}
            <Slider
              value={currentTime}
              onChange={(e, value) => setCurrentTime(value as number)}
              min={0}
              max={selectedClip?.duration || 1}
              step={0.01}
              disabled={!selectedClip}
              sx={{ flex: 1 }}
            />

            <Divider orientation="vertical" flexItem />

            {/* Speed control */}
            <Typography variant="body2">Speed:</Typography>
            <Slider
              value={playbackSpeed}
              onChange={(e, value) => setPlaybackSpeed(value as number)}
              min={0.1}
              max={2}
              step={0.1}
              marks={[
                { value: 0.5, label: '0.5x' },
                { value: 1, label: '1x' },
                { value: 1.5, label: '1.5x' },
                { value: 2, label: '2x' }
              ]}
              sx={{ width: 150 }}
            />

            {/* Volume control */}
            <IconButton>
              <VolumeUp />
            </IconButton>
            <Slider
              value={masterVolume}
              onChange={(e, value) => setMasterVolume(value as number)}
              min={0}
              max={1}
              step={0.01}
              sx={{ width: 100 }}
            />
          </Stack>

          {/* Selected animation info */}
          {selectedClip && (
            <Alert severity="info" icon={<Animation />}>
              <Typography variant="body2">
                <strong>{selectedClip.name}</strong> - {selectedClip.metadata?.description || 'No description'}
              </Typography>
            </Alert>
          )}
        </Stack>
      </Box>

      {/* Tab Panels */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {/* Library Tab */}
        <TabPanel value={tabValue} index={0}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            {/* Search and filters */}
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                placeholder="Search animations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  )
                }}
                sx={{ flex: 1 }}
              />

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="All">All</MenuItem>
                  {ANIMATION_CATEGORIES.map(cat => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  label="Sort By"
                >
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="date">Last Used</MenuItem>
                  <MenuItem value="usage">Usage</MenuItem>
                </Select>
              </FormControl>

              <IconButton onClick={handleImport}>
                <Upload />
              </IconButton>
            </Stack>

            {/* Animation list */}
            <List sx={{ flex: 1, overflow: 'auto' }}>
              {filteredLibrary.map(item => renderLibraryItem(item))}
            </List>

            {/* Actions */}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  setEditingClip(null);
                  setEditDialogOpen(true);
                }}
                fullWidth
              >
                Create New Animation
              </Button>
            </Stack>
          </Stack>
        </TabPanel>

        {/* Layers Tab */}
        <TabPanel value={tabValue} index={1}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => createLayer(`Layer ${layers.length + 1}`)}
            >
              Add Layer
            </Button>

            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {layers.map((control, index) => renderLayerControl(control, index))}
            </Box>

            {/* Layer blend settings */}
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Layer Blending
              </Typography>
              <Stack spacing={1}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Global Blend Mode</InputLabel>
                  <Select value="override" label="Global Blend Mode">
                    {BLEND_MODES.map(mode => (
                      <MenuItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Paper>
          </Stack>
        </TabPanel>

        {/* Timeline Tab */}
        <TabPanel value={tabValue} index={2}>
          {selectedClip ? (
            <TimelineEditor
              clip={selectedClip}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onClipChange={(clip) => {
                setSelectedClip(clip);
                // Update in library
                setLibrary(prev => prev.map(item =>
                  item.clip.id === clip.id ? { ...item, clip } : item
                ));
              }}
              onTimeChange={setCurrentTime}
              onPlayPause={() => isPlaying ? pause() : play()}
              onStop={stop}
              onExport={(clip) => handleExport(clip.id)}
              onImport={handleImport}
              height={height - 200}
            />
          ) : (
            <Alert severity="info">
              Select an animation from the library to edit its timeline
            </Alert>
          )}
        </TabPanel>

        {/* Procedural Tab */}
        <TabPanel value={tabValue} index={3}>
          <Stack spacing={2}>
            <Typography variant="h6">Procedural Animations</Typography>
            
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => {
                // Add procedural animation
                const newAnim: ProceduralAnimation = {
                  id: `proc_${Date.now()}`,
                  name: 'New Procedural',
                  type: 'sine',
                  targetId: '',
                  property: '',
                  parameters: { frequency: 1, amplitude: 1 },
                  weight: 1,
                  enabled: true
                };
                setProceduralAnims(prev => [...prev, newAnim]);
                if (animationSystemRef.current) {
                  animationSystemRef.current.addProceduralAnimation(newAnim);
                }
              }}
            >
              Add Procedural Animation
            </Button>

            {proceduralAnims.map(anim => (
              <Paper key={anim.id} elevation={1} sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center">
                    <Typography variant="subtitle2" sx={{ flex: 1 }}>
                      {anim.name}
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={anim.enabled}
                          onChange={(e) => {
                            const updated = { ...anim, enabled: e.target.checked };
                            setProceduralAnims(prev =>
                              prev.map(a => a.id === anim.id ? updated : a)
                            );
                          }}
                        />
                      }
                      label="Enabled"
                    />
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <InputLabel>Type</InputLabel>
                      <Select value={anim.type} label="Type">
                        <MenuItem value="sine">Sine Wave</MenuItem>
                        <MenuItem value="noise">Noise</MenuItem>
                        <MenuItem value="custom">Custom</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      size="small"
                      label="Target"
                      value={anim.targetId}
                      sx={{ flex: 1 }}
                    />

                    <TextField
                      size="small"
                      label="Property"
                      value={anim.property}
                      sx={{ flex: 1 }}
                    />
                  </Stack>

                  {/* Parameters */}
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      type="number"
                      label="Frequency"
                      value={anim.parameters.frequency || 1}
                      onChange={(e) => {
                        const updated = {
                          ...anim,
                          parameters: { ...anim.parameters, frequency: parseFloat(e.target.value) }
                        };
                        setProceduralAnims(prev =>
                          prev.map(a => a.id === anim.id ? updated : a)
                        );
                      }}
                      sx={{ flex: 1 }}
                    />

                    <TextField
                      size="small"
                      type="number"
                      label="Amplitude"
                      value={anim.parameters.amplitude || 1}
                      onChange={(e) => {
                        const updated = {
                          ...anim,
                          parameters: { ...anim.parameters, amplitude: parseFloat(e.target.value) }
                        };
                        setProceduralAnims(prev =>
                          prev.map(a => a.id === anim.id ? updated : a)
                        );
                      }}
                      sx={{ flex: 1 }}
                    />

                    <Slider
                      value={anim.weight}
                      onChange={(e, value) => {
                        const updated = { ...anim, weight: value as number };
                        setProceduralAnims(prev =>
                          prev.map(a => a.id === anim.id ? updated : a)
                        );
                      }}
                      min={0}
                      max={1}
                      step={0.01}
                      sx={{ width: 100 }}
                    />
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </TabPanel>
      </Box>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingClip ? 'Edit Animation' : 'Create New Animation'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={editingClip?.name || ''}
              onChange={(e) => {
                if (editingClip) {
                  setEditingClip({ ...editingClip, name: e.target.value });
                }
              }}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={editingClip?.metadata?.description || ''}
              onChange={(e) => {
                if (editingClip) {
                  setEditingClip({
                    ...editingClip,
                    metadata: { ...editingClip.metadata, description: e.target.value }
                  });
                }
              }}
            />

            <Stack direction="row" spacing={2}>
              <TextField
                type="number"
                label="Duration (s)"
                value={editingClip?.duration || 1}
                onChange={(e) => {
                  if (editingClip) {
                    setEditingClip({ ...editingClip, duration: parseFloat(e.target.value) });
                  }
                }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={editingClip?.loop || false}
                    onChange={(e) => {
                      if (editingClip) {
                        setEditingClip({ ...editingClip, loop: e.target.checked });
                      }
                    }}
                  />
                }
                label="Loop"
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (editingClip) {
                if (library.find(item => item.clip.id === editingClip.id)) {
                  // Update existing
                  updateLibraryItem(editingClip.id, { clip: editingClip });
                } else {
                  // Add new
                  addToLibrary(editingClip);
                }
              }
              setEditDialogOpen(false);
            }}
          >
            {editingClip && library.find(item => item.clip.id === editingClip.id) ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default AnimationControlPanel;
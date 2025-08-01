/**
 * Simulation Recorder Component
 * Records and manages simulation sessions for playback
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Slider,
  Chip,
  Alert,
  LinearProgress,
  FormControlLabel,
  Switch,
  Divider,
  Paper,
  Tooltip,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction
} from '@mui/material';
import {
  FiberManualRecord,
  Stop,
  PlayArrow,
  Pause,
  FastForward,
  FastRewind,
  Delete,
  Download,
  Upload,
  Share,
  Info,
  Timer,
  Storage,
  Event,
  MoreVert,
  Compress,
  CloudUpload,
  CloudDownload
} from '@mui/icons-material';

interface SimulationRecorderProps {
  recordings: string[];
  isRecording: boolean;
  onPlayback: (recordingId: string, speed: number) => void;
  onRefresh: () => void;
}

interface Recording {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  duration: number;
  eventCount: number;
  size: number;
  compressed: boolean;
  metadata: {
    description?: string;
    tags?: string[];
    simulationConfig?: any;
  };
}

interface PlaybackState {
  recordingId: string;
  isPlaying: boolean;
  isPaused: boolean;
  progress: number;
  speed: number;
  currentTime: number;
  totalTime: number;
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const SimulationRecorder: React.FC<SimulationRecorderProps> = ({
  recordings: recordingIds,
  isRecording,
  onPlayback,
  onRefresh
}) => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [playbackDialogOpen, setPlaybackDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuRecording, setMenuRecording] = useState<Recording | null>(null);
  const [recordingStatus, setRecordingStatus] = useState({
    duration: 0,
    eventCount: 0,
    size: 0
  });
  
  // Fetch recording details
  useEffect(() => {
    fetchRecordingDetails();
  }, [recordingIds]);
  
  // Update recording status
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setRecordingStatus(prev => ({
          ...prev,
          duration: prev.duration + 1
        }));
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setRecordingStatus({ duration: 0, eventCount: 0, size: 0 });
    }
  }, [isRecording]);
  
  // WebSocket for recording status updates
  useEffect(() => {
    if (isRecording) {
      const ws = new WebSocket('ws://localhost:8000/ws/recording-status');
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'recording_update') {
          setRecordingStatus(prev => ({
            ...prev,
            eventCount: data.eventCount,
            size: data.size
          }));
        }
      };
      
      return () => {
        ws.close();
      };
    }
  }, [isRecording]);
  
  const fetchRecordingDetails = async () => {
    // In a real implementation, this would fetch details from the backend
    const mockRecordings: Recording[] = recordingIds.map((id, index) => ({
      id,
      name: `Recording ${index + 1}`,
      startTime: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      endTime: new Date().toISOString(),
      duration: Math.floor(Math.random() * 3600),
      eventCount: Math.floor(Math.random() * 10000),
      size: Math.floor(Math.random() * 50 * 1024 * 1024),
      compressed: Math.random() > 0.5,
      metadata: {
        description: 'Test recording session',
        tags: ['test', 'simulation']
      }
    }));
    
    setRecordings(mockRecordings);
  };
  
  const handlePlayback = (recording: Recording) => {
    setSelectedRecording(recording);
    setPlaybackState({
      recordingId: recording.id,
      isPlaying: false,
      isPaused: false,
      progress: 0,
      speed: 1,
      currentTime: 0,
      totalTime: recording.duration
    });
    setPlaybackDialogOpen(true);
  };
  
  const handleStartPlayback = () => {
    if (selectedRecording && playbackState) {
      onPlayback(selectedRecording.id, playbackState.speed);
      setPlaybackState({ ...playbackState, isPlaying: true });
      
      // Simulate playback progress
      const interval = setInterval(() => {
        setPlaybackState(prev => {
          if (!prev || prev.currentTime >= prev.totalTime) {
            clearInterval(interval);
            return prev;
          }
          
          return {
            ...prev,
            currentTime: Math.min(prev.currentTime + prev.speed, prev.totalTime),
            progress: Math.min((prev.currentTime + prev.speed) / prev.totalTime * 100, 100)
          };
        });
      }, 1000);
    }
  };
  
  const handleSpeedChange = (event: Event, newValue: number | number[]) => {
    if (playbackState) {
      setPlaybackState({ ...playbackState, speed: newValue as number });
    }
  };
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, recording: Recording) => {
    setAnchorEl(event.currentTarget);
    setMenuRecording(recording);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuRecording(null);
  };
  
  const handleDownloadRecording = (recording: Recording) => {
    // In a real implementation, this would trigger a download
    console.log('Downloading recording:', recording.id);
    handleMenuClose();
  };
  
  const handleDeleteRecording = async (recording: Recording) => {
    // In a real implementation, this would delete from the backend
    try {
      await fetch(`/api/simulation/recordings/${recording.id}`, {
        method: 'DELETE'
      });
      onRefresh();
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
    handleMenuClose();
  };
  
  const handleCompressRecording = async (recording: Recording) => {
    // In a real implementation, this would compress the recording
    console.log('Compressing recording:', recording.id);
    handleMenuClose();
  };
  
  const handleUploadRecording = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real implementation, this would upload to the backend
      console.log('Uploading recording:', file.name);
      onRefresh();
    }
  };
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Recording & Playback
      </Typography>
      
      {/* Recording Status */}
      {isRecording && (
        <Card sx={{ mb: 3, bgcolor: 'error.50' }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={2}>
                <FiberManualRecord color="error" sx={{ animation: 'pulse 2s infinite' }} />
                <Box>
                  <Typography variant="h6">Recording in Progress</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Duration: {formatDuration(recordingStatus.duration)} | 
                    Events: {recordingStatus.eventCount.toLocaleString()} | 
                    Size: {formatSize(recordingStatus.size)}
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                color="error"
                startIcon={<Stop />}
                onClick={() => {/* Stop recording */}}
              >
                Stop Recording
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
      
      {/* Recording Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Recordings</Typography>
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                startIcon={<Upload />}
                component="label"
              >
                Upload
                <input
                  type="file"
                  accept=".rec,.json"
                  hidden
                  onChange={handleUploadRecording}
                />
              </Button>
              <Button
                variant="contained"
                startIcon={<FiberManualRecord />}
                color="error"
                disabled={isRecording}
                onClick={() => {/* Start recording */}}
              >
                Start Recording
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      {/* Recordings List */}
      {recordings.length === 0 ? (
        <Alert severity="info">
          No recordings available. Start a recording or upload an existing one.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Events</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recordings.map((recording) => (
                <TableRow key={recording.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography>{recording.name}</Typography>
                      {recording.compressed && (
                        <Chip label="Compressed" size="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {new Date(recording.startTime).toLocaleString()}
                  </TableCell>
                  <TableCell>{formatDuration(recording.duration)}</TableCell>
                  <TableCell>{recording.eventCount.toLocaleString()}</TableCell>
                  <TableCell>{formatSize(recording.size)}</TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <Tooltip title="Play">
                        <IconButton
                          size="small"
                          onClick={() => handlePlayback(recording)}
                        >
                          <PlayArrow />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Details">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedRecording(recording);
                            setDetailsDialogOpen(true);
                          }}
                        >
                          <Info />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, recording)}
                      >
                        <MoreVert />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Playback Dialog */}
      <Dialog
        open={playbackDialogOpen}
        onClose={() => setPlaybackDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Playback Recording</DialogTitle>
        <DialogContent>
          {selectedRecording && playbackState && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedRecording.name}
              </Typography>
              
              {/* Playback Progress */}
              <Box mb={3}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">
                    {formatDuration(playbackState.currentTime)}
                  </Typography>
                  <Typography variant="body2">
                    {formatDuration(playbackState.totalTime)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={playbackState.progress}
                />
              </Box>
              
              {/* Playback Controls */}
              <Box display="flex" justifyContent="center" alignItems="center" gap={2} mb={3}>
                <IconButton>
                  <FastRewind />
                </IconButton>
                <IconButton
                  onClick={handleStartPlayback}
                  disabled={playbackState.isPlaying}
                  color="primary"
                  sx={{ 
                    bgcolor: 'primary.light',
                    '&:hover': { bgcolor: 'primary.main' }
                  }}
                >
                  {playbackState.isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
                <IconButton>
                  <FastForward />
                </IconButton>
              </Box>
              
              {/* Speed Control */}
              <Box mb={3}>
                <Typography gutterBottom>
                  Playback Speed: {playbackState.speed}x
                </Typography>
                <Slider
                  value={playbackState.speed}
                  onChange={handleSpeedChange}
                  min={0.1}
                  max={10}
                  step={0.1}
                  marks={[
                    { value: 0.5, label: '0.5x' },
                    { value: 1, label: '1x' },
                    { value: 2, label: '2x' },
                    { value: 5, label: '5x' },
                    { value: 10, label: '10x' }
                  ]}
                />
              </Box>
              
              {/* Playback Options */}
              <Box>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Show events in real-time"
                />
                <FormControlLabel
                  control={<Switch />}
                  label="Skip idle periods"
                />
                <FormControlLabel
                  control={<Switch />}
                  label="Loop playback"
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlaybackDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Recording Details</DialogTitle>
        <DialogContent>
          {selectedRecording && (
            <Box>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Name"
                    secondary={selectedRecording.name}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Start Time"
                    secondary={new Date(selectedRecording.startTime).toLocaleString()}
                  />
                </ListItem>
                {selectedRecording.endTime && (
                  <ListItem>
                    <ListItemText
                      primary="End Time"
                      secondary={new Date(selectedRecording.endTime).toLocaleString()}
                    />
                  </ListItem>
                )}
                <ListItem>
                  <ListItemText
                    primary="Duration"
                    secondary={formatDuration(selectedRecording.duration)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Event Count"
                    secondary={selectedRecording.eventCount.toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="File Size"
                    secondary={formatSize(selectedRecording.size)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Compressed"
                    secondary={selectedRecording.compressed ? 'Yes' : 'No'}
                  />
                </ListItem>
              </List>
              
              {selectedRecording.metadata.description && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Description
                  </Typography>
                  <Typography variant="body2">
                    {selectedRecording.metadata.description}
                  </Typography>
                </Box>
              )}
              
              {selectedRecording.metadata.tags && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Tags
                  </Typography>
                  <Box display="flex" gap={0.5}>
                    {selectedRecording.metadata.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (menuRecording) {
            handleDownloadRecording(menuRecording);
          }
        }}>
          <Download sx={{ mr: 1 }} fontSize="small" />
          Download
        </MenuItem>
        {menuRecording && !menuRecording.compressed && (
          <MenuItem onClick={() => {
            if (menuRecording) {
              handleCompressRecording(menuRecording);
            }
          }}>
            <Compress sx={{ mr: 1 }} fontSize="small" />
            Compress
          </MenuItem>
        )}
        <MenuItem onClick={() => {/* Share functionality */}}>
          <Share sx={{ mr: 1 }} fontSize="small" />
          Share
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          if (menuRecording) {
            handleDeleteRecording(menuRecording);
          }
        }} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>
      
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </Box>
  );
};
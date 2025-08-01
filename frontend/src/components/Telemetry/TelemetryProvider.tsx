/**
 * TelemetryProvider - React Context Provider for telemetry functionality
 * Provides TelemetryManager instance to all components and manages telemetry lifecycle
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
  useMemo
} from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress,
  SelectChangeEvent
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { 
  TelemetryManager,
  TelemetryStreamConfig,
  TelemetryDataPoint,
  TelemetryStreamStats,
  StreamSubscription,
  TelemetryUpdateEvent,
  TelemetryDataType
} from '../../services/websocket/TelemetryManager';
import { useWebSocket } from '../WebSocket/WebSocketProvider';
import { MessageType, Priority } from '../../services/websocket/types';

/**
 * Telemetry preferences stored per user
 */
export interface TelemetryPreferences {
  defaultBufferSize: number;
  defaultDecimationFactor: number;
  autoSubscribe: string[]; // Stream IDs to auto-subscribe
  chartDefaults: {
    timeWindow: number; // Seconds to display
    refreshRate: number; // Hz
    theme: 'light' | 'dark';
  };
  recording: {
    autoRecord: boolean;
    maxDuration: number; // Seconds
    maxFileSize: number; // MB
  };
  display: {
    showStats: boolean;
    showQuality: boolean;
    showTimestamps: boolean;
    dateFormat: string;
  };
}

/**
 * Historical data request parameters
 */
export interface HistoricalDataRequest {
  streamId: string;
  startTime: number;
  endTime: number;
  maxPoints?: number;
  aggregation?: 'none' | 'average' | 'min' | 'max' | 'first' | 'last';
}

/**
 * Recording session information
 */
export interface RecordingSession {
  id: string;
  streamIds: string[];
  startTime: number;
  endTime?: number;
  status: 'recording' | 'stopped' | 'exporting';
  dataPoints: number;
  fileSize: number;
}

/**
 * Stream health status
 */
export interface StreamHealth {
  streamId: string;
  status: 'healthy' | 'degraded' | 'error' | 'offline';
  latency: number;
  packetLoss: number;
  lastUpdate: number;
  issues: string[];
}

/**
 * Telemetry context value
 */
export interface TelemetryContextValue {
  // Manager instance
  manager: TelemetryManager | null;
  
  // Connection state
  isConnected: boolean;
  
  // Stream management
  availableStreams: TelemetryStreamConfig[];
  activeStreams: StreamSubscription[];
  streamStats: Map<string, TelemetryStreamStats>;
  streamHealth: Map<string, StreamHealth>;
  
  // Actions
  subscribe: (config: TelemetryStreamConfig) => Promise<string>;
  unsubscribe: (streamId: string) => Promise<void>;
  pauseStream: (streamId: string) => Promise<void>;
  resumeStream: (streamId: string) => Promise<void>;
  clearStreamData: (streamId: string) => void;
  updateStreamConfig: (streamId: string, updates: Partial<TelemetryStreamConfig>) => Promise<void>;
  
  // Data access
  getStreamData: (streamId: string, count?: number) => TelemetryDataPoint[];
  getHistoricalData: (request: HistoricalDataRequest) => Promise<TelemetryDataPoint[]>;
  exportStreamData: (streamId: string) => any;
  
  // Recording
  recordingSession: RecordingSession | null;
  startRecording: (streamIds: string[]) => void;
  stopRecording: () => void;
  exportRecording: (format: 'json' | 'csv' | 'binary') => Promise<Blob>;
  
  // Preferences
  preferences: TelemetryPreferences;
  updatePreferences: (updates: Partial<TelemetryPreferences>) => void;
  
  // Utilities
  refreshAvailableStreams: () => Promise<void>;
  getStreamHealth: (streamId: string) => StreamHealth | undefined;
}

/**
 * Default preferences
 */
const DEFAULT_PREFERENCES: TelemetryPreferences = {
  defaultBufferSize: 1000,
  defaultDecimationFactor: 1,
  autoSubscribe: [],
  chartDefaults: {
    timeWindow: 60,
    refreshRate: 30,
    theme: 'dark'
  },
  recording: {
    autoRecord: false,
    maxDuration: 3600,
    maxFileSize: 100
  },
  display: {
    showStats: true,
    showQuality: true,
    showTimestamps: true,
    dateFormat: 'HH:mm:ss.SSS'
  }
};

/**
 * Telemetry context
 */
const TelemetryContext = createContext<TelemetryContextValue | null>(null);

/**
 * TelemetryProvider props
 */
interface TelemetryProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
  preferences?: Partial<TelemetryPreferences>;
}

/**
 * TelemetryProvider component
 */
export const TelemetryProvider: React.FC<TelemetryProviderProps> = ({
  children,
  autoConnect = true,
  preferences: initialPreferences = {}
}) => {
  const { client, isConnected } = useWebSocket();
  const [manager, setManager] = useState<TelemetryManager | null>(null);
  const [availableStreams, setAvailableStreams] = useState<TelemetryStreamConfig[]>([]);
  const [activeStreams, setActiveStreams] = useState<StreamSubscription[]>([]);
  const [streamStats, setStreamStats] = useState<Map<string, TelemetryStreamStats>>(new Map());
  const [streamHealth, setStreamHealth] = useState<Map<string, StreamHealth>>(new Map());
  const [preferences, setPreferences] = useState<TelemetryPreferences>({
    ...DEFAULT_PREFERENCES,
    ...initialPreferences
  });
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  
  // Refs for recording data
  const recordingDataRef = useRef<Map<string, TelemetryDataPoint[]>>(new Map());
  const recordingIntervalRef = useRef<NodeJS.Timeout>();
  
  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'recording' | 'display'>('general');

  /**
   * Initialize telemetry manager
   */
  useEffect(() => {
    if (client && isConnected) {
      const telemetryManager = new TelemetryManager(client);
      
      // Set up event listeners
      telemetryManager.on('stream:subscribed', (subscription) => {
        setActiveStreams(prev => [...prev, subscription]);
      });
      
      telemetryManager.on('stream:unsubscribed', (streamId) => {
        setActiveStreams(prev => prev.filter(s => s.streamId !== streamId));
        streamStats.delete(streamId);
        streamHealth.delete(streamId);
      });
      
      telemetryManager.on('stream:data', (event: TelemetryUpdateEvent) => {
        // Update stats
        setStreamStats(prev => {
          const newStats = new Map(prev);
          newStats.set(event.streamId, event.stats);
          return newStats;
        });
        
        // Record data if session is active
        if (recordingSession && recordingSession.status === 'recording') {
          const streamData = recordingDataRef.current.get(event.streamId) || [];
          streamData.push(event.data);
          recordingDataRef.current.set(event.streamId, streamData);
        }
      });
      
      telemetryManager.on('stats:update', (stats) => {
        setStreamStats(prev => {
          const newStats = new Map(prev);
          newStats.set(stats.streamId, stats);
          return newStats;
        });
      });
      
      telemetryManager.on('stream:error', (streamId, error) => {
        console.error(`Stream ${streamId} error:`, error);
        updateStreamHealth(streamId, 'error', error.message);
      });
      
      setManager(telemetryManager);
      
      // Auto-subscribe to preferred streams
      if (autoConnect && preferences.autoSubscribe.length > 0) {
        autoSubscribeStreams(telemetryManager);
      }
      
      return () => {
        telemetryManager.destroy();
      };
    }
  }, [client, isConnected]);

  /**
   * Load preferences from localStorage
   */
  useEffect(() => {
    const savedPrefs = localStorage.getItem('telemetryPreferences');
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      } catch (error) {
        console.error('Failed to load telemetry preferences:', error);
      }
    }
  }, []);

  /**
   * Save preferences to localStorage
   */
  const updatePreferences = useCallback((updates: Partial<TelemetryPreferences>) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, ...updates };
      localStorage.setItem('telemetryPreferences', JSON.stringify(newPrefs));
      return newPrefs;
    });
  }, []);

  /**
   * Auto-subscribe to preferred streams
   */
  const autoSubscribeStreams = useCallback(async (telemetryManager: TelemetryManager) => {
    for (const streamId of preferences.autoSubscribe) {
      const streamConfig = availableStreams.find(s => s.streamId === streamId);
      if (streamConfig) {
        try {
          await telemetryManager.subscribe({
            ...streamConfig,
            bufferSize: preferences.defaultBufferSize,
            decimationFactor: preferences.defaultDecimationFactor
          });
        } catch (error) {
          console.error(`Failed to auto-subscribe to ${streamId}:`, error);
        }
      }
    }
  }, [preferences, availableStreams]);

  /**
   * Refresh available streams from server
   */
  const refreshAvailableStreams = useCallback(async () => {
    if (!client || !isConnected) return;
    
    try {
      await client.sendMessage(
        MessageType.COMMAND,
        { action: 'list_telemetry_streams' },
        Priority.HIGH
      );
      
      // Listen for response
      const handleResponse = (message: any) => {
        if (message.type === MessageType.RESPONSE && 
            message.payload?.action === 'list_telemetry_streams') {
          setAvailableStreams(message.payload.streams || []);
          client.off('onMessage', handleResponse);
        }
      };
      
      client.on('onMessage', handleResponse);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        client.off('onMessage', handleResponse);
      }, 5000);
    } catch (error) {
      console.error('Failed to refresh available streams:', error);
    }
  }, [client, isConnected]);

  /**
   * Subscribe to a telemetry stream
   */
  const subscribe = useCallback(async (config: TelemetryStreamConfig): Promise<string> => {
    if (!manager) {
      throw new Error('Telemetry manager not initialized');
    }
    
    const streamId = await manager.subscribe({
      ...config,
      bufferSize: config.bufferSize || preferences.defaultBufferSize,
      decimationFactor: config.decimationFactor || preferences.defaultDecimationFactor
    });
    
    // Initialize stream health
    updateStreamHealth(streamId, 'healthy');
    
    return streamId;
  }, [manager, preferences]);

  /**
   * Unsubscribe from a telemetry stream
   */
  const unsubscribe = useCallback(async (streamId: string) => {
    if (!manager) {
      throw new Error('Telemetry manager not initialized');
    }
    
    await manager.unsubscribe(streamId);
  }, [manager]);

  /**
   * Pause a telemetry stream
   */
  const pauseStream = useCallback(async (streamId: string) => {
    if (!manager) {
      throw new Error('Telemetry manager not initialized');
    }
    
    await manager.pause(streamId);
  }, [manager]);

  /**
   * Resume a telemetry stream
   */
  const resumeStream = useCallback(async (streamId: string) => {
    if (!manager) {
      throw new Error('Telemetry manager not initialized');
    }
    
    await manager.resume(streamId);
  }, [manager]);

  /**
   * Clear stream data
   */
  const clearStreamData = useCallback((streamId: string) => {
    if (!manager) return;
    
    manager.clearStreamData(streamId);
  }, [manager]);

  /**
   * Update stream configuration
   */
  const updateStreamConfig = useCallback(async (
    streamId: string, 
    updates: Partial<TelemetryStreamConfig>
  ) => {
    if (!manager) {
      throw new Error('Telemetry manager not initialized');
    }
    
    await manager.updateStreamConfig(streamId, updates);
  }, [manager]);

  /**
   * Get stream data
   */
  const getStreamData = useCallback((streamId: string, count?: number): TelemetryDataPoint[] => {
    if (!manager) return [];
    
    return manager.getData(streamId, count);
  }, [manager]);

  /**
   * Get historical data from server
   */
  const getHistoricalData = useCallback(async (
    request: HistoricalDataRequest
  ): Promise<TelemetryDataPoint[]> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.off('onMessage', handleResponse);
        reject(new Error('Historical data request timed out'));
      }, 30000);
      
      const handleResponse = (message: any) => {
        if (message.type === MessageType.RESPONSE && 
            message.payload?.requestId === request.streamId) {
          clearTimeout(timeout);
          client.off('onMessage', handleResponse);
          resolve(message.payload.data || []);
        }
      };
      
      client.on('onMessage', handleResponse);
      
      client.sendMessage(
        MessageType.COMMAND,
        {
          action: 'get_historical_data',
          ...request,
          requestId: request.streamId
        },
        Priority.HIGH
      ).catch(error => {
        clearTimeout(timeout);
        client.off('onMessage', handleResponse);
        reject(error);
      });
    });
  }, [client, isConnected]);

  /**
   * Export stream data
   */
  const exportStreamData = useCallback((streamId: string) => {
    if (!manager) return null;
    
    return manager.exportStreamData(streamId);
  }, [manager]);

  /**
   * Start recording session
   */
  const startRecording = useCallback((streamIds: string[]) => {
    if (recordingSession) {
      console.warn('Recording session already active');
      return;
    }
    
    const sessionId = `rec_${Date.now()}`;
    
    // Initialize recording data
    recordingDataRef.current.clear();
    streamIds.forEach(id => {
      recordingDataRef.current.set(id, []);
    });
    
    // Create session
    const session: RecordingSession = {
      id: sessionId,
      streamIds,
      startTime: Date.now(),
      status: 'recording',
      dataPoints: 0,
      fileSize: 0
    };
    
    setRecordingSession(session);
    
    // Update stats periodically
    recordingIntervalRef.current = setInterval(() => {
      let totalPoints = 0;
      let totalSize = 0;
      
      recordingDataRef.current.forEach(data => {
        totalPoints += data.length;
        // Rough estimate of size
        totalSize += JSON.stringify(data).length;
      });
      
      setRecordingSession(prev => {
        if (!prev) return null;
        
        // Check limits
        const duration = (Date.now() - prev.startTime) / 1000;
        if (duration > preferences.recording.maxDuration ||
            totalSize / 1024 / 1024 > preferences.recording.maxFileSize) {
          stopRecording();
          return prev;
        }
        
        return {
          ...prev,
          dataPoints: totalPoints,
          fileSize: totalSize
        };
      });
    }, 1000);
  }, [recordingSession, preferences, stopRecording]);

  /**
   * Stop recording session
   */
  const stopRecording = useCallback(() => {
    if (!recordingSession || recordingSession.status !== 'recording') return;
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    
    setRecordingSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'stopped',
        endTime: Date.now()
      };
    });
  }, [recordingSession]);

  /**
   * Export recording
   */
  const exportRecording = useCallback(async (
    format: 'json' | 'csv' | 'binary'
  ): Promise<Blob> => {
    if (!recordingSession) {
      throw new Error('No recording session available');
    }
    
    setRecordingSession(prev => {
      if (!prev) return null;
      return { ...prev, status: 'exporting' };
    });
    
    try {
      let content: string | ArrayBuffer;
      let mimeType: string;
      
      switch (format) {
        case 'json':
          const jsonData = {
            session: recordingSession,
            streams: Object.fromEntries(recordingDataRef.current)
          };
          content = JSON.stringify(jsonData, null, 2);
          mimeType = 'application/json';
          break;
          
        case 'csv':
          // Convert to CSV format
          let csv = 'streamId,timestamp,value,quality\n';
          recordingDataRef.current.forEach((data, streamId) => {
            data.forEach(point => {
              csv += `${streamId},${point.timestamp},${JSON.stringify(point.value)},${point.quality || 1}\n`;
            });
          });
          content = csv;
          mimeType = 'text/csv';
          break;
          
        case 'binary':
          // Convert to binary format (implementation depends on requirements)
          const encoder = new TextEncoder();
          content = encoder.encode(JSON.stringify({
            session: recordingSession,
            streams: Object.fromEntries(recordingDataRef.current)
          })).buffer;
          mimeType = 'application/octet-stream';
          break;
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      const blob = new Blob([content], { type: mimeType });
      
      // Clear recording data after export
      recordingDataRef.current.clear();
      setRecordingSession(null);
      
      return blob;
    } catch (error) {
      setRecordingSession(prev => {
        if (!prev) return null;
        return { ...prev, status: 'stopped' };
      });
      throw error;
    }
  }, [recordingSession]);

  /**
   * Update stream health
   */
  const updateStreamHealth = useCallback((
    streamId: string, 
    status: StreamHealth['status'],
    issue?: string
  ) => {
    setStreamHealth(prev => {
      const newHealth = new Map(prev);
      const existing = newHealth.get(streamId) || {
        streamId,
        status: 'healthy',
        latency: 0,
        packetLoss: 0,
        lastUpdate: Date.now(),
        issues: []
      };
      
      newHealth.set(streamId, {
        ...existing,
        status,
        lastUpdate: Date.now(),
        issues: issue ? [...existing.issues, issue].slice(-5) : existing.issues
      });
      
      return newHealth;
    });
  }, []);

  /**
   * Get stream health
   */
  const getStreamHealth = useCallback((streamId: string): StreamHealth | undefined => {
    return streamHealth.get(streamId);
  }, [streamHealth]);

  /**
   * Monitor stream health
   */
  useEffect(() => {
    if (!manager) return;
    
    const interval = setInterval(() => {
      activeStreams.forEach(stream => {
        const stats = streamStats.get(stream.streamId);
        if (!stats) return;
        
        const timeSinceUpdate = Date.now() - stats.lastUpdate;
        let status: StreamHealth['status'] = 'healthy';
        
        if (timeSinceUpdate > 10000) {
          status = 'offline';
        } else if (timeSinceUpdate > 5000) {
          status = 'error';
        } else if (stats.dataQuality < 0.8 || stats.droppedPoints > 10) {
          status = 'degraded';
        }
        
        updateStreamHealth(stream.streamId, status);
      });
    }, 2000);
    
    return () => clearInterval(interval);
  }, [manager, activeStreams, streamStats, updateStreamHealth]);

  // Load available streams on mount
  useEffect(() => {
    if (isConnected) {
      refreshAvailableStreams();
    }
  }, [isConnected, refreshAvailableStreams]);

  /**
   * Context value
   */
  const contextValue = useMemo<TelemetryContextValue>(() => ({
    manager,
    isConnected,
    availableStreams,
    activeStreams,
    streamStats,
    streamHealth,
    subscribe,
    unsubscribe,
    pauseStream,
    resumeStream,
    clearStreamData,
    updateStreamConfig,
    getStreamData,
    getHistoricalData,
    exportStreamData,
    recordingSession,
    startRecording,
    stopRecording,
    exportRecording,
    preferences,
    updatePreferences,
    refreshAvailableStreams,
    getStreamHealth
  }), [
    manager,
    isConnected,
    availableStreams,
    activeStreams,
    streamStats,
    streamHealth,
    subscribe,
    unsubscribe,
    pauseStream,
    resumeStream,
    clearStreamData,
    updateStreamConfig,
    getStreamData,
    getHistoricalData,
    exportStreamData,
    recordingSession,
    startRecording,
    stopRecording,
    exportRecording,
    preferences,
    updatePreferences,
    refreshAvailableStreams,
    getStreamHealth
  ]);

  return (
    <TelemetryContext.Provider value={contextValue}>
      {children}
      
      {/* Settings Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Telemetry Settings
        </DialogTitle>
        <DialogContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Button
              onClick={() => setSettingsTab('general')}
              variant={settingsTab === 'general' ? 'contained' : 'text'}
            >
              General
            </Button>
            <Button
              onClick={() => setSettingsTab('recording')}
              variant={settingsTab === 'recording' ? 'contained' : 'text'}
            >
              Recording
            </Button>
            <Button
              onClick={() => setSettingsTab('display')}
              variant={settingsTab === 'display' ? 'contained' : 'text'}
            >
              Display
            </Button>
          </Box>
          
          {settingsTab === 'general' && (
            <Box>
              <TextField
                fullWidth
                label="Default Buffer Size"
                type="number"
                value={preferences.defaultBufferSize}
                onChange={(e) => updatePreferences({
                  defaultBufferSize: parseInt(e.target.value) || 1000
                })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Default Decimation Factor"
                type="number"
                value={preferences.defaultDecimationFactor}
                onChange={(e) => updatePreferences({
                  defaultDecimationFactor: parseInt(e.target.value) || 1
                })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Chart Time Window (seconds)"
                type="number"
                value={preferences.chartDefaults.timeWindow}
                onChange={(e) => updatePreferences({
                  chartDefaults: {
                    ...preferences.chartDefaults,
                    timeWindow: parseInt(e.target.value) || 60
                  }
                })}
                margin="normal"
              />
            </Box>
          )}
          
          {settingsTab === 'recording' && (
            <Box>
              <FormControl fullWidth margin="normal">
                <InputLabel>Auto Record</InputLabel>
                <Select
                  value={preferences.recording.autoRecord ? 'yes' : 'no'}
                  onChange={(e: SelectChangeEvent) => updatePreferences({
                    recording: {
                      ...preferences.recording,
                      autoRecord: e.target.value === 'yes'
                    }
                  })}
                >
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Max Recording Duration (seconds)"
                type="number"
                value={preferences.recording.maxDuration}
                onChange={(e) => updatePreferences({
                  recording: {
                    ...preferences.recording,
                    maxDuration: parseInt(e.target.value) || 3600
                  }
                })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Max File Size (MB)"
                type="number"
                value={preferences.recording.maxFileSize}
                onChange={(e) => updatePreferences({
                  recording: {
                    ...preferences.recording,
                    maxFileSize: parseInt(e.target.value) || 100
                  }
                })}
                margin="normal"
              />
            </Box>
          )}
          
          {settingsTab === 'display' && (
            <Box>
              <FormControl fullWidth margin="normal">
                <InputLabel>Show Statistics</InputLabel>
                <Select
                  value={preferences.display.showStats ? 'yes' : 'no'}
                  onChange={(e: SelectChangeEvent) => updatePreferences({
                    display: {
                      ...preferences.display,
                      showStats: e.target.value === 'yes'
                    }
                  })}
                >
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth margin="normal">
                <InputLabel>Show Quality Indicator</InputLabel>
                <Select
                  value={preferences.display.showQuality ? 'yes' : 'no'}
                  onChange={(e: SelectChangeEvent) => updatePreferences({
                    display: {
                      ...preferences.display,
                      showQuality: e.target.value === 'yes'
                    }
                  })}
                >
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Date Format"
                value={preferences.display.dateFormat}
                onChange={(e) => updatePreferences({
                  display: {
                    ...preferences.display,
                    dateFormat: e.target.value
                  }
                })}
                margin="normal"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </TelemetryContext.Provider>
  );
};

/**
 * Hook to use telemetry context
 */
export const useTelemetry = (): TelemetryContextValue => {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
};

/**
 * Hook for telemetry stream subscription
 */
export const useTelemetryStream = (streamId: string | null) => {
  const { 
    manager, 
    activeStreams, 
    streamStats, 
    streamHealth,
    getStreamData,
    pauseStream,
    resumeStream,
    clearStreamData
  } = useTelemetry();
  
  const subscription = streamId 
    ? activeStreams.find(s => s.streamId === streamId)
    : null;
  
  const stats = streamId && streamStats.get(streamId);
  const health = streamId && streamHealth.get(streamId);
  const data = streamId ? getStreamData(streamId) : [];
  
  return {
    subscription,
    stats,
    health,
    data,
    isActive: subscription?.active || false,
    isPaused: subscription?.paused || false,
    pause: streamId ? () => pauseStream(streamId) : undefined,
    resume: streamId ? () => resumeStream(streamId) : undefined,
    clear: streamId ? () => clearStreamData(streamId) : undefined
  };
};

/**
 * Hook for telemetry recording
 */
export const useTelemetryRecording = () => {
  const {
    recordingSession,
    startRecording,
    stopRecording,
    exportRecording,
    activeStreams
  } = useTelemetry();
  
  const isRecording = recordingSession?.status === 'recording';
  const canRecord = activeStreams.length > 0;
  
  return {
    session: recordingSession,
    isRecording,
    canRecord,
    startRecording,
    stopRecording,
    exportRecording,
    activeStreamIds: activeStreams.map(s => s.streamId)
  };
};

/**
 * Hook for telemetry preferences
 */
export const useTelemetryPreferences = () => {
  const { preferences, updatePreferences } = useTelemetry();
  
  return {
    preferences,
    updatePreferences,
    resetPreferences: () => updatePreferences(DEFAULT_PREFERENCES)
  };
};

/**
 * Hook for stream health monitoring
 */
export const useTelemetryHealth = () => {
  const { streamHealth, activeStreams } = useTelemetry();
  
  const overallHealth = useMemo(() => {
    if (activeStreams.length === 0) return 'offline';
    
    let healthyCount = 0;
    let degradedCount = 0;
    let errorCount = 0;
    
    activeStreams.forEach(stream => {
      const health = streamHealth.get(stream.streamId);
      if (!health) return;
      
      switch (health.status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'degraded':
          degradedCount++;
          break;
        case 'error':
        case 'offline':
          errorCount++;
          break;
      }
    });
    
    if (errorCount > 0) return 'error';
    if (degradedCount > 0) return 'degraded';
    if (healthyCount === activeStreams.length) return 'healthy';
    return 'unknown';
  }, [streamHealth, activeStreams]);
  
  return {
    overallHealth,
    streamHealth,
    activeStreamsCount: activeStreams.length,
    healthyStreamsCount: Array.from(streamHealth.values())
      .filter(h => h.status === 'healthy').length
  };
};
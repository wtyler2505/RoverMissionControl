/**
 * CommunicationPanel Component - Mission logs and communication
 * Mission-critical communication interface for rover operations
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PanelProps } from '../../../types/grid';
import './PanelStyles.css';

interface LogEntry {
  id: string;
  timestamp: number;
  type: 'system' | 'command' | 'telemetry' | 'user' | 'error' | 'warning';
  source: string;
  message: string;
  details?: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  acknowledged: boolean;
}

interface CommunicationStats {
  totalMessages: number;
  messagesPerMinute: number;
  errorRate: number;
  averageLatency: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';
}

interface CommunicationPanelProps extends PanelProps {
  logs?: LogEntry[];
  onSendCommand?: (command: string) => void;
  autoScroll?: boolean;
  maxLogEntries?: number;
  showStats?: boolean;
  enableFiltering?: boolean;
}

// Log entry component
const LogEntryComponent: React.FC<{
  entry: LogEntry;
  onAcknowledge?: (id: string) => void;
  showDetails?: boolean;
}> = ({ entry, onAcknowledge, showDetails = false }) => {
  const [expanded, setExpanded] = useState(false);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  const getTypeIcon = () => {
    switch (entry.type) {
      case 'system': return '⚙️';
      case 'command': return '📡';
      case 'telemetry': return '📊';
      case 'user': return '👤';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return '📝';
    }
  };

  const getPriorityColor = () => {
    switch (entry.priority) {
      case 'critical': return 'var(--color-error-main)';
      case 'high': return 'var(--color-warning-main)';
      case 'normal': return 'var(--color-info-main)';
      case 'low': return 'var(--color-text-secondary)';
      default: return 'var(--color-text-secondary)';
    }
  };

  return (
    <div className={`log-entry ${entry.type} priority-${entry.priority} ${entry.acknowledged ? 'acknowledged' : ''}`}>
      <div className="log-header">
        <span className="log-icon">{getTypeIcon()}</span>
        <span className="log-timestamp">{formatTimestamp(entry.timestamp)}</span>
        <span className="log-source">[{entry.source}]</span>
        <span className="log-type">{entry.type.toUpperCase()}</span>
        <div className="log-actions">
          {entry.details && Object.keys(entry.details).length > 0 && (
            <button
              className="details-btn"
              onClick={() => setExpanded(!expanded)}
              title="Toggle details"
            >
              {expanded ? '▼' : '▶'}
            </button>
          )}
          {!entry.acknowledged && (entry.priority === 'high' || entry.priority === 'critical') && (
            <button
              className="acknowledge-btn"
              onClick={() => onAcknowledge?.(entry.id)}
              title="Acknowledge"
            >
              ✓
            </button>
          )}
        </div>
      </div>
      <div className="log-message" style={{ borderLeftColor: getPriorityColor() }}>
        {entry.message}
      </div>
      {expanded && entry.details && (
        <div className="log-details">
          <pre>{JSON.stringify(entry.details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

// Command input component
const CommandInput: React.FC<{
  onSendCommand: (command: string) => void;
  disabled?: boolean;
}> = ({ onSendCommand, disabled = false }) => {
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || disabled) return;

    onSendCommand(command.trim());
    setCommandHistory(prev => [command.trim(), ...prev.slice(0, 49)]); // Keep last 50 commands
    setCommand('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(newIndex);
      setCommand(commandHistory[newIndex] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setCommand(newIndex === -1 ? '' : commandHistory[newIndex]);
    }
  };

  return (
    <form className="command-input" onSubmit={handleSubmit}>
      <div className="input-group">
        <span className="input-prefix">$</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          disabled={disabled}
          className="command-field"
        />
        <button
          type="submit"
          disabled={!command.trim() || disabled}
          className="send-btn"
          title="Send command"
        >
          Send
        </button>
      </div>
      <div className="command-help">
        Use ↑↓ arrows to navigate command history
      </div>
    </form>
  );
};

// Communication stats component
const StatsDisplay: React.FC<{
  stats: CommunicationStats;
  compact?: boolean;
}> = ({ stats, compact = false }) => {
  const getQualityColor = () => {
    switch (stats.connectionQuality) {
      case 'excellent': return '#4CAF50';
      case 'good': return '#8BC34A';
      case 'fair': return '#FF9800';
      case 'poor': return '#FF5722';
      case 'disconnected': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  return (
    <div className={`communication-stats ${compact ? 'compact' : ''}`}>
      <div className="stat-item">
        <span className="stat-label">Connection</span>
        <span 
          className="stat-value"
          style={{ color: getQualityColor() }}
        >
          {stats.connectionQuality.toUpperCase()}
        </span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Messages</span>
        <span className="stat-value">{stats.totalMessages}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Rate</span>
        <span className="stat-value">{stats.messagesPerMinute.toFixed(1)}/min</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Errors</span>
        <span className="stat-value">{(stats.errorRate * 100).toFixed(1)}%</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Latency</span>
        <span className="stat-value">{stats.averageLatency.toFixed(0)}ms</span>
      </div>
    </div>
  );
};

// Mock data generators
const generateMockLogs = (count: number = 50): LogEntry[] => {
  const types: LogEntry['type'][] = ['system', 'command', 'telemetry', 'user', 'error', 'warning'];
  const sources = ['rover', 'ground', 'gps', 'camera', 'sensors', 'navigation', 'power'];
  const priorities: LogEntry['priority'][] = ['low', 'normal', 'high', 'critical'];
  
  const messages = {
    system: [
      'System initialization completed',
      'Firmware update applied successfully',
      'Calibration sequence started',
      'Backup system activated',
      'Maintenance mode engaged'
    ],
    command: [
      'Move forward command executed',
      'Camera tilt adjusted to 15 degrees',
      'Emergency stop command received',
      'Autonomous mode activated',
      'Headlights toggled on'
    ],
    telemetry: [
      'Battery level: 85%',
      'GPS coordinates updated',
      'Temperature reading: 23.5°C',
      'Wheel RPM data collected',
      'Signal strength: 78%'
    ],
    user: [
      'Operator logged in',
      'Manual control session started',
      'Mission parameters updated',
      'Waypoint added to route',
      'User preferences saved'
    ],
    error: [
      'Communication timeout detected',
      'Sensor malfunction in unit 3',
      'Memory allocation failed',
      'GPS signal lost',
      'Motor overheating detected'
    ],
    warning: [
      'Battery level below 25%',
      'High CPU usage detected',
      'Obstacle detected ahead',
      'Weather conditions deteriorating',
      'Communication latency increasing'
    ]
  };

  return Array.from({ length: count }, (_, i) => {
    const type = types[Math.floor(Math.random() * types.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const messageList = messages[type];
    const message = messageList[Math.floor(Math.random() * messageList.length)];
    
    return {
      id: `log-${Date.now()}-${i}`,
      timestamp: Date.now() - (count - i) * 1000 - Math.random() * 1000,
      type,
      source,
      message,
      details: Math.random() > 0.7 ? {
        duration: Math.floor(Math.random() * 1000),
        returnCode: Math.floor(Math.random() * 10),
        additionalInfo: 'Sample debug information'
      } : undefined,
      priority,
      acknowledged: Math.random() > 0.3
    };
  });
};

const generateMockStats = (): CommunicationStats => ({
  totalMessages: 1247 + Math.floor(Math.random() * 100),
  messagesPerMinute: 5.2 + Math.random() * 10,
  errorRate: Math.random() * 0.05,
  averageLatency: 50 + Math.random() * 100,
  connectionQuality: ['excellent', 'good', 'fair', 'poor'][Math.floor(Math.random() * 4)] as any
});

const CommunicationPanel: React.FC<CommunicationPanelProps> = ({
  id,
  config = {},
  logs: externalLogs,
  onSendCommand,
  autoScroll = true,
  maxLogEntries = 100,
  showStats = true,
  enableFiltering = true,
  isMinimized
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<CommunicationStats>(generateMockStats());
  const [filter, setFilter] = useState<{
    type: string;
    priority: string;
    search: string;
  }>({
    type: 'all',
    priority: 'all',
    search: ''
  });
  const [isConnected, setIsConnected] = useState(true);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainer = useRef<HTMLDivElement>(null);

  // Initialize and update logs
  useEffect(() => {
    const initialLogs = externalLogs || generateMockLogs();
    setLogs(initialLogs.slice(-maxLogEntries));
  }, [externalLogs, maxLogEntries]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Filter logs
  useEffect(() => {
    let filtered = logs;
    
    if (filter.type !== 'all') {
      filtered = filtered.filter(log => log.type === filter.type);
    }
    
    if (filter.priority !== 'all') {
      filtered = filtered.filter(log => log.priority === filter.priority);
    }
    
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        log.source.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredLogs(filtered);
  }, [logs, filter]);

  // Add new log entry
  const addLogEntry = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newEntry: LogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: Date.now()
    };
    
    setLogs(prev => [...prev.slice(-(maxLogEntries - 1)), newEntry]);
  }, [maxLogEntries]);

  // Handle command sending
  const handleSendCommand = useCallback((command: string) => {
    // Add command to logs
    addLogEntry({
      type: 'user',
      source: 'operator',
      message: `Command sent: ${command}`,
      priority: 'normal',
      acknowledged: true
    });
    
    // Call external handler if provided
    onSendCommand?.(command);
    
    // Simulate command response (in real app, this would come from the rover)
    setTimeout(() => {
      addLogEntry({
        type: 'system',
        source: 'rover',
        message: `Command acknowledged: ${command}`,
        priority: 'normal',
        acknowledged: true
      });
    }, 100 + Math.random() * 500);
  }, [addLogEntry, onSendCommand]);

  // Acknowledge log entry
  const acknowledgeLogEntry = useCallback((logId: string) => {
    setLogs(prev => prev.map(log =>
      log.id === logId ? { ...log, acknowledged: true } : log
    ));
  }, []);

  // Update stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(generateMockStats());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  if (isMinimized) {
    return (
      <div className="communication-panel-minimized">
        <div className="mini-stats">
          <div className={`connection-indicator ${stats.connectionQuality}`} />
          <span>{stats.totalMessages} messages</span>
          <span>{stats.messagesPerMinute.toFixed(1)}/min</span>
        </div>
      </div>
    );
  }

  const unacknowledgedCount = logs.filter(log => 
    !log.acknowledged && (log.priority === 'high' || log.priority === 'critical')
  ).length;

  return (
    <div className="communication-panel">
      {/* Header with stats */}
      {showStats && (
        <div className="communication-header">
          <StatsDisplay stats={stats} />
          {unacknowledgedCount > 0 && (
            <div className="unacknowledged-count">
              <span className="count-badge">{unacknowledgedCount}</span>
              <span>Need Attention</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {enableFiltering && (
        <div className="log-filters">
          <div className="filter-group">
            <label>Type:</label>
            <select
              value={filter.type}
              onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="all">All</option>
              <option value="system">System</option>
              <option value="command">Command</option>
              <option value="telemetry">Telemetry</option>
              <option value="user">User</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Priority:</label>
            <select
              value={filter.priority}
              onChange={(e) => setFilter(prev => ({ ...prev, priority: e.target.value }))}
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
          
          <div className="filter-group search-group">
            <input
              type="text"
              placeholder="Search logs..."
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
              className="search-input"
            />
          </div>
        </div>
      )}

      {/* Logs display */}
      <div className="logs-container" ref={logsContainer}>
        <div className="logs-list">
          {filteredLogs.length === 0 ? (
            <div className="no-logs">
              <div className="no-logs-icon">📝</div>
              <div>No logs match the current filter</div>
            </div>
          ) : (
            filteredLogs.map(log => (
              <LogEntryComponent
                key={log.id}
                entry={log}
                onAcknowledge={acknowledgeLogEntry}
              />
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Command input */}
      <CommandInput
        onSendCommand={handleSendCommand}
        disabled={!isConnected}
      />
    </div>
  );
};

export default CommunicationPanel;
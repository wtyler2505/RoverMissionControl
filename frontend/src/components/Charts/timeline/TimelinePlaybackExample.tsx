/**
 * TimelinePlaybackExample Component
 * Demonstrates the TimelinePlaybackControls component with realistic rover mission data
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  Divider,
  useTheme
} from '@mui/material';
import { addSeconds, addMinutes, addHours, format } from 'date-fns';
import { TimelineChart } from './TimelineChart';
import { TimelinePlaybackControls } from './TimelinePlaybackControls';
import { ChartThemeProvider } from '../base/ChartThemeProvider';
import type {
  GanttTask,
  MissionEvent,
  PlaybackSpeed,
  StepInterval,
  TimeFormat
} from './types';

// Sample mission data
const generateSampleMissionData = () => {
  const now = new Date();
  const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  const endTime = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours from now
  
  const tasks: GanttTask[] = [
    {
      id: 'nav-001',
      name: 'Navigation to Site Alpha',
      startDate: startTime,
      endDate: addMinutes(startTime, 45),
      progress: 100,
      status: 'completed',
      priority: 'high',
      category: 'navigation'
    },
    {
      id: 'drill-001',
      name: 'Drill Sample Collection',
      startDate: addMinutes(startTime, 50),
      endDate: addMinutes(startTime, 125),
      progress: 75,
      status: 'in-progress',
      priority: 'critical',
      category: 'science',
      dependencies: ['nav-001']
    },
    {
      id: 'ana-001',
      name: 'Sample Analysis',
      startDate: addMinutes(startTime, 130),
      endDate: addMinutes(startTime, 200),
      progress: 0,
      status: 'pending',
      priority: 'medium',
      category: 'science',
      dependencies: ['drill-001']
    },
    {
      id: 'nav-002',
      name: 'Navigation to Site Beta',
      startDate: addMinutes(startTime, 205),
      endDate: addMinutes(startTime, 260),
      progress: 0,
      status: 'pending',
      priority: 'medium',
      category: 'navigation',
      dependencies: ['ana-001']
    },
    {
      id: 'img-001',
      name: 'High-Resolution Imaging',
      startDate: addMinutes(startTime, 265),
      endDate: addMinutes(startTime, 320),
      progress: 0,
      status: 'pending',
      priority: 'low',
      category: 'imaging',
      dependencies: ['nav-002']
    }
  ];
  
  const events: MissionEvent[] = [
    {
      id: 'evt-001',
      timestamp: addMinutes(startTime, 15),
      type: 'milestone',
      severity: 'info',
      title: 'Mission Start',
      description: 'Rover mission commenced successfully'
    },
    {
      id: 'evt-002',
      timestamp: addMinutes(startTime, 45),
      type: 'milestone',
      severity: 'info',
      title: 'Reached Site Alpha',
      description: 'Navigation to first target completed'
    },
    {
      id: 'evt-003',
      timestamp: addMinutes(startTime, 85),
      type: 'alert',
      severity: 'warning',
      title: 'Drill Temperature Alert',
      description: 'Drill temperature elevated, reducing speed'
    },
    {
      id: 'evt-004',
      timestamp: addMinutes(startTime, 100),
      type: 'command',
      severity: 'info',
      title: 'Telemetry Adjustment',
      description: 'Updated telemetry transmission frequency'
    }
  ];
  
  return { tasks, events, startTime, endTime };
};

// Custom playback speeds for rover missions
const ROVER_PLAYBACK_SPEEDS: PlaybackSpeed[] = [
  { value: 0.1, label: '0.1x' },
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x (Real-time)' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
  { value: 10, label: '10x' },
  { value: 30, label: '30x' }
];

// Step intervals for mission control
const MISSION_STEP_INTERVALS: StepInterval[] = [
  { value: 30, unit: 'seconds', label: '30s' },
  { value: 1, unit: 'minutes', label: '1m' },
  { value: 5, unit: 'minutes', label: '5m' },
  { value: 15, unit: 'minutes', label: '15m' },
  { value: 1, unit: 'hours', label: '1h' }
];

// Time formats for mission display
const MISSION_TIME_FORMATS: TimeFormat[] = [
  { 
    value: 'HH:mm:ss', 
    label: 'Mission Time', 
    formatter: (date: Date) => format(date, 'HH:mm:ss') 
  },
  { 
    value: 'MMM dd HH:mm', 
    label: 'Date & Time', 
    formatter: (date: Date) => format(date, 'MMM dd HH:mm') 
  },
  { 
    value: 'yyyy-MM-dd HH:mm:ss', 
    label: 'Full Timestamp', 
    formatter: (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss') 
  },
  {
    value: 'relative',
    label: 'Mission Elapsed',
    formatter: (date: Date) => {
      const elapsed = Math.floor((date.getTime() - generateSampleMissionData().startTime.getTime()) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      return `T+${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }
];

export const TimelinePlaybackExample: React.FC = () => {
  const theme = useTheme();
  const { tasks, events, startTime, endTime } = useMemo(() => generateSampleMissionData(), []);
  
  // Playback state
  const [currentTime, setCurrentTime] = useState(new Date(startTime.getTime() + 30 * 60 * 1000)); // Start 30 minutes in
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Configuration state
  const [showMiniTimeline, setShowMiniTimeline] = useState(true);
  const [showSpeedSelector, setShowSpeedSelector] = useState(true);
  const [showStepControls, setShowStepControls] = useState(true);
  const [showJumpControls, setShowJumpControls] = useState(true);
  const [enableKeyboardShortcuts, setEnableKeyboardShortcuts] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [showTooltips, setShowTooltips] = useState(true);
  
  // Convert tasks to timeline format for mini timeline
  const timelineTasks = useMemo(() => 
    tasks.map(task => ({
      id: task.id,
      startTime: task.startDate,
      endTime: task.endDate,
      color: task.priority === 'critical' ? theme.palette.error.main :
             task.priority === 'high' ? theme.palette.warning.main :
             task.priority === 'medium' ? theme.palette.info.main :
             theme.palette.success.main,
      priority: task.priority
    })), 
    [tasks, theme]
  );
  
  // Playback animation effect
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = new Date(prev.getTime() + (1000 * playbackSpeed));
        
        // Auto-pause at end
        if (newTime >= endTime) {
          setIsPlaying(false);
          return endTime;
        }
        
        return newTime;
      });
    }, 100); // Update every 100ms for smooth animation
    
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, endTime]);
  
  // Event handlers
  const handlePlay = useCallback(() => {
    if (currentTime >= endTime) {
      setCurrentTime(startTime);
    }
    setIsPlaying(true);
  }, [currentTime, endTime, startTime]);
  
  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);
  
  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(startTime);
  }, [startTime]);
  
  const handleTimeChange = useCallback((time: Date) => {
    setCurrentTime(time);
  }, []);
  
  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);
  
  const handleStepForward = useCallback((interval: StepInterval) => {
    setCurrentTime(prev => {
      const newTime = interval.unit === 'seconds' ? addSeconds(prev, interval.value) :
                     interval.unit === 'minutes' ? addMinutes(prev, interval.value) :
                     interval.unit === 'hours' ? addHours(prev, interval.value) :
                     new Date(prev.getTime() + interval.value * 24 * 60 * 60 * 1000);
      
      return newTime > endTime ? endTime : newTime;
    });
  }, [endTime]);
  
  const handleStepBackward = useCallback((interval: StepInterval) => {
    setCurrentTime(prev => {
      const newTime = interval.unit === 'seconds' ? addSeconds(prev, -interval.value) :
                     interval.unit === 'minutes' ? addMinutes(prev, -interval.value) :
                     interval.unit === 'hours' ? addHours(prev, -interval.value) :
                     new Date(prev.getTime() - interval.value * 24 * 60 * 60 * 1000);
      
      return newTime < startTime ? startTime : newTime;
    });
  }, [startTime]);
  
  const handleJumpToStart = useCallback(() => {
    setCurrentTime(startTime);
    setIsPlaying(false);
  }, [startTime]);
  
  const handleJumpToEnd = useCallback(() => {
    setCurrentTime(endTime);
    setIsPlaying(false);
  }, [endTime]);
  
  // Get current mission status
  const currentTask = tasks.find(task => 
    currentTime >= task.startDate && currentTime <= task.endDate
  );
  
  const upcomingEvents = events.filter(event => 
    event.timestamp > currentTime && 
    event.timestamp <= new Date(currentTime.getTime() + 30 * 60 * 1000) // Next 30 minutes
  );
  
  return (
    <ChartThemeProvider>
      <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto' }}>
        <Typography variant="h4" gutterBottom color="primary">
          Rover Mission Timeline Playback Demo
        </Typography>
        
        <Typography variant="body1" color="textSecondary" paragraph>
          This demo showcases the TimelinePlaybackControls component with realistic rover mission data.
          Use the controls below to navigate through the mission timeline.
        </Typography>
        
        <Grid container spacing={3}>
          {/* Main Timeline Chart */}
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Mission Timeline
              </Typography>
              
              <TimelineChart
                tasks={tasks}
                events={events}
                startDate={startTime}
                endDate={endTime}
                currentTime={currentTime}
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                onTimeChange={handleTimeChange}
                onPlaybackToggle={() => isPlaying ? handlePause() : handlePlay()}
                width={1200}
                height={400}
                margin={{ top: 40, right: 40, bottom: 60, left: 200 }}
              />
            </Paper>
          </Grid>
          
          {/* Playback Controls */}
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Playback Controls
              </Typography>
              
              <TimelinePlaybackControls
                startTime={startTime}
                endTime={endTime}
                currentTime={currentTime}
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                onPlay={handlePlay}
                onPause={handlePause}
                onStop={handleStop}
                onTimeChange={handleTimeChange}
                onSpeedChange={handleSpeedChange}
                onStepForward={handleStepForward}
                onStepBackward={handleStepBackward}
                onJumpToStart={handleJumpToStart}
                onJumpToEnd={handleJumpToEnd}
                availableSpeeds={ROVER_PLAYBACK_SPEEDS}
                stepIntervals={MISSION_STEP_INTERVALS}
                timeFormats={MISSION_TIME_FORMATS}
                defaultTimeFormat="relative"
                showMiniTimeline={showMiniTimeline}
                showSpeedSelector={showSpeedSelector}
                showStepControls={showStepControls}
                showJumpControls={showJumpControls}
                showTooltips={showTooltips}
                compactMode={compactMode}
                enableKeyboardShortcuts={enableKeyboardShortcuts}
                timelineTasks={timelineTasks}
                ariaLabel="Rover mission timeline playback controls"
              />
            </Paper>
          </Grid>
          
          {/* Mission Status */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  Current Mission Status
                </Typography>
                
                <Typography variant="body2" color="textSecondary">
                  Current Time: {format(currentTime, 'yyyy-MM-dd HH:mm:ss')}
                </Typography>
                
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Mission Elapsed: T+{Math.floor((currentTime.getTime() - startTime.getTime()) / (60 * 1000))} minutes
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                {currentTask ? (
                  <Box>
                    <Typography variant="subtitle1" color="success.main">
                      🤖 Active Task: {currentTask.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Progress: {currentTask.progress}% | Priority: {currentTask.priority}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Status: {currentTask.status}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No active task at current time
                  </Typography>
                )}
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle2" gutterBottom>
                  Upcoming Events:
                </Typography>
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map(event => (
                    <Typography key={event.id} variant="body2" color="warning.main">
                      ⚠️ {format(event.timestamp, 'HH:mm')} - {event.title}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No upcoming events in next 30 minutes
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Configuration Panel */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  Control Configuration
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showMiniTimeline}
                          onChange={(e) => setShowMiniTimeline(e.target.checked)}
                        />
                      }
                      label="Mini Timeline"
                    />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showSpeedSelector}
                          onChange={(e) => setShowSpeedSelector(e.target.checked)}
                        />
                      }
                      label="Speed Selector"
                    />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showStepControls}
                          onChange={(e) => setShowStepControls(e.target.checked)}
                        />
                      }
                      label="Step Controls"
                    />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showJumpControls}
                          onChange={(e) => setShowJumpControls(e.target.checked)}
                        />
                      }
                      label="Jump Controls"
                    />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={enableKeyboardShortcuts}
                          onChange={(e) => setEnableKeyboardShortcuts(e.target.checked)}
                        />
                      }
                      label="Keyboard Shortcuts"
                    />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={compactMode}
                          onChange={(e) => setCompactMode(e.target.checked)}
                        />
                      }
                      label="Compact Mode"
                    />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showTooltips}
                          onChange={(e) => setShowTooltips(e.target.checked)}
                        />
                      }
                      label="Show Tooltips"
                    />
                  </Grid>
                </Grid>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle2" gutterBottom>
                  Keyboard Shortcuts:
                </Typography>
                <Typography variant="body2" color="textSecondary" component="div">
                  • Space: Play/Pause<br />
                  • S: Stop<br />
                  • ← →: Step backward/forward<br />
                  • Home/End: Jump to start/end<br />
                  • 1-8: Change playback speed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </ChartThemeProvider>
  );
};

export default TimelinePlaybackExample;
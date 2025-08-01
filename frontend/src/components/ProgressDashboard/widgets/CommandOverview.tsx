/**
 * Command Overview Widget
 * 
 * Displays all active commands with their progress status in a grid layout
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  useTheme,
  alpha,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Menu,
  MenuItem
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon
} from '@mui/icons-material';
import { EnhancedProgress, ProgressStep } from '../../../types/progress-tracking.types';
import { CommandProgressIndicator } from '../../CommandAcknowledgment/CommandProgressIndicator';
import { formatDuration } from '../../../utils/time.utils';

interface CommandOverviewProps {
  progressMap: Map<string, EnhancedProgress>;
  onCommandClick?: (commandId: string) => void;
  maxVisible?: number;
  showCompleted?: boolean;
}

interface CommandCardProps {
  progress: EnhancedProgress;
  onClick?: () => void;
}

const CommandCard: React.FC<CommandCardProps> = ({ progress, onClick }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const activeStep = useMemo(() => {
    return progress.steps.find(step => step.status === 'active');
  }, [progress.steps]);

  const getStatusColor = () => {
    if (progress.overallProgress >= 1) return theme.palette.success.main;
    if (progress.errorRate > 0) return theme.palette.error.main;
    if (progress.isStalled) return theme.palette.warning.main;
    return theme.palette.primary.main;
  };

  const getStatusIcon = () => {
    if (progress.overallProgress >= 1) return <CheckIcon />;
    if (progress.errorRate > 0) return <ErrorIcon />;
    if (progress.isStalled) return <WarningIcon />;
    return <SpeedIcon />;
  };

  const getStatusText = () => {
    if (progress.overallProgress >= 1) return 'Completed';
    if (progress.errorRate > 0) return 'Error';
    if (progress.isStalled) return 'Stalled';
    if (activeStep) return activeStep.name;
    return 'Pending';
  };

  const getElapsedTime = () => {
    const elapsed = Date.now() - progress.startedAt.getTime();
    return formatDuration(elapsed);
  };

  const getEstimatedTimeRemaining = () => {
    if (!progress.estimatedCompletionTime) return null;
    const remaining = progress.estimatedCompletionTime.getTime() - Date.now();
    if (remaining <= 0) return 'Overdue';
    return formatDuration(remaining);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const renderStepItem = (step: ProgressStep) => {
    const getStepIcon = () => {
      switch (step.status) {
        case 'completed':
          return <CheckIcon fontSize="small" color="success" />;
        case 'error':
          return <ErrorIcon fontSize="small" color="error" />;
        case 'active':
          return <RefreshIcon fontSize="small" color="primary" sx={{ animation: 'spin 2s linear infinite' }} />;
        case 'skipped':
          return <span style={{ fontSize: '0.75rem' }}>—</span>;
        default:
          return <span style={{ fontSize: '0.75rem' }}>○</span>;
      }
    };

    return (
      <ListItem key={step.id} dense sx={{ py: 0.5 }}>
        <ListItemIcon sx={{ minWidth: 32 }}>
          {getStepIcon()}
        </ListItemIcon>
        <ListItemText 
          primary={step.name}
          secondary={
            step.status === 'active' && (
              <LinearProgress 
                variant="determinate" 
                value={step.progress * 100} 
                sx={{ mt: 0.5, height: 2 }}
              />
            )
          }
          primaryTypographyProps={{ variant: 'body2' }}
        />
        {step.duration && (
          <Typography variant="caption" color="text.secondary">
            {formatDuration(step.duration)}
          </Typography>
        )}
      </ListItem>
    );
  };

  return (
    <Card 
      sx={{ 
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        borderLeft: `4px solid ${getStatusColor()}`,
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: 4
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <Avatar 
            sx={{ 
              width: 32, 
              height: 32, 
              bgcolor: alpha(getStatusColor(), 0.1),
              color: getStatusColor(),
              mr: 1
            }}
          >
            {getStatusIcon()}
          </Avatar>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" noWrap>
              {progress.commandId}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {getStatusText()}
            </Typography>
          </Box>

          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Progress
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {Math.round(progress.overallProgress * 100)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress.overallProgress * 100}
            sx={{ 
              height: 6, 
              borderRadius: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                bgcolor: getStatusColor()
              }
            }}
          />
        </Box>

        {/* Metrics */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            icon={<TimelineIcon />}
            label={getElapsedTime()}
            size="small"
            variant="outlined"
          />
          {getEstimatedTimeRemaining() && (
            <Chip 
              label={`ETA: ${getEstimatedTimeRemaining()}`}
              size="small"
              variant="outlined"
              color={getEstimatedTimeRemaining() === 'Overdue' ? 'error' : 'default'}
            />
          )}
          {progress.retryCount > 0 && (
            <Chip 
              label={`Retries: ${progress.retryCount}`}
              size="small"
              color="warning"
              variant="outlined"
            />
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ pt: 0, px: 2, pb: 1 }}>
        <Button
          size="small"
          startIcon={expanded ? <CollapseIcon /> : <ExpandIcon />}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? 'Hide' : 'Show'} Steps
        </Button>
      </CardActions>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          <List dense disablePadding>
            {progress.steps.map(renderStepItem)}
          </List>
        </Box>
      </Collapse>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <TimelineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Timeline</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <RefreshIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Retry Command</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <CancelIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Cancel Command</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
};

export const CommandOverview: React.FC<CommandOverviewProps> = ({
  progressMap,
  onCommandClick,
  maxVisible = 12,
  showCompleted = false
}) => {
  const theme = useTheme();
  const [showAll, setShowAll] = useState(false);

  const filteredCommands = useMemo(() => {
    const commands = Array.from(progressMap.values());
    
    // Filter out completed if needed
    const filtered = showCompleted 
      ? commands 
      : commands.filter(p => p.overallProgress < 1);

    // Sort by priority: errors first, then stalled, then active, then by start time
    return filtered.sort((a, b) => {
      if (a.errorRate > 0 && b.errorRate === 0) return -1;
      if (a.errorRate === 0 && b.errorRate > 0) return 1;
      if (a.isStalled && !b.isStalled) return -1;
      if (!a.isStalled && b.isStalled) return 1;
      return b.startedAt.getTime() - a.startedAt.getTime();
    });
  }, [progressMap, showCompleted]);

  const visibleCommands = showAll 
    ? filteredCommands 
    : filteredCommands.slice(0, maxVisible);

  if (filteredCommands.length === 0) {
    return (
      <Box 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Typography variant="h6" color="text.secondary">
          No active commands
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Commands will appear here when they are executed
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Active Commands
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {filteredCommands.length} total
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Grid container spacing={2}>
          {visibleCommands.map(progress => (
            <Grid item xs={12} sm={6} md={4} key={progress.commandId}>
              <CommandCard 
                progress={progress}
                onClick={onCommandClick ? () => onCommandClick(progress.commandId) : undefined}
              />
            </Grid>
          ))}
        </Grid>

        {filteredCommands.length > maxVisible && !showAll && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button 
              onClick={() => setShowAll(true)}
              variant="outlined"
              size="small"
            >
              Show All ({filteredCommands.length - maxVisible} more)
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};
/**
 * Notification Feed Widget
 * 
 * Displays real-time notifications with actions and filtering
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Fade,
  Alert,
  Button,
  Menu,
  MenuItem,
  Badge,
  Divider,
  alpha,
  useTheme
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  MoreVert as MoreIcon,
  Visibility as ReadIcon,
  Delete as DeleteIcon,
  NotificationsOff as MuteIcon,
  Replay as RetryIcon,
  Cancel as CancelIcon,
  OpenInNew as ViewDetailsIcon
} from '@mui/icons-material';
import { 
  ProgressNotification, 
  NotificationAction,
  getSeverityColor 
} from '../../../types/progress-tracking.types';
import { formatRelativeTime } from '../../../utils/time.utils';

interface NotificationFeedProps {
  notifications: ProgressNotification[];
  onRead?: (notificationId: string) => void;
  onAction?: (notificationId: string, action: NotificationAction) => void;
  onDelete?: (notificationId: string) => void;
  maxVisible?: number;
}

interface NotificationItemProps {
  notification: ProgressNotification;
  onRead?: () => void;
  onAction?: (action: NotificationAction) => void;
  onDelete?: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRead,
  onAction,
  onDelete
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const getIcon = () => {
    switch (notification.type) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'success':
        return <SuccessIcon color="success" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getSeverityChip = () => {
    return (
      <Chip
        label={notification.severity}
        size="small"
        sx={{
          bgcolor: alpha(getSeverityColor(notification.severity), 0.1),
          color: getSeverityColor(notification.severity),
          fontWeight: 'medium',
          fontSize: '0.7rem'
        }}
      />
    );
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleActionClick = (action: NotificationAction) => {
    if (action.customHandler) {
      action.customHandler();
    } else if (onAction) {
      onAction(action);
    }
  };

  useEffect(() => {
    if (notification.autoHide && !notification.read && notification.autoHideDelay) {
      const timer = setTimeout(() => {
        if (onRead) onRead();
      }, notification.autoHideDelay);
      
      return () => clearTimeout(timer);
    }
  }, [notification, onRead]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'retry':
        return <RetryIcon fontSize="small" />;
      case 'cancel':
        return <CancelIcon fontSize="small" />;
      case 'view_details':
        return <ViewDetailsIcon fontSize="small" />;
      default:
        return null;
    }
  };

  return (
    <Fade in timeout={300}>
      <ListItem
        sx={{
          bgcolor: notification.read 
            ? 'transparent' 
            : alpha(theme.palette.primary.main, 0.05),
          borderRadius: 1,
          mb: 1,
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.08)
          }
        }}
        onClick={() => onRead && !notification.read && onRead()}
      >
        <ListItemIcon>
          <Badge 
            variant="dot" 
            color="primary" 
            invisible={notification.read}
          >
            {getIcon()}
          </Badge>
        </ListItemIcon>

        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" sx={{ flex: 1 }}>
                {notification.title}
              </Typography>
              {getSeverityChip()}
              <Typography variant="caption" color="text.secondary">
                {formatRelativeTime(notification.timestamp)}
              </Typography>
            </Box>
          }
          secondary={
            <>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {notification.message}
              </Typography>
              
              {notification.commandId && (
                <Chip
                  label={`Command: ${notification.commandId}`}
                  size="small"
                  variant="outlined"
                  sx={{ mt: 1, fontSize: '0.7rem' }}
                />
              )}
              
              {notification.actionable && notification.actions && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  {notification.actions.map(action => (
                    <Button
                      key={action.id}
                      size="small"
                      variant={action.style === 'primary' ? 'contained' : 'outlined'}
                      color={action.style === 'danger' ? 'error' : 'primary'}
                      startIcon={getActionIcon(action.action)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActionClick(action);
                      }}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </Box>
              )}
            </>
          }
        />

        <ListItemSecondaryAction>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreIcon fontSize="small" />
          </IconButton>
        </ListItemSecondaryAction>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          {!notification.read && onRead && (
            <MenuItem onClick={() => {
              onRead();
              handleMenuClose();
            }}>
              <ListItemIcon>
                <ReadIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Mark as Read</ListItemText>
            </MenuItem>
          )}
          
          {notification.commandId && (
            <MenuItem onClick={handleMenuClose}>
              <ListItemIcon>
                <ViewDetailsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>View Command Details</ListItemText>
            </MenuItem>
          )}
          
          <MenuItem onClick={handleMenuClose}>
            <ListItemIcon>
              <MuteIcon fontSize="small" />
              </ListItemIcon>
            <ListItemText>Mute Similar</ListItemText>
          </MenuItem>
          
          <Divider />
          
          {onDelete && (
            <MenuItem onClick={() => {
              onDelete();
              handleMenuClose();
            }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          )}
        </Menu>
      </ListItem>
    </Fade>
  );
};

export const NotificationFeed: React.FC<NotificationFeedProps> = ({
  notifications,
  onRead,
  onAction,
  onDelete,
  maxVisible = 50
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query) ||
        n.commandId?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (typeFilter.length > 0) {
      filtered = filtered.filter(n => typeFilter.includes(n.type));
    }

    // Severity filter
    if (severityFilter.length > 0) {
      filtered = filtered.filter(n => severityFilter.includes(n.severity));
    }

    // Unread filter
    if (showUnreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }

    return filtered.slice(0, maxVisible);
  }, [notifications, searchQuery, typeFilter, severityFilter, showUnreadOnly, maxVisible]);

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length,
    [notifications]
  );

  const handleMarkAllRead = () => {
    notifications.forEach(n => {
      if (!n.read && onRead) {
        onRead(n.id);
      }
    });
  };

  const handleClearAll = () => {
    if (onDelete) {
      notifications.forEach(n => onDelete(n.id));
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Notifications
          </Typography>
          
          {unreadCount > 0 && (
            <Chip 
              label={`${unreadCount} unread`}
              color="primary"
              size="small"
              sx={{ mr: 1 }}
            />
          )}
          
          <Button
            size="small"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            sx={{ mr: 1 }}
          >
            Mark All Read
          </Button>
          
          <Button
            size="small"
            onClick={handleClearAll}
            disabled={notifications.length === 0}
            color="error"
          >
            Clear All
          </Button>
        </Box>

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search notifications..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Type
            </Typography>
            <ToggleButtonGroup
              value={typeFilter}
              onChange={(_, newValue) => setTypeFilter(newValue || [])}
              size="small"
              multiple
            >
              <ToggleButton value="error">
                <ErrorIcon fontSize="small" sx={{ mr: 0.5 }} />
                Error
              </ToggleButton>
              <ToggleButton value="warning">
                <WarningIcon fontSize="small" sx={{ mr: 0.5 }} />
                Warning
              </ToggleButton>
              <ToggleButton value="info">
                <InfoIcon fontSize="small" sx={{ mr: 0.5 }} />
                Info
              </ToggleButton>
              <ToggleButton value="success">
                <SuccessIcon fontSize="small" sx={{ mr: 0.5 }} />
                Success
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Severity
            </Typography>
            <ToggleButtonGroup
              value={severityFilter}
              onChange={(_, newValue) => setSeverityFilter(newValue || [])}
              size="small"
              multiple
            >
              <ToggleButton value="critical">Critical</ToggleButton>
              <ToggleButton value="high">High</ToggleButton>
              <ToggleButton value="medium">Medium</ToggleButton>
              <ToggleButton value="low">Low</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
            <ToggleButton
              value="unread"
              selected={showUnreadOnly}
              onChange={() => setShowUnreadOnly(!showUnreadOnly)}
              size="small"
            >
              Unread Only
            </ToggleButton>
          </Box>
        </Box>
      </Box>

      {/* Notification List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {filteredNotifications.length === 0 ? (
          <Alert severity="info">
            No notifications match your filters
          </Alert>
        ) : (
          <List disablePadding>
            {filteredNotifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={() => onRead?.(notification.id)}
                onAction={(action) => onAction?.(notification.id, action)}
                onDelete={() => onDelete?.(notification.id)}
              />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};
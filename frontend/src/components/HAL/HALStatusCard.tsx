import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Badge,
  useTheme,
  alpha,
} from '@mui/material';
import {
  MoreVert,
  PowerSettingsNew,
  Refresh,
  BugReport,
  SystemUpdate,
  Info,
  Delete,
  Settings,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  HourglassEmpty,
  Cloud,
  Wifi,
  Bluetooth,
  Cable,
  Memory,
  Router,
} from '@mui/icons-material';
import { HALDevice } from './types';

interface HALStatusCardProps {
  device: HALDevice;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onRunDiagnostics?: () => void;
  onCheckFirmware?: () => void;
  onRemove?: () => void;
  onSettings?: () => void;
  firmwareProgress?: number;
  compact?: boolean;
}

export const HALStatusCard: React.FC<HALStatusCardProps> = ({
  device,
  onConnect,
  onDisconnect,
  onRunDiagnostics,
  onCheckFirmware,
  onRemove,
  onSettings,
  firmwareProgress,
  compact = false,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getStatusColor = () => {
    switch (device.status) {
      case 'connected':
        return theme.palette.success.main;
      case 'disconnected':
        return theme.palette.text.disabled;
      case 'error':
        return theme.palette.error.main;
      case 'updating':
        return theme.palette.info.main;
      case 'simulated':
        return theme.palette.warning.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  const getStatusIcon = () => {
    switch (device.status) {
      case 'connected':
        return <CheckCircle />;
      case 'disconnected':
        return <PowerSettingsNew />;
      case 'error':
        return <ErrorIcon />;
      case 'updating':
        return <HourglassEmpty />;
      case 'simulated':
        return <Cloud />;
      default:
        return <Info />;
    }
  };

  const getProtocolIcon = () => {
    switch (device.protocol) {
      case 'wifi':
        return <Wifi />;
      case 'bluetooth':
        return <Bluetooth />;
      case 'ethernet':
        return <Cable />;
      case 'serial':
      case 'usb':
        return <Cable />;
      case 'i2c':
      case 'spi':
        return <Memory />;
      case 'can':
        return <Router />;
      default:
        return <Settings />;
    }
  };

  const getHealthColor = () => {
    switch (device.health.status) {
      case 'healthy':
        return theme.palette.success.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'critical':
        return theme.palette.error.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  const getHealthIcon = () => {
    switch (device.health.status) {
      case 'healthy':
        return <CheckCircle sx={{ fontSize: 16 }} />;
      case 'warning':
        return <Warning sx={{ fontSize: 16 }} />;
      case 'critical':
        return <ErrorIcon sx={{ fontSize: 16 }} />;
      default:
        return null;
    }
  };

  const isConnected = device.status === 'connected';
  const isUpdating = device.status === 'updating';
  const hasIssues = device.health.issues.filter(i => !i.resolved).length > 0;

  return (
    <Card
      sx={{
        position: 'relative',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4],
        },
        ...(device.isSimulated && {
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.warning.main,
            0.05
          )} 0%, transparent 100%)`,
        }),
      }}
    >
      {/* Status Indicator Bar */}
      <Box
        sx={{
          height: 4,
          bgcolor: getStatusColor(),
          borderRadius: '4px 4px 0 0',
        }}
      />

      {/* Firmware Update Progress */}
      {isUpdating && firmwareProgress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={firmwareProgress}
          sx={{
            position: 'absolute',
            top: 4,
            left: 0,
            right: 0,
            height: 4,
          }}
        />
      )}

      <CardContent sx={{ pb: compact ? 1 : 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          {/* Device Icon */}
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              <Avatar
                sx={{
                  width: 20,
                  height: 20,
                  bgcolor: theme.palette.background.paper,
                  border: `2px solid ${theme.palette.background.paper}`,
                }}
              >
                {getProtocolIcon()}
              </Avatar>
            }
          >
            <Avatar
              sx={{
                bgcolor: alpha(getStatusColor(), 0.1),
                color: getStatusColor(),
                width: 48,
                height: 48,
              }}
            >
              {getStatusIcon()}
            </Avatar>
          </Badge>

          {/* Device Info */}
          <Box sx={{ ml: 2, flexGrow: 1 }}>
            <Typography variant="h6" gutterBottom>
              {device.name}
              {device.isSimulated && (
                <Chip
                  label="SIM"
                  size="small"
                  sx={{ ml: 1 }}
                  color="warning"
                />
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {device.type.charAt(0).toUpperCase() + device.type.slice(1)} •{' '}
              {device.protocol.toUpperCase()}
              {device.address && ` • ${device.address}`}
              {device.port && `:${device.port}`}
            </Typography>

            {/* Health Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Chip
                icon={getHealthIcon()}
                label={`Health: ${device.health.status}`}
                size="small"
                sx={{
                  bgcolor: alpha(getHealthColor(), 0.1),
                  color: getHealthColor(),
                  fontWeight: 'medium',
                }}
              />
              {hasIssues && (
                <Chip
                  label={`${device.health.issues.filter(i => !i.resolved).length} issues`}
                  size="small"
                  color="error"
                  variant="outlined"
                />
              )}
              {device.firmwareVersion && (
                <Chip
                  label={`v${device.firmwareVersion}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>

          {/* Menu Button */}
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVert />
          </IconButton>
        </Box>

        {/* Capabilities Summary */}
        {!compact && device.capabilities.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Capabilities:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {device.capabilities.slice(0, 5).map((cap) => (
                <Chip
                  key={cap.id}
                  label={cap.name}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
              ))}
              {device.capabilities.length > 5 && (
                <Chip
                  label={`+${device.capabilities.length - 5} more`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
              )}
            </Box>
          </Box>
        )}

        {/* Health Metrics */}
        {!compact && device.health.metrics.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Metrics:
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
              {device.health.metrics.slice(0, 3).map((metric) => (
                <Box key={metric.name}>
                  <Typography variant="caption" color="text.secondary">
                    {metric.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color:
                        metric.status === 'critical'
                          ? theme.palette.error.main
                          : metric.status === 'warning'
                          ? theme.palette.warning.main
                          : 'inherit',
                      fontWeight: 'medium',
                    }}
                  >
                    {metric.value}
                    {metric.unit && ` ${metric.unit}`}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Last Seen */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Last seen: {new Date(device.lastSeen).toLocaleString()}
        </Typography>
      </CardContent>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            isConnected ? onDisconnect?.() : onConnect?.();
          }}
          disabled={isUpdating}
        >
          <ListItemIcon>
            <PowerSettingsNew fontSize="small" />
          </ListItemIcon>
          <ListItemText>{isConnected ? 'Disconnect' : 'Connect'}</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleMenuClose();
            onRunDiagnostics?.();
          }}
          disabled={!isConnected || isUpdating}
        >
          <ListItemIcon>
            <BugReport fontSize="small" />
          </ListItemIcon>
          <ListItemText>Run Diagnostics</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleMenuClose();
            onCheckFirmware?.();
          }}
          disabled={!isConnected || isUpdating}
        >
          <ListItemIcon>
            <SystemUpdate fontSize="small" />
          </ListItemIcon>
          <ListItemText>Check Firmware</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleMenuClose();
            onSettings?.();
          }}
        >
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleMenuClose();
            onRemove?.();
          }}
          disabled={isConnected || isUpdating}
          sx={{ color: theme.palette.error.main }}
        >
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Remove Device</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
};

export default HALStatusCard;
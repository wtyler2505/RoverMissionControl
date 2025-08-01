/**
 * QuickActionsToolbar - Quick actions for mission-critical operations
 */

import React, { useState, useCallback } from 'react';
import {
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Badge,
  Box,
  alpha
} from '@mui/material';
import {
  Emergency,
  PowerOff,
  Navigation,
  Science,
  NightsStay,
  Build,
  Stop,
  PlayArrow,
  Home,
  Warning,
  Refresh,
  Save,
  BatteryAlert,
  ThermostatAuto,
  SignalCellularAlt,
  Close
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { QuickAction, DashboardContext, OPERATION_MODES } from '../../types/dashboardTemplates';

/**
 * Props for QuickActionsToolbar
 */
export interface QuickActionsToolbarProps {
  context: DashboardContext;
  onActionExecute: (actionId: string) => void | Promise<void>;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  enableHotkeys?: boolean;
}

/**
 * Styled components
 */
const StyledSpeedDial = styled(SpeedDial)<{ $position: string }>(({ theme, $position }) => {
  const positions = {
    'bottom-right': { bottom: 16, right: 16 },
    'bottom-left': { bottom: 16, left: 16 },
    'top-right': { top: 80, right: 16 }, // Account for app bar
    'top-left': { top: 80, left: 16 }
  };
  
  return {
    position: 'fixed',
    ...positions[$position],
    '& .MuiSpeedDial-fab': {
      backgroundColor: theme.palette.error.main,
      color: theme.palette.error.contrastText,
      
      '&:hover': {
        backgroundColor: theme.palette.error.dark
      }
    }
  };
});

const EmergencyBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    animation: 'pulse 1.5s infinite'
  },
  '@keyframes pulse': {
    '0%': {
      boxShadow: `0 0 0 0 ${alpha(theme.palette.error.main, 0.7)}`
    },
    '70%': {
      boxShadow: `0 0 0 10px ${alpha(theme.palette.error.main, 0)}`
    },
    '100%': {
      boxShadow: `0 0 0 0 ${alpha(theme.palette.error.main, 0)}`
    }
  }
}));

/**
 * Default quick actions
 */
const defaultQuickActions: QuickAction[] = [
  {
    id: 'emergency-stop',
    name: 'Emergency Stop',
    icon: <Stop />,
    description: 'Immediately halt all rover operations',
    category: 'safety',
    action: async () => {
      console.log('Executing emergency stop...');
      // Emergency stop implementation
    },
    confirmRequired: true,
    hotkey: 'Ctrl+Shift+S',
    enabledCondition: () => true
  },
  {
    id: 'safe-mode',
    name: 'Safe Mode',
    icon: <Warning />,
    description: 'Enter safe mode with minimal systems',
    category: 'safety',
    action: async () => {
      console.log('Entering safe mode...');
    },
    confirmRequired: true,
    hotkey: 'Ctrl+Shift+F',
    enabledCondition: (context) => context.missionPhase !== 'emergency'
  },
  {
    id: 'return-home',
    name: 'Return to Base',
    icon: <Home />,
    description: 'Navigate back to home position',
    category: 'navigation',
    action: async () => {
      console.log('Initiating return to base...');
    },
    confirmRequired: true,
    hotkey: 'Ctrl+H',
    enabledCondition: (context) => !context.anomaliesDetected
  },
  {
    id: 'low-power-mode',
    name: 'Low Power Mode',
    icon: <BatteryAlert />,
    description: 'Switch to power conservation mode',
    category: 'power',
    action: async () => {
      console.log('Switching to low power mode...');
    },
    hotkey: 'Ctrl+P',
    enabledCondition: (context) => {
      const batteryStatus = context.systemStatus['battery'];
      return batteryStatus === 'warning' || batteryStatus === 'critical';
    }
  },
  {
    id: 'night-mode',
    name: 'Night Operations',
    icon: <NightsStay />,
    description: 'Switch to night operation mode',
    category: 'power',
    action: async () => {
      console.log('Switching to night operations...');
    },
    hotkey: 'Ctrl+N',
    enabledCondition: () => {
      const hour = new Date().getHours();
      return hour >= 20 || hour <= 6;
    }
  },
  {
    id: 'science-mode',
    name: 'Science Mode',
    icon: <Science />,
    description: 'Optimize for science data collection',
    category: 'science',
    action: async () => {
      console.log('Entering science mode...');
    },
    hotkey: 'Ctrl+S',
    enabledCondition: (context) => context.missionPhase === 'operation'
  },
  {
    id: 'thermal-protection',
    name: 'Thermal Protection',
    icon: <ThermostatAuto />,
    description: 'Activate thermal protection systems',
    category: 'safety',
    action: async () => {
      console.log('Activating thermal protection...');
    },
    enabledCondition: (context) => {
      const thermalStatus = context.systemStatus['thermal'];
      return thermalStatus === 'warning' || thermalStatus === 'critical';
    }
  },
  {
    id: 'comm-boost',
    name: 'Boost Communication',
    icon: <SignalCellularAlt />,
    description: 'Maximize communication signal strength',
    category: 'communication',
    action: async () => {
      console.log('Boosting communication signal...');
    },
    enabledCondition: (context) => {
      const commStatus = context.systemStatus['communication'];
      return commStatus === 'warning';
    }
  },
  {
    id: 'maintenance-mode',
    name: 'Maintenance Mode',
    icon: <Build />,
    description: 'Enter maintenance and diagnostics mode',
    category: 'safety',
    action: async () => {
      console.log('Entering maintenance mode...');
    },
    hotkey: 'Ctrl+M',
    enabledCondition: (context) => context.missionPhase === 'maintenance'
  },
  {
    id: 'refresh-telemetry',
    name: 'Refresh Telemetry',
    icon: <Refresh />,
    description: 'Force refresh all telemetry streams',
    category: 'communication',
    action: async () => {
      console.log('Refreshing telemetry...');
    },
    hotkey: 'F5',
    enabledCondition: () => true
  }
];

/**
 * QuickActionsToolbar component
 */
export const QuickActionsToolbar: React.FC<QuickActionsToolbarProps> = ({
  context,
  onActionExecute,
  position = 'bottom-right',
  enableHotkeys = true
}) => {
  const [open, setOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: QuickAction | null;
  }>({ open: false, action: null });
  
  // Filter enabled actions
  const enabledActions = defaultQuickActions.filter(action => 
    !action.enabledCondition || action.enabledCondition(context)
  );
  
  // Count critical actions
  const criticalCount = enabledActions.filter(action => 
    action.category === 'safety' && 
    (context.missionPhase === 'emergency' || context.anomaliesDetected)
  ).length;
  
  // Handle action execution
  const handleAction = useCallback(async (action: QuickAction) => {
    if (action.confirmRequired) {
      setConfirmDialog({ open: true, action });
    } else {
      try {
        await action.action();
        onActionExecute(action.id);
      } catch (error) {
        console.error(`Failed to execute action ${action.id}:`, error);
      }
    }
    setOpen(false);
  }, [onActionExecute]);
  
  // Handle confirmation
  const handleConfirm = useCallback(async () => {
    if (confirmDialog.action) {
      try {
        await confirmDialog.action.action();
        onActionExecute(confirmDialog.action.id);
      } catch (error) {
        console.error(`Failed to execute action ${confirmDialog.action.id}:`, error);
      }
    }
    setConfirmDialog({ open: false, action: null });
  }, [confirmDialog.action, onActionExecute]);
  
  // Setup hotkeys
  React.useEffect(() => {
    if (!enableHotkeys) return;
    
    const handleKeyPress = (event: KeyboardEvent) => {
      const hotkey = `${event.ctrlKey ? 'Ctrl+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.key.toUpperCase()}`;
      
      const action = enabledActions.find(a => a.hotkey === hotkey);
      if (action) {
        event.preventDefault();
        handleAction(action);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [enabledActions, handleAction, enableHotkeys]);
  
  // Get action color
  const getActionColor = (action: QuickAction) => {
    switch (action.category) {
      case 'safety': return 'error';
      case 'power': return 'warning';
      case 'communication': return 'info';
      case 'science': return 'success';
      default: return 'default';
    }
  };
  
  return (
    <>
      <StyledSpeedDial
        ariaLabel="Quick Actions"
        $position={position}
        icon={
          <EmergencyBadge badgeContent={criticalCount} invisible={criticalCount === 0}>
            <SpeedDialIcon icon={<Emergency />} openIcon={<Close />} />
          </EmergencyBadge>
        }
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
        direction={position.includes('bottom') ? 'up' : 'down'}
      >
        {enabledActions.map((action) => (
          <SpeedDialAction
            key={action.id}
            icon={action.icon}
            tooltipTitle={
              <Box>
                <div>{action.name}</div>
                {action.hotkey && (
                  <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                    {action.hotkey}
                  </div>
                )}
              </Box>
            }
            tooltipOpen
            onClick={() => handleAction(action)}
            FabProps={{
              color: getActionColor(action),
              size: 'medium'
            }}
          />
        ))}
      </StyledSpeedDial>
      
      {/* Confirmation dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, action: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Action: {confirmDialog.action?.name}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmDialog.action?.description}
            <br /><br />
            This action requires confirmation. Are you sure you want to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, action: null })}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            color="error" 
            variant="contained"
            autoFocus
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default QuickActionsToolbar;
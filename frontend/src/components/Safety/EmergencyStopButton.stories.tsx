/**
 * Storybook stories for the EmergencyStopButton component
 * 
 * @module EmergencyStopButton.stories
 */

import React, { useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';
import { Box, Typography, Paper, Grid, Alert } from '@mui/material';
import EmergencyStopButton from './EmergencyStopButton';
import SafetyProvider from './SafetyProvider';

export default {
  title: 'Safety/EmergencyStopButton',
  component: EmergencyStopButton,
  parameters: {
    docs: {
      description: {
        component: `
The EmergencyStopButton is a safety-critical interface component designed according to 
ISO/IEC 61508 and IEC 62061 standards. It provides an unmistakable, highly visible 
emergency stop control for the rover mission control system.

### Features:
- **High Visibility**: Red button with pulsing animation and high contrast
- **Multiple Activation Methods**: Click, keyboard shortcuts (Ctrl+Shift+Space, Shift+Escape)
- **Safety Confirmation**: Requires confirmation before deactivation
- **Accessibility**: Full ARIA support and keyboard navigation
- **Mobile Responsive**: Adapts to different screen sizes
- **Visual States**: Clear feedback for normal, hover, pressed, and activated states
- **Audio/Vibration Feedback**: Optional sensory feedback on activation

### Safety Standards Compliance:
- ISO/IEC 61508 (Functional Safety)
- IEC 62061 (Safety of Machinery)
- WCAG 2.1 AA (Accessibility)
        `,
      },
    },
  },
  decorators: [
    (Story) => (
      <SafetyProvider>
        <Box sx={{ p: 3, minHeight: '400px', position: 'relative' }}>
          <Story />
        </Box>
      </SafetyProvider>
    ),
  ],
} as Meta<typeof EmergencyStopButton>;

// Template for stories
const Template: StoryFn<typeof EmergencyStopButton> = (args) => {
  const [isActivated, setIsActivated] = useState(args.isActivated);

  return (
    <EmergencyStopButton
      {...args}
      isActivated={isActivated}
      onActivate={() => {
        console.log('Emergency stop activated!');
        setIsActivated(true);
      }}
      onDeactivate={() => {
        console.log('Emergency stop cleared');
        setIsActivated(false);
      }}
    />
  );
};

// Default story
export const Default = Template.bind({});
Default.args = {
  isActivated: false,
  size: 'large',
  fixed: false,
};

// Activated state
export const Activated = Template.bind({});
Activated.args = {
  isActivated: true,
  size: 'large',
  fixed: false,
};

// Different sizes
export const Sizes: StoryFn = () => {
  const [activatedStates, setActivatedStates] = useState({
    small: false,
    medium: false,
    large: false,
  });

  const handleActivate = (size: string) => {
    setActivatedStates((prev) => ({ ...prev, [size]: true }));
  };

  const handleDeactivate = (size: string) => {
    setActivatedStates((prev) => ({ ...prev, [size]: false }));
  };

  return (
    <Grid container spacing={4} alignItems="center">
      <Grid item>
        <Typography variant="h6" gutterBottom>
          Small
        </Typography>
        <EmergencyStopButton
          size="small"
          isActivated={activatedStates.small}
          onActivate={() => handleActivate('small')}
          onDeactivate={() => handleDeactivate('small')}
          fixed={false}
        />
      </Grid>
      <Grid item>
        <Typography variant="h6" gutterBottom>
          Medium
        </Typography>
        <EmergencyStopButton
          size="medium"
          isActivated={activatedStates.medium}
          onActivate={() => handleActivate('medium')}
          onDeactivate={() => handleDeactivate('medium')}
          fixed={false}
        />
      </Grid>
      <Grid item>
        <Typography variant="h6" gutterBottom>
          Large
        </Typography>
        <EmergencyStopButton
          size="large"
          isActivated={activatedStates.large}
          onActivate={() => handleActivate('large')}
          onDeactivate={() => handleDeactivate('large')}
          fixed={false}
        />
      </Grid>
    </Grid>
  );
};

// With double confirmation
export const WithDoubleConfirmation = Template.bind({});
WithDoubleConfirmation.args = {
  isActivated: false,
  size: 'large',
  fixed: false,
  requireDoubleConfirmation: true,
};

// Disabled state
export const Disabled = Template.bind({});
Disabled.args = {
  isActivated: false,
  size: 'large',
  fixed: false,
  disabled: true,
};

// Custom label
export const CustomLabel = Template.bind({});
CustomLabel.args = {
  isActivated: false,
  size: 'large',
  fixed: false,
  label: 'E-STOP',
};

// Fixed position demo
export const FixedPosition: StoryFn = () => {
  const [isActivated, setIsActivated] = useState(false);

  return (
    <>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Fixed Position Emergency Stop Button
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The emergency stop button is fixed in the top-right corner of the viewport.
          Scroll this content to see how it remains in place.
        </Typography>
      </Paper>
      
      {/* Scrollable content */}
      <Box sx={{ height: '800px', background: 'linear-gradient(to bottom, #f0f0f0, #e0e0e0)' }}>
        <Typography variant="h4" sx={{ p: 3 }}>
          Scrollable Content Area
        </Typography>
        <Typography sx={{ p: 3 }}>
          The emergency stop button remains visible and accessible at all times.
        </Typography>
      </Box>
      
      <EmergencyStopButton
        isActivated={isActivated}
        onActivate={() => setIsActivated(true)}
        onDeactivate={() => setIsActivated(false)}
        fixed={true}
        position={{ top: 20, right: 20 }}
      />
    </>
  );
};

// Integration example
export const IntegrationExample: StoryFn = () => {
  const [systemState, setSystemState] = useState({
    emergencyStop: false,
    motorsEnabled: true,
    navigationActive: true,
    telemetryStreaming: true,
  });

  const handleEmergencyStop = () => {
    setSystemState({
      emergencyStop: true,
      motorsEnabled: false,
      navigationActive: false,
      telemetryStreaming: false,
    });
  };

  const handleClearStop = () => {
    setSystemState({
      emergencyStop: false,
      motorsEnabled: true,
      navigationActive: true,
      telemetryStreaming: true,
    });
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Rover System Status
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              System States
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Alert severity={systemState.motorsEnabled ? 'success' : 'error'}>
                Motors: {systemState.motorsEnabled ? 'Enabled' : 'Disabled'}
              </Alert>
              <Alert severity={systemState.navigationActive ? 'success' : 'error'}>
                Navigation: {systemState.navigationActive ? 'Active' : 'Inactive'}
              </Alert>
              <Alert severity={systemState.telemetryStreaming ? 'success' : 'error'}>
                Telemetry: {systemState.telemetryStreaming ? 'Streaming' : 'Stopped'}
              </Alert>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Emergency Control
            </Typography>
            <EmergencyStopButton
              isActivated={systemState.emergencyStop}
              onActivate={handleEmergencyStop}
              onDeactivate={handleClearStop}
              fixed={false}
              size="medium"
            />
          </Paper>
        </Grid>
      </Grid>
      
      {systemState.emergencyStop && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="h6">EMERGENCY STOP ACTIVE</Typography>
          <Typography variant="body2">
            All rover operations have been halted. Clear the emergency stop to resume normal operations.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

// Keyboard shortcuts demo
export const KeyboardShortcuts: StoryFn = () => {
  const [isActivated, setIsActivated] = useState(false);

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Keyboard Shortcuts:
        </Typography>
        <Typography variant="body2">
          • <strong>Ctrl/Cmd + Shift + Space</strong>: Activate emergency stop
        </Typography>
        <Typography variant="body2">
          • <strong>Shift + Escape</strong>: Activate emergency stop
        </Typography>
      </Alert>
      
      <EmergencyStopButton
        isActivated={isActivated}
        onActivate={() => setIsActivated(true)}
        onDeactivate={() => setIsActivated(false)}
        fixed={false}
      />
    </Box>
  );
};
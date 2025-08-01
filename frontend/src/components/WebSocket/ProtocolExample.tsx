/**
 * Example usage of Protocol components
 * This file demonstrates how to integrate the protocol selection and monitoring components
 */

import React from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Stack
} from '@mui/material';
import { 
  ProtocolSelector, 
  ProtocolMonitor, 
  ProtocolIndicator,
  ConnectionStatus,
  WebSocketProvider
} from './index';

/**
 * Example Dashboard showing all protocol components
 */
export const ProtocolDashboardExample: React.FC = () => {
  const handleProtocolChange = (protocol: string, isManual: boolean) => {
    console.log(`Protocol changed to ${protocol} (${isManual ? 'manual' : 'automatic'})`);
  };

  return (
    <WebSocketProvider autoConnect showNotifications>
      <Box sx={{ flexGrow: 1 }}>
        {/* App Bar with inline indicator */}
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              WebSocket Protocol Management
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <ConnectionStatus compact />
              <ProtocolIndicator variant="chip" />
            </Stack>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Grid container spacing={3}>
            {/* Protocol Selector */}
            <Grid item xs={12} md={6}>
              <ProtocolSelector
                showRecommendations
                showMetrics
                onProtocolChange={handleProtocolChange}
              />
            </Grid>

            {/* Compact Protocol Info */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Protocol Status Indicators
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Chip Variant:
                    </Typography>
                    <ProtocolIndicator variant="chip" showCompression showMetrics />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Icon Variant:
                    </Typography>
                    <ProtocolIndicator variant="icon" size="medium" />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Text Variant:
                    </Typography>
                    <ProtocolIndicator variant="text" showCompression />
                  </Box>
                </Stack>
              </Paper>
            </Grid>

            {/* Protocol Monitor */}
            <Grid item xs={12}>
              <ProtocolMonitor
                defaultExpanded
                showHistory
                showComparison
                refreshInterval={2000}
              />
            </Grid>

            {/* Compact Selector */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Compact View
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <ProtocolSelector variant="compact" />
                  <Typography variant="body2" color="text.secondary">
                    Minimal protocol selector for toolbars
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>

        {/* Fixed position indicator */}
        <ProtocolIndicator 
          variant="chip" 
          position="fixed" 
          showMetrics 
          showCompression 
        />
      </Box>
    </WebSocketProvider>
  );
};

/**
 * Example integration in a header/toolbar
 */
export const HeaderExample: React.FC = () => {
  return (
    <AppBar position="static" color="default">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Rover Mission Control
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <ProtocolIndicator variant="text" />
          <ConnectionStatus compact />
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

/**
 * Example integration in a status bar
 */
export const StatusBarExample: React.FC = () => {
  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        p: 1,
        borderTop: 1,
        borderColor: 'divider'
      }}
    >
      <Stack 
        direction="row" 
        spacing={2} 
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2 }}
      >
        <Typography variant="caption" color="text.secondary">
          Ready
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <ProtocolIndicator variant="icon" size="small" />
          <Typography variant="caption" color="text.secondary">
            |
          </Typography>
          <ConnectionStatus compact />
        </Stack>
      </Stack>
    </Paper>
  );
};
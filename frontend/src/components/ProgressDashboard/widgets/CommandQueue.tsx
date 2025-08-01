/**
 * Command Queue Widget
 * 
 * Displays queued and executing commands
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { EnhancedProgress } from '../../../types/progress-tracking.types';

interface CommandQueueProps {
  progressMap: Map<string, EnhancedProgress>;
}

export const CommandQueue: React.FC<CommandQueueProps> = ({ progressMap }) => {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Command Queue
      </Typography>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Implementation will be added based on queue monitoring requirements */}
        <Typography variant="body2" color="text.secondary">
          Queue visualization coming soon...
        </Typography>
      </Box>
    </Box>
  );
};
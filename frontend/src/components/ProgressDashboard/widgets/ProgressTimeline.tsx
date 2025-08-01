/**
 * Progress Timeline Widget
 * 
 * Displays command execution timeline with Gantt-style visualization
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { EnhancedProgress } from '../../../types/progress-tracking.types';

interface ProgressTimelineProps {
  progressMap: Map<string, EnhancedProgress>;
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ progressMap }) => {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Execution Timeline
      </Typography>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Implementation will be added for timeline visualization */}
        <Typography variant="body2" color="text.secondary">
          Timeline visualization coming soon...
        </Typography>
      </Box>
    </Box>
  );
};
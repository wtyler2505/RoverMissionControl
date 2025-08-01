/**
 * ChartWithExport - Example integration of EnhancedRealTimeChart with ExportToolbar
 * Demonstrates how to add export functionality to visualization components
 */

import React, { useRef, useState } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { EnhancedRealTimeChart } from './EnhancedRealTimeChart';
import { ExportToolbar } from './ExportToolbar';
import { ChartAnnotations } from './ChartAnnotations';
import { ChartAnnotation } from '../../types/annotations';

/**
 * Props for ChartWithExport
 */
export interface ChartWithExportProps {
  data: any[];
  title?: string;
  streamId?: string;
  height?: number;
  showAnnotations?: boolean;
}

/**
 * Styled components
 */
const ChartContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  position: 'relative'
}));

const ChartHeader = styled(Stack)(({ theme }) => ({
  marginBottom: theme.spacing(2)
}));

const ChartWrapper = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%'
}));

/**
 * ChartWithExport component
 */
export const ChartWithExport: React.FC<ChartWithExportProps> = ({
  data,
  title = 'Telemetry Chart',
  streamId = 'stream-1',
  height = 400,
  showAnnotations = true
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<[number, number] | null>(null);

  /**
   * Handle annotation changes
   */
  const handleAnnotationsChange = (newAnnotations: ChartAnnotation[]) => {
    setAnnotations(newAnnotations);
  };

  /**
   * Handle time range selection
   */
  const handleTimeRangeSelect = (range: [number, number] | null) => {
    setSelectedTimeRange(range);
  };

  /**
   * Handle export complete
   */
  const handleExportComplete = (result: any) => {
    console.log('Export completed:', result);
  };

  /**
   * Handle export error
   */
  const handleExportError = (error: Error) => {
    console.error('Export error:', error);
  };

  // Prepare chart data for export
  const chartDataExport = {
    metadata: {
      chartType: 'line',
      exportDate: new Date(),
      dataRange: {
        start: new Date(data[0]?.timestamp || Date.now()),
        end: new Date(data[data.length - 1]?.timestamp || Date.now())
      },
      series: ['value'] // Adjust based on your data structure
    },
    data: selectedTimeRange 
      ? data.filter(d => d.timestamp >= selectedTimeRange[0] && d.timestamp <= selectedTimeRange[1])
      : data,
    annotations: annotations.map(ann => ({
      id: ann.id,
      timestamp: ann.x,
      text: ann.text,
      type: ann.type
    }))
  };

  return (
    <ChartContainer elevation={1}>
      <ChartHeader direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">{title}</Typography>
        <ExportToolbar
          exportTarget="chart"
          chartElement={chartRef.current}
          onExportComplete={handleExportComplete}
          onExportError={handleExportError}
        />
      </ChartHeader>

      <ChartWrapper>
        <EnhancedRealTimeChart
          ref={chartRef}
          data={data}
          height={height}
          onTimeRangeSelect={handleTimeRangeSelect}
          // Add other chart props as needed
        />

        {showAnnotations && (
          <ChartAnnotations
            annotations={annotations}
            onAnnotationsChange={handleAnnotationsChange}
            chartWidth={800} // Get from chart ref in real implementation
            chartHeight={height}
            xScale={(x: number) => x} // Get from chart in real implementation
            yScale={(y: number) => y} // Get from chart in real implementation
          />
        )}
      </ChartWrapper>

      {selectedTimeRange && (
        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Selected range: {new Date(selectedTimeRange[0]).toLocaleTimeString()} - {new Date(selectedTimeRange[1]).toLocaleTimeString()}
          </Typography>
        </Box>
      )}
    </ChartContainer>
  );
};

export default ChartWithExport;
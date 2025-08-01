/**
 * Command History Export Dialog
 * Allows users to configure and export command history data
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  Typography,
  Box,
  Alert,
  Divider,
  Chip,
  Collapse
} from '@mui/material';
import {
  Download as DownloadIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { ExportFormat } from '../../types/command-history.types';

interface CommandHistoryExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat, columns: string[], includeAuditTrail: boolean) => void;
  availableColumns: string[];
  defaultColumns: string[];
}

// Column display names
const COLUMN_DISPLAY_NAMES: Record<string, string> = {
  commandId: 'Command ID',
  commandType: 'Command Type',
  priority: 'Priority',
  finalStatus: 'Final Status',
  createdAt: 'Created At',
  queuedAt: 'Queued At',
  startedAt: 'Started At',
  completedAt: 'Completed At',
  totalExecutionTimeMs: 'Total Execution Time',
  queueWaitTimeMs: 'Queue Wait Time',
  processingTimeMs: 'Processing Time',
  retryCount: 'Retry Count',
  success: 'Success',
  errorCode: 'Error Code',
  errorCategory: 'Error Category',
  userId: 'User ID',
  sessionId: 'Session ID',
  sourceSystem: 'Source System',
  parameterSummary: 'Parameters',
  resultSummary: 'Results',
  tags: 'Tags',
  dataClassification: 'Data Classification'
};

// Format information
const FORMAT_INFO: Record<ExportFormat, { description: string; icon?: React.ReactNode }> = {
  [ExportFormat.CSV]: {
    description: 'Comma-separated values file. Best for importing into spreadsheet applications.'
  },
  [ExportFormat.JSON]: {
    description: 'JavaScript Object Notation. Best for programmatic processing and APIs.'
  },
  [ExportFormat.EXCEL]: {
    description: 'Microsoft Excel format. Includes formatting and multiple sheets if needed.'
  },
  [ExportFormat.PDF]: {
    description: 'Portable Document Format. Best for reports and sharing (coming soon).'
  }
};

export const CommandHistoryExportDialog: React.FC<CommandHistoryExportDialogProps> = ({
  open,
  onClose,
  onExport,
  availableColumns,
  defaultColumns
}) => {
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.CSV);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(defaultColumns);
  const [includeAuditTrail, setIncludeAuditTrail] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Handlers
  const handleFormatChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFormat(event.target.value as ExportFormat);
  }, []);

  const handleColumnToggle = useCallback((column: string) => {
    setSelectedColumns(prev => {
      if (prev.includes(column)) {
        return prev.filter(c => c !== column);
      } else {
        return [...prev, column];
      }
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedColumns(availableColumns);
  }, [availableColumns]);

  const handleSelectNone = useCallback(() => {
    setSelectedColumns([]);
  }, []);

  const handleSelectDefault = useCallback(() => {
    setSelectedColumns(defaultColumns);
  }, [defaultColumns]);

  const handleExport = useCallback(() => {
    if (selectedColumns.length === 0) {
      return; // Should show error
    }
    onExport(format, selectedColumns, includeAuditTrail);
  }, [format, selectedColumns, includeAuditTrail, onExport]);

  // Group columns by category
  const groupedColumns = React.useMemo(() => {
    const groups: Record<string, string[]> = {
      'Basic Information': ['commandId', 'commandType', 'priority', 'finalStatus'],
      'Timestamps': ['createdAt', 'queuedAt', 'startedAt', 'completedAt'],
      'Performance': ['totalExecutionTimeMs', 'queueWaitTimeMs', 'processingTimeMs'],
      'Execution Details': ['retryCount', 'success', 'errorCode', 'errorCategory'],
      'Context': ['userId', 'sessionId', 'sourceSystem'],
      'Data': ['parameterSummary', 'resultSummary', 'tags', 'dataClassification']
    };

    // Filter to only include available columns
    const filtered: Record<string, string[]> = {};
    Object.entries(groups).forEach(([group, columns]) => {
      const available = columns.filter(col => availableColumns.includes(col));
      if (available.length > 0) {
        filtered[group] = available;
      }
    });

    return filtered;
  }, [availableColumns]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <DownloadIcon />
          Export Command History
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Format selection */}
        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <FormLabel component="legend">Export Format</FormLabel>
          <RadioGroup
            value={format}
            onChange={handleFormatChange}
            sx={{ mt: 1 }}
          >
            {Object.values(ExportFormat).map((fmt) => (
              <FormControlLabel
                key={fmt}
                value={fmt}
                control={<Radio />}
                disabled={fmt === ExportFormat.PDF} // PDF not implemented yet
                label={
                  <Box>
                    <Typography variant="body1">
                      {fmt.toUpperCase()}
                      {fmt === ExportFormat.PDF && (
                        <Chip label="Coming Soon" size="small" sx={{ ml: 1 }} />
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {FORMAT_INFO[fmt].description}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        </FormControl>

        <Divider sx={{ my: 2 }} />

        {/* Column selection */}
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <FormLabel component="legend">Select Columns to Export</FormLabel>
            <Box display="flex" gap={1}>
              <Button size="small" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button size="small" onClick={handleSelectNone}>
                Select None
              </Button>
              <Button size="small" onClick={handleSelectDefault}>
                Default
              </Button>
            </Box>
          </Box>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="caption">
              {selectedColumns.length} columns selected. 
              The export will include only the selected columns in the order shown.
            </Typography>
          </Alert>

          <FormGroup>
            {Object.entries(groupedColumns).map(([group, columns]) => (
              <Box key={group} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  {group}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, ml: 2 }}>
                  {columns.map((column) => (
                    <FormControlLabel
                      key={column}
                      control={
                        <Checkbox
                          checked={selectedColumns.includes(column)}
                          onChange={() => handleColumnToggle(column)}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {COLUMN_DISPLAY_NAMES[column] || column}
                        </Typography>
                      }
                      sx={{ width: '45%' }}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </FormGroup>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Advanced options */}
        <Box>
          <Button
            onClick={() => setShowAdvanced(!showAdvanced)}
            endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ mb: 1 }}
          >
            Advanced Options
          </Button>

          <Collapse in={showAdvanced}>
            <FormGroup sx={{ ml: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeAuditTrail}
                    onChange={(e) => setIncludeAuditTrail(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      Include Audit Trail
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Adds a detailed history of all status changes for each command
                    </Typography>
                  </Box>
                }
              />
            </FormGroup>

            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="caption">
                <strong>Privacy Notice:</strong> Exported data may contain sensitive information. 
                Ensure you comply with your organization's data handling policies.
              </Typography>
            </Alert>
          </Collapse>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          startIcon={<DownloadIcon />}
          disabled={selectedColumns.length === 0}
        >
          Export
        </Button>
      </DialogActions>
    </Dialog>
  );
};
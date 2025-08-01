/**
 * Firmware History Dialog Component
 * Shows firmware update history for devices
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  Box,
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { firmwareApi } from '../../services/api/firmwareApi';

interface FirmwareHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  deviceId?: string | null;
}

interface UpdateHistoryItem {
  session_id: string;
  timestamp: string;
  from_version: string;
  to_version: string;
  status: string;
  duration: number;
}

const FirmwareHistoryDialog: React.FC<FirmwareHistoryDialogProps> = ({
  open,
  onClose,
  deviceId,
}) => {
  const [history, setHistory] = useState<UpdateHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && deviceId) {
      loadHistory();
    }
  }, [open, deviceId]);

  const loadHistory = async () => {
    if (!deviceId) return;
    
    setLoading(true);
    try {
      const data = await firmwareApi.getDeviceUpdateHistory(deviceId);
      setHistory(data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'rolled_back':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Firmware Update History
        {deviceId && (
          <Typography variant="subtitle2" color="textSecondary">
            Device: {deviceId}
          </Typography>
        )}
      </DialogTitle>
      
      <DialogContent>
        {loading ? (
          <Typography>Loading...</Typography>
        ) : history.length === 0 ? (
          <Typography color="textSecondary">
            No update history available
          </Typography>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>From Version</TableCell>
                  <TableCell>To Version</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.session_id}>
                    <TableCell>
                      {formatDistanceToNow(new Date(item.timestamp), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>{item.from_version}</TableCell>
                    <TableCell>{item.to_version}</TableCell>
                    <TableCell>{formatDuration(item.duration)}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.status.replace(/_/g, ' ').toUpperCase()}
                        color={getStatusColor(item.status)}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default FirmwareHistoryDialog;
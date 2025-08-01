/**
 * Firmware Repository Component
 * Manages the firmware repository with upload, download, and version management
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Info as InfoIcon,
  CheckCircle as ValidIcon,
  Error as InvalidIcon,
  Security as SecurityIcon,
  CleaningServices as CleanupIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { firmwareApi } from '../../services/api/firmwareApi';

interface FirmwareMetadata {
  device_id: string;
  device_model: string;
  version: string;
  size: number;
  checksum_sha256: string;
  release_date?: string;
  expiry_date?: string;
  update_priority: string;
  critical_update: boolean;
  changelog?: string;
  safety_level?: number;
  rollback_allowed: boolean;
}

const FirmwareRepository: React.FC = () => {
  const [firmwareList, setFirmwareList] = useState<Record<string, FirmwareMetadata[]>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedFirmware, setSelectedFirmware] = useState<FirmwareMetadata | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [keepCount, setKeepCount] = useState(3);

  // Load firmware repository
  const loadRepository = async () => {
    setLoading(true);
    try {
      const data = await firmwareApi.listFirmwareRepository();
      setFirmwareList(data);
    } catch (error) {
      console.error('Failed to load firmware repository:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepository();
  }, []);

  // Format file size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'primary';
      case 'low':
        return 'info';
      case 'optional':
      default:
        return 'default';
    }
  };

  // Flatten firmware list for table display
  const getFlattenedList = () => {
    const flattened: (FirmwareMetadata & { deviceId: string })[] = [];
    Object.entries(firmwareList).forEach(([deviceId, versions]) => {
      versions.forEach(version => {
        flattened.push({ ...version, deviceId });
      });
    });
    return flattened;
  };

  // Handle firmware download
  const handleDownload = async (deviceId: string, version: string) => {
    try {
      const response = await fetch(
        `/api/firmware/devices/${deviceId}/download/${version}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deviceId}_${version}.bin`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // Handle firmware deletion
  const handleDelete = async () => {
    if (!selectedFirmware) return;

    try {
      await firmwareApi.deleteFirmware(
        selectedFirmware.device_id,
        selectedFirmware.version
      );
      setDeleteDialogOpen(false);
      loadRepository();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  // Handle cleanup old versions
  const handleCleanup = async () => {
    if (!selectedDevice) return;

    try {
      await firmwareApi.cleanupOldFirmware(selectedDevice, keepCount);
      setCleanupDialogOpen(false);
      loadRepository();
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  };

  // Validate firmware
  const handleValidate = async (deviceId: string, version: string) => {
    try {
      const result = await firmwareApi.validateDeviceFirmware(deviceId, version);
      // Show validation result
      console.log('Validation result:', result);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const flattenedList = getFlattenedList();

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Firmware Repository</Typography>
        <Button
          startIcon={<CleanupIcon />}
          onClick={() => {
            setCleanupDialogOpen(true);
            setSelectedDevice('');
          }}
        >
          Cleanup Old Versions
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Device</TableCell>
              <TableCell>Model</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Release Date</TableCell>
              <TableCell>Safety Level</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {flattenedList
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((firmware, index) => (
                <TableRow key={`${firmware.deviceId}-${firmware.version}-${index}`}>
                  <TableCell>{firmware.deviceId}</TableCell>
                  <TableCell>{firmware.device_model}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {firmware.version}
                      {firmware.critical_update && (
                        <Tooltip title="Critical Update">
                          <SecurityIcon color="error" fontSize="small" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{formatBytes(firmware.size)}</TableCell>
                  <TableCell>
                    <Chip
                      label={firmware.update_priority.toUpperCase()}
                      color={getPriorityColor(firmware.update_priority)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {firmware.release_date
                      ? formatDistanceToNow(new Date(firmware.release_date), {
                          addSuffix: true,
                        })
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {firmware.safety_level !== undefined
                      ? `SIL ${firmware.safety_level}`
                      : '-'}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        onClick={() =>
                          handleDownload(firmware.deviceId, firmware.version)
                        }
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Details">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedFirmware(firmware);
                          setDetailsDialogOpen(true);
                        }}
                      >
                        <InfoIcon />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setAnchorEl(e.currentTarget);
                        setSelectedFirmware(firmware);
                        setSelectedDevice(firmware.deviceId);
                      }}
                    >
                      <MoreIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={flattenedList.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            if (selectedFirmware) {
              handleValidate(selectedFirmware.device_id, selectedFirmware.version);
            }
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <ValidIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Validate</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteDialogOpen(true);
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setCleanupDialogOpen(true);
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <CleanupIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Cleanup Device Versions</ListItemText>
        </MenuItem>
      </Menu>

      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Firmware Details</DialogTitle>
        <DialogContent>
          {selectedFirmware && (
            <Box>
              <Typography variant="subtitle2" color="textSecondary">
                Device ID
              </Typography>
              <Typography gutterBottom>{selectedFirmware.device_id}</Typography>

              <Typography variant="subtitle2" color="textSecondary">
                Version
              </Typography>
              <Typography gutterBottom>{selectedFirmware.version}</Typography>

              <Typography variant="subtitle2" color="textSecondary">
                SHA256 Checksum
              </Typography>
              <Typography
                gutterBottom
                sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
              >
                {selectedFirmware.checksum_sha256}
              </Typography>

              {selectedFirmware.changelog && (
                <>
                  <Typography variant="subtitle2" color="textSecondary">
                    Changelog
                  </Typography>
                  <Typography
                    gutterBottom
                    sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}
                  >
                    {selectedFirmware.changelog}
                  </Typography>
                </>
              )}

              <Typography variant="subtitle2" color="textSecondary">
                Rollback Allowed
              </Typography>
              <Typography>
                {selectedFirmware.rollback_allowed ? 'Yes' : 'No'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Firmware</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. The firmware file will be permanently
            deleted from the repository.
          </Alert>
          <Typography>
            Are you sure you want to delete firmware version{' '}
            <strong>{selectedFirmware?.version}</strong> for device{' '}
            <strong>{selectedFirmware?.device_id}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cleanup Dialog */}
      <Dialog
        open={cleanupDialogOpen}
        onClose={() => setCleanupDialogOpen(false)}
      >
        <DialogTitle>Cleanup Old Firmware Versions</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            This will remove old firmware versions, keeping only the most recent
            ones.
          </Typography>
          <TextField
            fullWidth
            label="Device ID"
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            margin="normal"
            helperText="Leave empty to show all devices"
          />
          <TextField
            fullWidth
            type="number"
            label="Keep Recent Versions"
            value={keepCount}
            onChange={(e) => setKeepCount(parseInt(e.target.value, 10))}
            margin="normal"
            inputProps={{ min: 1, max: 10 }}
            helperText="Number of recent versions to keep"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCleanupDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCleanup}
            color="warning"
            variant="contained"
            disabled={!selectedDevice}
          >
            Cleanup
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FirmwareRepository;
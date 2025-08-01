import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { DiscoveredDevice } from '../../services/discoveryService';

interface DeviceDetailsDialogProps {
  open: boolean;
  device: DiscoveredDevice | null;
  onClose: () => void;
}

export const DeviceDetailsDialog: React.FC<DeviceDetailsDialogProps> = ({
  open,
  device,
  onClose
}) => {
  if (!device) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderMetadataTable = (data: Record<string, any>) => {
    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableBody>
            {Object.entries(data).map(([key, value]) => (
              <TableRow key={key}>
                <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </TableCell>
                <TableCell>
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Device Details</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="Device ID"
                  secondary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" component="span">
                        {device.device_id}
                      </Typography>
                      <Tooltip title="Copy to clipboard">
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(device.device_id)}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Protocol Type"
                  secondary={
                    <Chip
                      label={device.protocol_type.toUpperCase()}
                      size="small"
                      color="primary"
                    />
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Device Class"
                  secondary={
                    <Chip
                      label={device.device_class}
                      size="small"
                      variant="outlined"
                    />
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Address"
                  secondary={device.address || 'N/A'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Discovery Method"
                  secondary={device.discovery_method}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Discovered At"
                  secondary={new Date(device.discovered_at).toLocaleString()}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Confidence"
                  secondary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">
                        {Math.round(device.confidence * 100)}%
                      </Typography>
                      <Box
                        sx={{
                          width: 100,
                          height: 8,
                          backgroundColor: 'grey.300',
                          borderRadius: 1,
                          overflow: 'hidden'
                        }}
                      >
                        <Box
                          sx={{
                            width: `${device.confidence * 100}%`,
                            height: '100%',
                            backgroundColor: device.confidence >= 0.9 ? 'success.main' :
                              device.confidence >= 0.7 ? 'warning.main' : 'error.main'
                          }}
                        />
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            </List>
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          {/* Device Identity */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Device Identity
            </Typography>
            {Object.keys(device.identity).some(key => device.identity[key as keyof typeof device.identity]) ? (
              <List>
                {device.identity.manufacturer && (
                  <ListItem>
                    <ListItemText
                      primary="Manufacturer"
                      secondary={device.identity.manufacturer}
                    />
                  </ListItem>
                )}
                {device.identity.model && (
                  <ListItem>
                    <ListItemText
                      primary="Model"
                      secondary={device.identity.model}
                    />
                  </ListItem>
                )}
                {device.identity.serial_number && (
                  <ListItem>
                    <ListItemText
                      primary="Serial Number"
                      secondary={device.identity.serial_number}
                    />
                  </ListItem>
                )}
                {device.identity.firmware_version && (
                  <ListItem>
                    <ListItemText
                      primary="Firmware Version"
                      secondary={device.identity.firmware_version}
                    />
                  </ListItem>
                )}
                {device.identity.hardware_version && (
                  <ListItem>
                    <ListItemText
                      primary="Hardware Version"
                      secondary={device.identity.hardware_version}
                    />
                  </ListItem>
                )}
                {device.identity.protocol_version && (
                  <ListItem>
                    <ListItemText
                      primary="Protocol Version"
                      secondary={device.identity.protocol_version}
                    />
                  </ListItem>
                )}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No identity information available
              </Typography>
            )}
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          {/* Capabilities */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Capabilities
            </Typography>
            {device.capabilities && device.capabilities.length > 0 ? (
              <Grid container spacing={2}>
                {device.capabilities.map((capability, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        {capability.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Category: {capability.category}
                      </Typography>
                      {capability.description && (
                        <Typography variant="body2" gutterBottom>
                          {capability.description}
                        </Typography>
                      )}
                      {capability.parameters && Object.keys(capability.parameters).length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Parameters:
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>
                            {Object.entries(capability.parameters).map(([key, value]) => (
                              <Chip
                                key={key}
                                label={`${key}: ${value}`}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 0.5, mb: 0.5 }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                      {capability.read_only && (
                        <Chip
                          label="Read Only"
                          size="small"
                          color="warning"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No capabilities detected
              </Typography>
            )}
          </Grid>

          {/* Metadata */}
          {device.metadata && Object.keys(device.metadata).length > 0 && (
            <>
              <Grid item xs={12}>
                <Divider />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Additional Metadata
                </Typography>
                {renderMetadataTable(device.metadata)}
              </Grid>
            </>
          )}

          {/* Raw JSON */}
          <Grid item xs={12}>
            <Divider />
          </Grid>
          <Grid item xs={12}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="h6">
                Raw Device Data
              </Typography>
              <Button
                size="small"
                startIcon={<CopyIcon />}
                onClick={() => copyToClipboard(JSON.stringify(device, null, 2))}
              >
                Copy JSON
              </Button>
            </Box>
            <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'grey.50' }}>
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  overflow: 'auto',
                  maxHeight: 300
                }}
              >
                {JSON.stringify(device, null, 2)}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
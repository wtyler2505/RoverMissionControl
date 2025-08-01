import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Chip,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { ManualDeviceData, DeviceCapability } from '../../services/discoveryService';

interface ManualDeviceDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (device: ManualDeviceData) => void;
}

export const ManualDeviceDialog: React.FC<ManualDeviceDialogProps> = ({
  open,
  onClose,
  onAdd
}) => {
  const [deviceData, setDeviceData] = useState<ManualDeviceData>({
    protocol_type: 'serial',
    device_class: 'unknown',
    identity: {},
    capabilities: [],
    metadata: {}
  });

  const [newCapability, setNewCapability] = useState<DeviceCapability>({
    name: '',
    category: '',
    description: ''
  });

  const [metadataKey, setMetadataKey] = useState('');
  const [metadataValue, setMetadataValue] = useState('');

  const handleAddCapability = () => {
    if (newCapability.name && newCapability.category) {
      setDeviceData(prev => ({
        ...prev,
        capabilities: [...(prev.capabilities || []), newCapability]
      }));
      setNewCapability({ name: '', category: '', description: '' });
    }
  };

  const handleRemoveCapability = (index: number) => {
    setDeviceData(prev => ({
      ...prev,
      capabilities: prev.capabilities?.filter((_, i) => i !== index) || []
    }));
  };

  const handleAddMetadata = () => {
    if (metadataKey && metadataValue) {
      setDeviceData(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          [metadataKey]: metadataValue
        }
      }));
      setMetadataKey('');
      setMetadataValue('');
    }
  };

  const handleRemoveMetadata = (key: string) => {
    setDeviceData(prev => {
      const newMetadata = { ...prev.metadata };
      delete newMetadata[key];
      return { ...prev, metadata: newMetadata };
    });
  };

  const handleSubmit = () => {
    onAdd(deviceData);
    handleClose();
  };

  const handleClose = () => {
    setDeviceData({
      protocol_type: 'serial',
      device_class: 'unknown',
      identity: {},
      capabilities: [],
      metadata: {}
    });
    setNewCapability({ name: '', category: '', description: '' });
    setMetadataKey('');
    setMetadataValue('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Add Manual Device</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Device ID (optional)"
                    value={deviceData.device_id || ''}
                    onChange={(e) => setDeviceData(prev => ({ ...prev, device_id: e.target.value }))}
                    helperText="Leave empty to auto-generate"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Protocol Type</InputLabel>
                    <Select
                      value={deviceData.protocol_type}
                      onChange={(e) => setDeviceData(prev => ({ ...prev, protocol_type: e.target.value }))}
                      label="Protocol Type"
                    >
                      <MenuItem value="serial">Serial</MenuItem>
                      <MenuItem value="i2c">I2C</MenuItem>
                      <MenuItem value="spi">SPI</MenuItem>
                      <MenuItem value="can">CAN</MenuItem>
                      <MenuItem value="ethernet">Ethernet</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={deviceData.address || ''}
                    onChange={(e) => setDeviceData(prev => ({ ...prev, address: e.target.value }))}
                    helperText="Port, I2C address, etc."
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Device Class</InputLabel>
                    <Select
                      value={deviceData.device_class}
                      onChange={(e) => setDeviceData(prev => ({ ...prev, device_class: e.target.value }))}
                      label="Device Class"
                    >
                      <MenuItem value="sensor">Sensor</MenuItem>
                      <MenuItem value="actuator">Actuator</MenuItem>
                      <MenuItem value="controller">Controller</MenuItem>
                      <MenuItem value="communication">Communication</MenuItem>
                      <MenuItem value="power">Power</MenuItem>
                      <MenuItem value="storage">Storage</MenuItem>
                      <MenuItem value="display">Display</MenuItem>
                      <MenuItem value="input">Input</MenuItem>
                      <MenuItem value="unknown">Unknown</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Device Identity */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Device Identity
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Manufacturer"
                    value={deviceData.identity?.manufacturer || ''}
                    onChange={(e) => setDeviceData(prev => ({
                      ...prev,
                      identity: { ...prev.identity, manufacturer: e.target.value }
                    }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Model"
                    value={deviceData.identity?.model || ''}
                    onChange={(e) => setDeviceData(prev => ({
                      ...prev,
                      identity: { ...prev.identity, model: e.target.value }
                    }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Serial Number"
                    value={deviceData.identity?.serial_number || ''}
                    onChange={(e) => setDeviceData(prev => ({
                      ...prev,
                      identity: { ...prev.identity, serial_number: e.target.value }
                    }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Firmware Version"
                    value={deviceData.identity?.firmware_version || ''}
                    onChange={(e) => setDeviceData(prev => ({
                      ...prev,
                      identity: { ...prev.identity, firmware_version: e.target.value }
                    }))}
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Capabilities */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Capabilities
              </Typography>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Capability Name"
                      size="small"
                      value={newCapability.name}
                      onChange={(e) => setNewCapability(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="Category"
                      size="small"
                      value={newCapability.category}
                      onChange={(e) => setNewCapability(prev => ({ ...prev, category: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Description"
                      size="small"
                      value={newCapability.description}
                      onChange={(e) => setNewCapability(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    <IconButton
                      onClick={handleAddCapability}
                      disabled={!newCapability.name || !newCapability.category}
                    >
                      <AddIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Paper>
              {deviceData.capabilities && deviceData.capabilities.length > 0 && (
                <List>
                  {deviceData.capabilities.map((cap, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={cap.name}
                        secondary={`${cap.category}${cap.description ? ` - ${cap.description}` : ''}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton onClick={() => handleRemoveCapability(index)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Metadata */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Additional Metadata
              </Typography>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={5}>
                    <TextField
                      fullWidth
                      label="Key"
                      size="small"
                      value={metadataKey}
                      onChange={(e) => setMetadataKey(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Value"
                      size="small"
                      value={metadataValue}
                      onChange={(e) => setMetadataValue(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    <IconButton
                      onClick={handleAddMetadata}
                      disabled={!metadataKey || !metadataValue}
                    >
                      <AddIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Paper>
              {Object.keys(deviceData.metadata || {}).length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(deviceData.metadata || {}).map(([key, value]) => (
                    <Chip
                      key={key}
                      label={`${key}: ${value}`}
                      onDelete={() => handleRemoveMetadata(key)}
                    />
                  ))}
                </Box>
              )}
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          Add Device
        </Button>
      </DialogActions>
    </Dialog>
  );
};
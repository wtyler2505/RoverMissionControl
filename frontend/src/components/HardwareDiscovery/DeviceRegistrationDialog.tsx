import React, { useState, useEffect } from 'react';
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
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  Grid
} from '@mui/material';
import { hardwareService } from '../../services/hardwareService';

interface DeviceRegistrationDialogProps {
  open: boolean;
  device: any;
  onClose: () => void;
  onRegister: (adapterId: string, name: string) => void;
}

export const DeviceRegistrationDialog: React.FC<DeviceRegistrationDialogProps> = ({
  open,
  device,
  onClose,
  onRegister
}) => {
  const [adapterId, setAdapterId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [availableAdapters, setAvailableAdapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && device) {
      // Set default device name
      setDeviceName(device.identity?.model || `${device.device_class}_${device.device_id.slice(-8)}`);
      
      // Fetch available adapters for the device's protocol
      fetchAdapters(device.protocol_type);
    }
  }, [open, device]);

  const fetchAdapters = async (protocolType: string) => {
    try {
      setLoading(true);
      // This would fetch adapters from the hardware manager
      // For now, we'll use a placeholder
      const mockAdapters = [
        { id: `${protocolType}_adapter_1`, name: `${protocolType.toUpperCase()} Adapter 1`, connected: true },
        { id: `${protocolType}_adapter_2`, name: `${protocolType.toUpperCase()} Adapter 2`, connected: false }
      ];
      setAvailableAdapters(mockAdapters.filter(a => a.connected));
      
      // Auto-select if only one adapter
      if (mockAdapters.filter(a => a.connected).length === 1) {
        setAdapterId(mockAdapters.filter(a => a.connected)[0].id);
      }
    } catch (err) {
      setError('Failed to fetch available adapters');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    if (!adapterId) {
      setError('Please select an adapter');
      return;
    }
    if (!deviceName.trim()) {
      setError('Please enter a device name');
      return;
    }
    
    onRegister(adapterId, deviceName);
    handleClose();
  };

  const handleClose = () => {
    setAdapterId('');
    setDeviceName('');
    setError(null);
    onClose();
  };

  if (!device) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Register Device</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Typography variant="subtitle2" gutterBottom>
            Device Information
          </Typography>
          <List dense sx={{ mb: 3 }}>
            <ListItem>
              <ListItemText
                primary="Device ID"
                secondary={device.device_id}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Protocol"
                secondary={
                  <Chip
                    label={device.protocol_type.toUpperCase()}
                    size="small"
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
            {device.identity?.manufacturer && (
              <ListItem>
                <ListItemText
                  primary="Manufacturer"
                  secondary={device.identity.manufacturer}
                />
              </ListItem>
            )}
          </List>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Device Name"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                helperText="A friendly name for this device"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Adapter</InputLabel>
                <Select
                  value={adapterId}
                  onChange={(e) => setAdapterId(e.target.value)}
                  label="Adapter"
                  disabled={loading}
                >
                  {availableAdapters.map((adapter) => (
                    <MenuItem key={adapter.id} value={adapter.id}>
                      {adapter.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {device.capabilities && device.capabilities.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Device Capabilities
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {device.capabilities.map((cap: any, index: number) => (
                  <Chip
                    key={index}
                    label={cap.name}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleRegister}
          variant="contained"
          disabled={!adapterId || !deviceName.trim()}
        >
          Register
        </Button>
      </DialogActions>
    </Dialog>
  );
};
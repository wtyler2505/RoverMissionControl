/**
 * Firmware Settings Dialog Component
 * Configure firmware management settings
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  Divider,
} from '@mui/material';

interface FirmwareSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const FirmwareSettingsDialog: React.FC<FirmwareSettingsDialogProps> = ({
  open,
  onClose,
}) => {
  const [autoCheck, setAutoCheck] = useState(true);
  const [autoBackup, setAutoBackup] = useState(true);
  const [maxConcurrent, setMaxConcurrent] = useState(1);
  const [timeout, setTimeout] = useState(30);
  const [retryCount, setRetryCount] = useState(3);

  const handleSave = () => {
    // Save settings to backend or local storage
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Firmware Management Settings</DialogTitle>
      
      <DialogContent>
        <Typography variant="subtitle2" color="primary" gutterBottom>
          Update Behavior
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={autoCheck}
              onChange={(e) => setAutoCheck(e.target.checked)}
            />
          }
          label="Automatically check for firmware updates"
          sx={{ mb: 2 }}
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={autoBackup}
              onChange={(e) => setAutoBackup(e.target.checked)}
            />
          }
          label="Create backup before updating"
          sx={{ mb: 2 }}
        />
        
        <TextField
          fullWidth
          type="number"
          label="Maximum Concurrent Updates"
          value={maxConcurrent}
          onChange={(e) => setMaxConcurrent(parseInt(e.target.value, 10))}
          inputProps={{ min: 1, max: 5 }}
          helperText="Number of devices that can update simultaneously"
          margin="normal"
        />
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="subtitle2" color="primary" gutterBottom>
          Safety Settings
        </Typography>
        
        <TextField
          fullWidth
          type="number"
          label="Update Timeout (minutes)"
          value={timeout}
          onChange={(e) => setTimeout(parseInt(e.target.value, 10))}
          inputProps={{ min: 5, max: 120 }}
          helperText="Maximum time allowed for a single update"
          margin="normal"
        />
        
        <TextField
          fullWidth
          type="number"
          label="Retry Count"
          value={retryCount}
          onChange={(e) => setRetryCount(parseInt(e.target.value, 10))}
          inputProps={{ min: 0, max: 10 }}
          helperText="Number of retry attempts for failed operations"
          margin="normal"
        />
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FirmwareSettingsDialog;
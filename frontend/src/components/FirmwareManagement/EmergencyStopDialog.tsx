/**
 * Emergency Stop Dialog Component
 * Safety-critical interface for emergency stop control
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  AlertTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Checkbox,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Emergency as EmergencyIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

interface UpdateSession {
  session_id: string;
  device_id: string;
  state: string;
  progress: number;
  source_version: string;
  target_version: string;
}

interface EmergencyStopDialogProps {
  open: boolean;
  onClose: () => void;
  emergencyStopActive: boolean;
  onTriggerStop: () => void;
  onClearStop: () => void;
  activeSessions: UpdateSession[];
}

const EmergencyStopDialog: React.FC<EmergencyStopDialogProps> = ({
  open,
  onClose,
  emergencyStopActive,
  onTriggerStop,
  onClearStop,
  activeSessions = [],
}) => {
  const [confirmTrigger, setConfirmTrigger] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleTriggerStop = () => {
    onTriggerStop();
    setConfirmTrigger(false);
    onClose();
  };

  const handleClearStop = () => {
    onClearStop();
    setConfirmClear(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <EmergencyIcon color="error" />
          <Typography variant="h6">
            Emergency Stop Control
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {emergencyStopActive ? (
          // Emergency Stop Active State
          <>
            <Alert severity="error" icon={<WarningIcon />} sx={{ mb: 3 }}>
              <AlertTitle>Emergency Stop is ACTIVE</AlertTitle>
              All firmware updates have been halted. No new updates can be started
              until the emergency stop is cleared.
            </Alert>

            <Typography variant="h6" gutterBottom>
              Safety Checklist Before Clearing
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Ensure all the following conditions are met before clearing the emergency stop:
              </Typography>
              
              <Box sx={{ pl: 2, mt: 2 }}>
                <Typography variant="body2" display="flex" alignItems="center" gap={1}>
                  <CheckIcon color="success" fontSize="small" />
                  All devices are in a safe state
                </Typography>
                <Typography variant="body2" display="flex" alignItems="center" gap={1}>
                  <CheckIcon color="success" fontSize="small" />
                  Root cause of emergency has been identified
                </Typography>
                <Typography variant="body2" display="flex" alignItems="center" gap={1}>
                  <CheckIcon color="success" fontSize="small" />
                  Corrective actions have been taken
                </Typography>
                <Typography variant="body2" display="flex" alignItems="center" gap={1}>
                  <CheckIcon color="success" fontSize="small" />
                  System diagnostics show normal operation
                </Typography>
                <Typography variant="body2" display="flex" alignItems="center" gap={1}>
                  <CheckIcon color="success" fontSize="small" />
                  All team members have been notified
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />

            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmClear}
                  onChange={(e) => setConfirmClear(e.target.checked)}
                  color="primary"
                />
              }
              label="I confirm that all safety conditions have been verified and it is safe to resume operations"
            />
          </>
        ) : (
          // Emergency Stop Inactive State
          <>
            <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
              <AlertTitle>Trigger Emergency Stop?</AlertTitle>
              This will immediately halt all firmware update operations across all devices.
              Use only in emergency situations.
            </Alert>

            {activeSessions.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom>
                  Active Update Sessions to be Halted
                </Typography>
                
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Device ID</TableCell>
                        <TableCell>Update Progress</TableCell>
                        <TableCell>Version</TableCell>
                        <TableCell>State</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeSessions.map((session) => (
                        <TableRow key={session.session_id}>
                          <TableCell>{session.device_id}</TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <LinearProgress
                                variant="determinate"
                                value={session.progress}
                                sx={{ width: 100, height: 6 }}
                              />
                              <Typography variant="caption">
                                {Math.round(session.progress)}%
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {session.source_version} → {session.target_version}
                          </TableCell>
                          <TableCell>{session.state}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            <Typography variant="h6" gutterBottom>
              Effects of Emergency Stop
            </Typography>
            
            <Box sx={{ pl: 2, mb: 3 }}>
              <Typography variant="body2" color="error" gutterBottom>
                • All active firmware updates will be immediately halted
              </Typography>
              <Typography variant="body2" color="error" gutterBottom>
                • Devices may be left in an intermediate state
              </Typography>
              <Typography variant="body2" color="error" gutterBottom>
                • Manual intervention may be required to recover devices
              </Typography>
              <Typography variant="body2" color="error" gutterBottom>
                • No new updates can be started until emergency stop is cleared
              </Typography>
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmTrigger}
                  onChange={(e) => setConfirmTrigger(e.target.checked)}
                  color="error"
                />
              }
              label="I understand the consequences and want to trigger emergency stop"
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        
        {emergencyStopActive ? (
          <Button
            onClick={handleClearStop}
            color="success"
            variant="contained"
            disabled={!confirmClear}
          >
            Clear Emergency Stop
          </Button>
        ) : (
          <Button
            onClick={handleTriggerStop}
            color="error"
            variant="contained"
            disabled={!confirmTrigger}
            startIcon={<EmergencyIcon />}
          >
            Trigger Emergency Stop
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EmergencyStopDialog;
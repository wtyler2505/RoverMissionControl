import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Block as BlockIcon,
  CheckCircle as AllowIcon,
  Info as InfoIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  DateRange as DateIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useSnackbar } from 'notistack';
import { corsService } from '../../services/corsService';
import {
  CORSPolicy,
  CORSViolation,
  CORSViolationFilters
} from '../../types/cors';

interface CORSViolationsProps {
  policies: CORSPolicy[];
}

interface ViolationDetailsDialogProps {
  violation: CORSViolation | null;
  open: boolean;
  onClose: () => void;
}

function ViolationDetailsDialog({ violation, open, onClose }: ViolationDetailsDialogProps) {
  if (!violation) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Violation Details</DialogTitle>
      <DialogContent>
        <List>
          <ListItem>
            <ListItemText
              primary="Timestamp"
              secondary={new Date(violation.timestamp).toLocaleString()}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Origin"
              secondary={violation.origin}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Method"
              secondary={violation.method}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Path"
              secondary={violation.path}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Violation Type"
              secondary={violation.violation_type}
            />
          </ListItem>
          {violation.ip_address && (
            <ListItem>
              <ListItemText
                primary="IP Address"
                secondary={violation.ip_address}
              />
            </ListItem>
          )}
          {violation.api_key_id && (
            <ListItem>
              <ListItemText
                primary="API Key"
                secondary={violation.api_key_id}
              />
            </ListItem>
          )}
        </List>

        {violation.violation_details && Object.keys(violation.violation_details).length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Additional Details
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
              <Typography variant="body2" component="pre">
                {JSON.stringify(violation.violation_details, null, 2)}
              </Typography>
            </Paper>
          </>
        )}

        {violation.override_reason && (
          <>
            <Divider sx={{ my: 2 }} />
            <Alert severity="info">
              <Typography variant="subtitle2">Override Reason</Typography>
              <Typography variant="body2">{violation.override_reason}</Typography>
            </Alert>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export const CORSViolations: React.FC<CORSViolationsProps> = ({ policies }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [violations, setViolations] = useState<CORSViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedViolation, setSelectedViolation] = useState<CORSViolation | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<CORSViolationFilters>({
    limit: 100
  });
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    loadViolations();
  }, [filters]);

  const loadViolations = async () => {
    try {
      setLoading(true);
      const data = await corsService.getViolations(filters);
      setViolations(data);
    } catch (error: any) {
      enqueueSnackbar('Failed to load CORS violations', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof CORSViolationFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDateRangeChange = () => {
    setFilters(prev => ({
      ...prev,
      start_date: startDate?.toISOString(),
      end_date: endDate?.toISOString()
    }));
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getViolationSeverity = (violation: CORSViolation) => {
    if (!violation.was_blocked) return 'info';
    if (violation.violation_type === 'origin_not_allowed') return 'error';
    if (violation.violation_type === 'method_not_allowed') return 'warning';
    return 'default';
  };

  const getViolationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'origin_not_allowed': 'Origin Not Allowed',
      'method_not_allowed': 'Method Not Allowed',
      'header_not_allowed': 'Header Not Allowed',
      'credentials_not_allowed': 'Credentials Not Allowed',
      'preflight_failed': 'Preflight Failed'
    };
    return labels[type] || type;
  };

  // Stats
  const totalViolations = violations.length;
  const blockedViolations = violations.filter(v => v.was_blocked).length;
  const uniqueOrigins = new Set(violations.map(v => v.origin)).size;
  const violationsByType = violations.reduce((acc, v) => {
    acc[v.violation_type] = (acc[v.violation_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Stats Cards */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Violations
                </Typography>
                <Typography variant="h4">
                  {totalViolations}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Blocked Requests
                </Typography>
                <Typography variant="h4" color="error">
                  {blockedViolations}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Unique Origins
                </Typography>
                <Typography variant="h4">
                  {uniqueOrigins}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Most Common
                </Typography>
                <Typography variant="body1">
                  {Object.entries(violationsByType)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 1)
                    .map(([type]) => getViolationTypeLabel(type))[0] || 'None'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <FilterIcon />
              <Typography variant="h6">Filters</Typography>
            </Box>
            
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Policy</InputLabel>
                  <Select
                    value={filters.policy_id || ''}
                    label="Policy"
                    onChange={(e) => handleFilterChange('policy_id', e.target.value || undefined)}
                  >
                    <MenuItem value="">All Policies</MenuItem>
                    {policies.map(policy => (
                      <MenuItem key={policy.id} value={policy.id}>
                        {policy.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <DateTimePicker
                  label="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <DateTimePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.was_blocked ?? ''}
                    label="Status"
                    onChange={(e) => handleFilterChange('was_blocked', 
                      e.target.value === '' ? undefined : e.target.value === 'true'
                    )}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Blocked</MenuItem>
                    <MenuItem value="false">Allowed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={1}>
                <Button
                  variant="outlined"
                  startIcon={<DateIcon />}
                  onClick={handleDateRangeChange}
                  disabled={!startDate && !endDate}
                  fullWidth
                >
                  Apply
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Violations Table */}
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Violations</Typography>
              <IconButton onClick={loadViolations} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Box>

            {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : violations.length === 0 ? (
              <Alert severity="info">
                No violations found for the selected criteria
              </Alert>
            ) : (
              <>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Origin</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Path</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="center">Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {violations
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((violation) => (
                          <TableRow key={violation.id}>
                            <TableCell>
                              {new Date(violation.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {violation.origin}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={violation.method}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontFamily: 'monospace',
                                  maxWidth: 200,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {violation.path}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={getViolationTypeLabel(violation.violation_type)}
                                size="small"
                                color={getViolationSeverity(violation) as any}
                              />
                            </TableCell>
                            <TableCell align="center">
                              {violation.was_blocked ? (
                                <Tooltip title="Blocked">
                                  <BlockIcon color="error" />
                                </Tooltip>
                              ) : (
                                <Tooltip title="Allowed (Override)">
                                  <AllowIcon color="success" />
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell>
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setSelectedViolation(violation);
                                    setDetailsOpen(true);
                                  }}
                                >
                                  <InfoIcon />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={violations.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Violation Details Dialog */}
        <ViolationDetailsDialog
          violation={selectedViolation}
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
        />
      </Box>
    </LocalizationProvider>
  );
};
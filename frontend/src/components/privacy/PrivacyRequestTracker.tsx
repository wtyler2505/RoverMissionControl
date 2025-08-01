/**
 * Privacy Request Tracking Component
 * Manages data subject rights requests for GDPR compliance reporting
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Alert,
  AlertTitle,
  LinearProgress,
  Tabs,
  Tab,
  Tooltip,
  Badge,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Timeline as TimelineIcon,
  Assignment as RequestIcon,
  CheckCircle as CompleteIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { format, parseISO, differenceInHours, differenceInDays } from 'date-fns';

// Types
interface PrivacyRequest {
  request_id: string;
  request_type: string;
  user_id: string;
  submitted_at: string;
  status: string;
  completed_at?: string;
  response_time_hours?: number;
  complexity_level: string;
  data_categories_involved: string[];
  third_parties_contacted: string[];
  notes?: string;
}

interface NewPrivacyRequest {
  request_type: string;
  user_id: string;
  complexity_level: string;
  data_categories: string[];
  third_parties: string[];
  notes: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const REQUEST_TYPES = [
  { value: 'access', label: 'Right of Access (Article 15)', icon: '👁️' },
  { value: 'rectification', label: 'Right to Rectification (Article 16)', icon: '✏️' },
  { value: 'deletion', label: 'Right to Erasure (Article 17)', icon: '🗑️' },
  { value: 'restriction', label: 'Right to Restriction (Article 18)', icon: '⏸️' },
  { value: 'portability', label: 'Right to Data Portability (Article 20)', icon: '📤' },
  { value: 'objection', label: 'Right to Object (Article 21)', icon: '🚫' }
];

const COMPLEXITY_LEVELS = [
  { value: 'simple', label: 'Simple', description: 'Straightforward request, minimal data involved' },
  { value: 'moderate', label: 'Moderate', description: 'Multiple systems or data types involved' },
  { value: 'complex', label: 'Complex', description: 'Extensive data review, multiple third parties' }
];

const DATA_CATEGORIES = [
  'Personal Identifiers',
  'Contact Information',
  'Usage Data',
  'Technical Data',
  'Communication Records',
  'Preference Settings',
  'Alert Configurations',
  'System Logs',
  'Error Reports',
  'Performance Metrics'
];

const THIRD_PARTIES = [
  'Email Service Provider',
  'SMS Gateway',
  'Cloud Storage Provider',
  'Analytics Service',
  'CDN Provider',
  'Backup Service',
  'Monitoring Service'
];

const PrivacyRequestTracker: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PrivacyRequest | null>(null);
  
  // Form state for new request
  const [newRequest, setNewRequest] = useState<NewPrivacyRequest>({
    request_type: '',
    user_id: '',
    complexity_level: 'simple',
    data_categories: [],
    third_parties: [],
    notes: ''
  });

  // Status update state
  const [statusUpdate, setStatusUpdate] = useState({
    status: '',
    notes: ''
  });

  // Fetch privacy requests (mock data for now)
  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Mock data - in real implementation, this would fetch from API
      const mockRequests: PrivacyRequest[] = [
        {
          request_id: '1',
          request_type: 'access',
          user_id: 'user123@example.com',
          submitted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'completed',
          completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          response_time_hours: 24,
          complexity_level: 'simple',
          data_categories_involved: ['Personal Identifiers', 'Contact Information'],
          third_parties_contacted: [],
          notes: 'Standard data access request completed successfully'
        },
        {
          request_id: '2',
          request_type: 'deletion',
          user_id: 'user456@example.com',
          submitted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'in_progress',
          complexity_level: 'moderate',
          data_categories_involved: ['Personal Identifiers', 'Usage Data', 'Alert Configurations'],
          third_parties_contacted: ['Email Service Provider'],
          notes: 'User requesting complete account deletion'
        },
        {
          request_id: '3',
          request_type: 'portability',
          user_id: 'user789@example.com',
          submitted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          complexity_level: 'complex',
          data_categories_involved: ['Personal Identifiers', 'Usage Data', 'System Logs', 'Performance Metrics'],
          third_parties_contacted: ['Cloud Storage Provider', 'Analytics Service'],
          notes: 'Large dataset requiring comprehensive export'
        }
      ];
      
      setRequests(mockRequests);
    } catch (err) {
      setError('Failed to fetch privacy requests');
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async () => {
    try {
      const response = await fetch('/api/compliance/privacy-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRequest)
      });

      if (!response.ok) throw new Error('Failed to create request');

      const result = await response.json();
      
      // Add to local state (in real app, would refetch or update state properly)
      const newRequestData: PrivacyRequest = {
        request_id: result.request_id,
        ...newRequest,
        submitted_at: new Date().toISOString(),
        status: 'pending',
        data_categories_involved: newRequest.data_categories,
        third_parties_contacted: newRequest.third_parties
      };
      
      setRequests(prev => [newRequestData, ...prev]);
      setCreateDialog(false);
      resetForm();

    } catch (err) {
      setError('Failed to create privacy request');
    }
  };

  const updateRequestStatus = async (requestId: string) => {
    try {
      const response = await fetch(`/api/compliance/privacy-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusUpdate)
      });

      if (!response.ok) throw new Error('Failed to update request');

      // Update local state
      setRequests(prev => prev.map(req => 
        req.request_id === requestId 
          ? { 
              ...req, 
              status: statusUpdate.status,
              notes: statusUpdate.notes,
              completed_at: statusUpdate.status === 'completed' ? new Date().toISOString() : undefined,
              response_time_hours: statusUpdate.status === 'completed' 
                ? differenceInHours(new Date(), parseISO(req.submitted_at))
                : undefined
            }
          : req
      ));

      setEditDialog(false);
      setSelectedRequest(null);

    } catch (err) {
      setError('Failed to update request status');
    }
  };

  const resetForm = () => {
    setNewRequest({
      request_type: '',
      user_id: '',
      complexity_level: 'simple',
      data_categories: [],
      third_parties: [],
      notes: ''
    });
  };

  const getStatusColor = (status: string): 'default' | 'info' | 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getComplexityColor = (complexity: string): 'success' | 'warning' | 'error' => {
    switch (complexity) {
      case 'simple': return 'success';
      case 'moderate': return 'warning';
      case 'complex': return 'error';
      default: return 'warning';
    }
  };

  const getResponseTimeStatus = (request: PrivacyRequest): { color: string; message: string } => {
    const hoursElapsed = differenceInHours(new Date(), parseISO(request.submitted_at));
    const daysElapsed = differenceInDays(new Date(), parseISO(request.submitted_at));
    
    if (request.status === 'completed') {
      const responseTime = request.response_time_hours || hoursElapsed;
      if (responseTime <= 720) { // 30 days
        return { color: 'success', message: `Completed in ${Math.round(responseTime)}h` };
      } else {
        return { color: 'error', message: `Completed in ${Math.round(responseTime)}h (overdue)` };
      }
    }
    
    if (daysElapsed >= 30) {
      return { color: 'error', message: `${daysElapsed} days - OVERDUE` };
    } else if (daysElapsed >= 20) {
      return { color: 'warning', message: `${daysElapsed} days - due soon` };
    } else {
      return { color: 'info', message: `${daysElapsed} days elapsed` };
    }
  };

  const renderRequestsTable = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Request ID</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>User</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Complexity</TableCell>
            <TableCell>Submitted</TableCell>
            <TableCell>Response Time</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {requests.map((request) => {
            const responseTimeStatus = getResponseTimeStatus(request);
            const requestType = REQUEST_TYPES.find(t => t.value === request.request_type);
            
            return (
              <TableRow key={request.request_id}>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {request.request_id.substring(0, 8)}...
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title={requestType?.label || request.request_type}>
                    <Chip
                      label={`${requestType?.icon || '📋'} ${request.request_type}`}
                      size="small"
                      variant="outlined"
                    />
                  </Tooltip>
                </TableCell>
                <TableCell>{request.user_id}</TableCell>
                <TableCell>
                  <Chip
                    label={request.status.replace('_', ' ').toUpperCase()}
                    color={getStatusColor(request.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={request.complexity_level.toUpperCase()}
                    color={getComplexityColor(request.complexity_level)}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {format(parseISO(request.submitted_at), 'MMM dd, yyyy')}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {format(parseISO(request.submitted_at), 'HH:mm')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={responseTimeStatus.message}
                    color={responseTimeStatus.color as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={1}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedRequest(request);
                          setViewDialog(true);
                        }}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Update Status">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedRequest(request);
                          setStatusUpdate({ status: request.status, notes: request.notes || '' });
                          setEditDialog(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderRequestOverview = () => {
    const totalRequests = requests.length;
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    const inProgressRequests = requests.filter(r => r.status === 'in_progress').length;
    const completedRequests = requests.filter(r => r.status === 'completed').length;
    const overdueRequests = requests.filter(r => {
      const daysElapsed = differenceInDays(new Date(), parseISO(r.submitted_at));
      return r.status !== 'completed' && daysElapsed >= 30;
    }).length;

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Requests
                  </Typography>
                  <Typography variant="h4">{totalRequests}</Typography>
                </Box>
                <RequestIcon color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Pending
                  </Typography>
                  <Typography variant="h4" color="warning.main">{pendingRequests}</Typography>
                </Box>
                <ScheduleIcon color="warning" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    In Progress
                  </Typography>
                  <Typography variant="h4" color="info.main">{inProgressRequests}</Typography>
                </Box>
                <TimelineIcon color="info" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Completed
                  </Typography>
                  <Typography variant="h4" color="success.main">{completedRequests}</Typography>
                </Box>
                <CompleteIcon color="success" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Overdue
                  </Typography>
                  <Typography variant="h4" color="error.main">{overdueRequests}</Typography>
                </Box>
                <WarningIcon color="error" />
              </Box>
              {overdueRequests > 0 && (
                <LinearProgress color="error" sx={{ mt: 1 }} />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Privacy Request Tracker</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialog(true)}
        >
          New Request
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {renderRequestOverview()}

      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="All Requests" />
        <Tab label={<Badge badgeContent={requests.filter(r => r.status === 'pending').length} color="warning">Pending</Badge>} />
        <Tab label={<Badge badgeContent={requests.filter(r => r.status === 'in_progress').length} color="info">In Progress</Badge>} />
        <Tab label="Completed" />
      </Tabs>

      <TabPanel value={activeTab} index={0}>
        {renderRequestsTable()}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {renderRequestsTable()}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {renderRequestsTable()}
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        {renderRequestsTable()}
      </TabPanel>

      {/* Create Request Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Privacy Request</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Request Type</InputLabel>
                <Select
                  value={newRequest.request_type}
                  onChange={(e) => setNewRequest({...newRequest, request_type: e.target.value})}
                  label="Request Type"
                >
                  {REQUEST_TYPES.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="User ID / Email"
                value={newRequest.user_id}
                onChange={(e) => setNewRequest({...newRequest, user_id: e.target.value})}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Complexity Level</InputLabel>
                <Select
                  value={newRequest.complexity_level}
                  onChange={(e) => setNewRequest({...newRequest, complexity_level: e.target.value})}
                  label="Complexity Level"
                >
                  {COMPLEXITY_LEVELS.map(level => (
                    <MenuItem key={level.value} value={level.value}>
                      {level.label} - {level.description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Data Categories</InputLabel>
                <Select
                  multiple
                  value={newRequest.data_categories}
                  onChange={(e) => setNewRequest({...newRequest, data_categories: e.target.value as string[]})}
                  label="Data Categories"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {DATA_CATEGORIES.map(category => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={newRequest.notes}
                onChange={(e) => setNewRequest({...newRequest, notes: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button onClick={createRequest} variant="contained">Create Request</Button>
        </DialogActions>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Request Status</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusUpdate.status}
                  onChange={(e) => setStatusUpdate({...statusUpdate, status: e.target.value})}
                  label="Status"
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={statusUpdate.notes}
                onChange={(e) => setStatusUpdate({...statusUpdate, notes: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button 
            onClick={() => selectedRequest && updateRequestStatus(selectedRequest.request_id)}
            variant="contained"
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Request Dialog */}
      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Request Details</DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Request ID</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>{selectedRequest.request_id}</Typography>
                  
                  <Typography variant="subtitle2">Type</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {REQUEST_TYPES.find(t => t.value === selectedRequest.request_type)?.label}
                  </Typography>
                  
                  <Typography variant="subtitle2">User</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>{selectedRequest.user_id}</Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Status</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      label={selectedRequest.status.replace('_', ' ').toUpperCase()}
                      color={getStatusColor(selectedRequest.status)}
                    />
                  </Box>
                  
                  <Typography variant="subtitle2">Submitted</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {format(parseISO(selectedRequest.submitted_at), 'PPpp')}
                  </Typography>
                  
                  <Typography variant="subtitle2">Complexity</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      label={selectedRequest.complexity_level.toUpperCase()}
                      color={getComplexityColor(selectedRequest.complexity_level)}
                    />
                  </Box>
                </Grid>
              </Grid>
              
              <Typography variant="subtitle2" sx={{ mt: 2 }}>Data Categories</Typography>
              <Box display="flex" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {selectedRequest.data_categories_involved.map(category => (
                  <Chip key={category} label={category} size="small" variant="outlined" />
                ))}
              </Box>
              
              {selectedRequest.third_parties_contacted.length > 0 && (
                <>
                  <Typography variant="subtitle2">Third Parties Contacted</Typography>
                  <Box display="flex" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                    {selectedRequest.third_parties_contacted.map(party => (
                      <Chip key={party} label={party} size="small" color="info" variant="outlined" />
                    ))}
                  </Box>
                </>
              )}
              
              {selectedRequest.notes && (
                <>
                  <Typography variant="subtitle2">Notes</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>{selectedRequest.notes}</Typography>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PrivacyRequestTracker;
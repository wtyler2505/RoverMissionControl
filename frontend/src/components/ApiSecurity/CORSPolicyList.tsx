import React, { useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Typography,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Switch,
  FormControlLabel,
  TableSortLabel,
  Collapse,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Public as PublicIcon,
  Link as EndpointIcon,
  Key as KeyIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon
} from '@mui/icons-material';
import { CORSPolicy, CORSPolicyType, CORSPolicyFilters } from '../../types/cors';
import { useSnackbar } from 'notistack';
import { corsService } from '../../services/corsService';

interface CORSPolicyListProps {
  policies: CORSPolicy[];
  onEdit: (policy: CORSPolicy) => void;
  onDelete: (policyId: string) => void;
  onRefresh: () => void;
}

interface ExpandableRowProps {
  policy: CORSPolicy;
  onEdit: (policy: CORSPolicy) => void;
  onDelete: (policyId: string) => void;
}

function ExpandableRow({ policy, onEdit, onDelete }: ExpandableRowProps) {
  const [open, setOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleCopyId = () => {
    navigator.clipboard.writeText(policy.id);
    enqueueSnackbar('Policy ID copied to clipboard', { variant: 'success' });
  };

  const getPolicyTypeIcon = (type: CORSPolicyType) => {
    switch (type) {
      case CORSPolicyType.GLOBAL:
        return <PublicIcon fontSize="small" />;
      case CORSPolicyType.ENDPOINT:
        return <EndpointIcon fontSize="small" />;
      case CORSPolicyType.API_KEY:
        return <KeyIcon fontSize="small" />;
    }
  };

  const getPolicyTypeColor = (type: CORSPolicyType) => {
    switch (type) {
      case CORSPolicyType.GLOBAL:
        return 'primary';
      case CORSPolicyType.ENDPOINT:
        return 'secondary';
      case CORSPolicyType.API_KEY:
        return 'default';
    }
  };

  const formatArrayDisplay = (arr?: string[], allowAll?: boolean) => {
    if (allowAll) return 'All';
    if (!arr || arr.length === 0) return 'None';
    if (arr.length <= 3) return arr.join(', ');
    return `${arr.slice(0, 3).join(', ')} +${arr.length - 3} more`;
  };

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" fontWeight="medium">
              {policy.name}
            </Typography>
            {policy.is_active ? (
              <ActiveIcon color="success" fontSize="small" />
            ) : (
              <InactiveIcon color="error" fontSize="small" />
            )}
          </Box>
          {policy.description && (
            <Typography variant="caption" color="textSecondary">
              {policy.description}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Chip
            icon={getPolicyTypeIcon(policy.policy_type)}
            label={policy.policy_type}
            size="small"
            color={getPolicyTypeColor(policy.policy_type)}
          />
        </TableCell>
        <TableCell>
          {policy.endpoint_pattern || policy.api_key_id || '-'}
        </TableCell>
        <TableCell align="center">
          <Typography variant="caption">{policy.priority}</Typography>
        </TableCell>
        <TableCell>
          {formatArrayDisplay(policy.allowed_origins, policy.allow_all_origins)}
        </TableCell>
        <TableCell>
          {formatArrayDisplay(policy.allowed_methods, policy.allow_all_methods)}
        </TableCell>
        <TableCell align="center">
          <Chip
            label={policy.allow_credentials ? 'Yes' : 'No'}
            size="small"
            color={policy.allow_credentials ? 'warning' : 'default'}
          />
        </TableCell>
        <TableCell>
          <Box display="flex" gap={0.5}>
            <Tooltip title="Edit Policy">
              <IconButton
                size="small"
                onClick={() => onEdit(policy)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copy ID">
              <IconButton
                size="small"
                onClick={handleCopyId}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Policy">
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  if (window.confirm(`Delete policy "${policy.name}"?`)) {
                    onDelete(policy.id);
                  }
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Allowed Headers
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {formatArrayDisplay(policy.allowed_headers, policy.allow_all_headers)}
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Exposed Headers
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {formatArrayDisplay(policy.expose_headers)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Configuration Details
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="Max Age"
                        secondary={`${policy.max_age} seconds`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Origin Validation"
                        secondary={policy.validate_origin_regex ? 'Regex' : 'Exact Match'}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Case Sensitive"
                        secondary={policy.case_sensitive_origins ? 'Yes' : 'No'}
                      />
                    </ListItem>
                    {policy.last_tested_at && (
                      <ListItem>
                        <ListItemText
                          primary="Last Tested"
                          secondary={new Date(policy.last_tested_at).toLocaleString()}
                        />
                      </ListItem>
                    )}
                  </List>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export const CORSPolicyList: React.FC<CORSPolicyListProps> = ({
  policies,
  onEdit,
  onDelete,
  onRefresh
}) => {
  const [filters, setFilters] = useState<CORSPolicyFilters>({});
  const [orderBy, setOrderBy] = useState<keyof CORSPolicy>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const handleFilterChange = (key: keyof CORSPolicyFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSort = (property: keyof CORSPolicy) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const filteredPolicies = policies.filter(policy => {
    if (filters.policy_type && policy.policy_type !== filters.policy_type) {
      return false;
    }
    if (filters.is_active !== undefined && policy.is_active !== filters.is_active) {
      return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        policy.name.toLowerCase().includes(searchLower) ||
        (policy.description && policy.description.toLowerCase().includes(searchLower)) ||
        (policy.endpoint_pattern && policy.endpoint_pattern.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  const sortedPolicies = [...filteredPolicies].sort((a, b) => {
    const aValue = a[orderBy];
    const bValue = b[orderBy];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return order === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <Box>
      {/* Filters */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Search"
            placeholder="Search by name, description, or pattern..."
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            size="small"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Policy Type</InputLabel>
            <Select
              value={filters.policy_type || ''}
              label="Policy Type"
              onChange={(e) => handleFilterChange('policy_type', e.target.value || undefined)}
            >
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value={CORSPolicyType.GLOBAL}>Global</MenuItem>
              <MenuItem value={CORSPolicyType.ENDPOINT}>Endpoint</MenuItem>
              <MenuItem value={CORSPolicyType.API_KEY}>API Key</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControlLabel
            control={
              <Switch
                checked={filters.is_active ?? true}
                onChange={(e) => handleFilterChange('is_active', e.target.checked)}
              />
            }
            label="Active Only"
          />
        </Grid>
      </Grid>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={50} />
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Policy Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={orderBy === 'priority'}
                  direction={orderBy === 'priority' ? order : 'asc'}
                  onClick={() => handleSort('priority')}
                >
                  Priority
                </TableSortLabel>
              </TableCell>
              <TableCell>Origins</TableCell>
              <TableCell>Methods</TableCell>
              <TableCell align="center">Credentials</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedPolicies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="textSecondary" py={3}>
                    No policies found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedPolicies.map((policy) => (
                <ExpandableRow
                  key={policy.id}
                  policy={policy}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Summary */}
      <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" color="textSecondary">
          Showing {sortedPolicies.length} of {policies.length} policies
        </Typography>
      </Box>
    </Box>
  );
};
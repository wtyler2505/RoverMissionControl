import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  IconButton,
  Chip,
  Tooltip,
  Typography,
  Switch,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  SelectChangeEvent
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Timelapse as TimelapseIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import { RateLimitPolicy } from '../../services/rateLimitService';
import { useSnackbar } from 'notistack';
import { rateLimitService } from '../../services/rateLimitService';

interface RateLimitPolicyListProps {
  policies: RateLimitPolicy[];
  onEdit: (policy: RateLimitPolicy) => void;
  onDelete: (policyId: string) => void;
  onRefresh: () => void;
}

export const RateLimitPolicyList: React.FC<RateLimitPolicyListProps> = ({
  policies,
  onEdit,
  onDelete,
  onRefresh
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTarget, setFilterTarget] = useState<string>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<RateLimitPolicy | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const handleToggleActive = async (policy: RateLimitPolicy) => {
    try {
      await rateLimitService.updatePolicy(policy.id, {
        isActive: !policy.isActive
      });
      enqueueSnackbar(
        `Policy ${policy.isActive ? 'deactivated' : 'activated'} successfully`,
        { variant: 'success' }
      );
      onRefresh();
    } catch (error: any) {
      enqueueSnackbar('Failed to update policy status', { variant: 'error' });
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, policy: RateLimitPolicy) => {
    setAnchorEl(event.currentTarget);
    setSelectedPolicy(policy);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPolicy(null);
  };

  const handleDuplicate = async () => {
    if (selectedPolicy) {
      try {
        const newPolicy = { ...selectedPolicy };
        delete (newPolicy as any).id;
        newPolicy.name = `${selectedPolicy.name} (Copy)`;
        newPolicy.isActive = false;
        
        await rateLimitService.createPolicy(newPolicy);
        enqueueSnackbar('Policy duplicated successfully', { variant: 'success' });
        onRefresh();
      } catch (error: any) {
        enqueueSnackbar('Failed to duplicate policy', { variant: 'error' });
      }
    }
    handleMenuClose();
  };

  const getTargetDisplay = (policy: RateLimitPolicy) => {
    const icons: Record<string, string> = {
      'global': '🌍',
      'api_key': '🔑',
      'user': '👤',
      'endpoint': '🔗',
      'ip_address': '🌐'
    };
    
    return (
      <Box display="flex" alignItems="center">
        <Typography variant="body2" sx={{ mr: 1 }}>
          {icons[policy.targetType] || '❓'}
        </Typography>
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {policy.targetType.replace('_', ' ').toUpperCase()}
          </Typography>
          {policy.targetValue && (
            <Typography variant="caption" color="textSecondary">
              {policy.targetValue}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  const getWindowDisplay = (window: string) => {
    const icons: Record<string, string> = {
      'minute': '⏱️',
      'hour': '⏰',
      'day': '📅',
      'week': '📆',
      'month': '🗓️'
    };
    
    return `${icons[window] || '❓'} ${window}`;
  };

  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (policy.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterTarget === 'all' || policy.targetType === filterTarget;
    return matchesSearch && matchesFilter;
  });

  const paginatedPolicies = filteredPolicies.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      {/* Filters */}
      <Box display="flex" gap={2} mb={2}>
        <TextField
          placeholder="Search policies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select
            value={filterTarget}
            onChange={(e: SelectChangeEvent) => setFilterTarget(e.target.value)}
            displayEmpty
            startAdornment={<FilterIcon sx={{ mr: 1 }} />}
          >
            <MenuItem value="all">All Targets</MenuItem>
            <MenuItem value="global">Global</MenuItem>
            <MenuItem value="api_key">API Key</MenuItem>
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="endpoint">Endpoint</MenuItem>
            <MenuItem value="ip_address">IP Address</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Policy Name</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Limit</TableCell>
              <TableCell>Window</TableCell>
              <TableCell>Burst</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedPolicies.map((policy) => (
              <TableRow key={policy.id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {policy.name}
                    </Typography>
                    {policy.description && (
                      <Typography variant="caption" color="textSecondary">
                        {policy.description}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>{getTargetDisplay(policy)}</TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <SpeedIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {policy.limit} requests
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>{getWindowDisplay(policy.window)}</TableCell>
                <TableCell>
                  {policy.burstEnabled ? (
                    <Chip
                      label={`${policy.burstLimit} burst`}
                      size="small"
                      color="info"
                      variant="outlined"
                    />
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      Disabled
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={policy.priority}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={policy.isActive}
                    onChange={() => handleToggleActive(policy)}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => onEdit(policy)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, policy)}
                  >
                    <MoreIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {paginatedPolicies.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="textSecondary" py={3}>
                    {searchTerm || filterTarget !== 'all' 
                      ? 'No policies match your filters'
                      : 'No rate limit policies configured'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filteredPolicies.length}
        page={page}
        onPageChange={(e, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
      />

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleDuplicate}>
          Duplicate Policy
        </MenuItem>
        <MenuItem 
          onClick={() => {
            if (selectedPolicy) {
              onDelete(selectedPolicy.id);
            }
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          Delete Policy
        </MenuItem>
      </Menu>
    </Box>
  );
};
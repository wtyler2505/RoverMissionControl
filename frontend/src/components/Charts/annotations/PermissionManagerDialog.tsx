/**
 * Permission Manager Dialog Component
 * Manages annotation access control and sharing settings
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  IconButton,
  Tooltip,
  Avatar,
  Chip,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  MenuItem,
  InputAdornment,
  Alert,
  Autocomplete,
  Paper,
  Divider,
  FormGroup,
  Checkbox
} from '@mui/material';
import {
  Person as PersonIcon,
  Group as GroupIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  AccessTime as TimeIcon,
  AdminPanelSettings as AdminIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Share as ShareIcon
} from '@mui/icons-material';
import { format, addDays } from 'date-fns';
import { 
  EnhancedAnnotation, 
  AnnotationPermission,
  AnnotationUserPermission,
  AnnotationRolePermission
} from '../../../types/enterprise-annotations';
import useAnnotationStore from '../../../stores/annotationStore';

interface PermissionManagerDialogProps {
  open: boolean;
  onClose: () => void;
  annotation: EnhancedAnnotation;
  currentUserId: string;
  onUpdate: (permissions: AnnotationPermission) => void;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
}

interface RoleOption {
  id: string;
  name: string;
  description: string;
  color: string;
}

// Mock data - replace with actual API calls
const mockUsers: UserOption[] = [
  { id: 'user1', name: 'John Doe', email: 'john@rover.com', role: 'Engineer' },
  { id: 'user2', name: 'Jane Smith', email: 'jane@rover.com', role: 'Mission Control' },
  { id: 'user3', name: 'Bob Johnson', email: 'bob@rover.com', role: 'Analyst' },
  { id: 'user4', name: 'Alice Williams', email: 'alice@rover.com', role: 'Manager' }
];

const mockRoles: RoleOption[] = [
  { id: 'engineer', name: 'Engineers', description: 'Engineering team members', color: '#2196f3' },
  { id: 'mission_control', name: 'Mission Control', description: 'Mission control operators', color: '#4caf50' },
  { id: 'analyst', name: 'Analysts', description: 'Data analysts', color: '#ff9800' },
  { id: 'manager', name: 'Managers', description: 'Project managers', color: '#9c27b0' }
];

export const PermissionManagerDialog: React.FC<PermissionManagerDialogProps> = ({
  open,
  onClose,
  annotation,
  currentUserId,
  onUpdate
}) => {
  const { updatePermissions } = useAnnotationStore();
  
  const [permissions, setPermissions] = useState<AnnotationPermission>(
    annotation.permissions || {
      owner: annotation.createdBy,
      public: false,
      roles: {},
      users: {}
    }
  );
  
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [expirationDays, setExpirationDays] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isOwner = currentUserId === permissions.owner;

  const handleTogglePublic = () => {
    setPermissions({
      ...permissions,
      public: !permissions.public
    });
  };

  const handleAddUser = () => {
    if (!selectedUser) return;

    const newPermission: AnnotationUserPermission = {
      canView: true,
      canEdit: false,
      canDelete: false,
      canShare: false,
      expiresAt: expirationDays > 0 ? Date.now() + (expirationDays * 24 * 60 * 60 * 1000) : undefined
    };

    setPermissions({
      ...permissions,
      users: {
        ...permissions.users,
        [selectedUser.id]: newPermission
      }
    });

    setSelectedUser(null);
    setExpirationDays(0);
  };

  const handleAddRole = () => {
    if (!selectedRole) return;

    const newPermission: AnnotationRolePermission = {
      canView: true,
      canEdit: false,
      canDelete: false,
      canShare: false
    };

    setPermissions({
      ...permissions,
      roles: {
        ...permissions.roles,
        [selectedRole.id]: newPermission
      }
    });

    setSelectedRole(null);
  };

  const handleUpdateUserPermission = (
    userId: string, 
    field: keyof AnnotationUserPermission, 
    value: boolean
  ) => {
    setPermissions({
      ...permissions,
      users: {
        ...permissions.users,
        [userId]: {
          ...permissions.users[userId],
          [field]: value
        }
      }
    });
  };

  const handleUpdateRolePermission = (
    roleId: string, 
    field: keyof AnnotationRolePermission, 
    value: boolean
  ) => {
    setPermissions({
      ...permissions,
      roles: {
        ...permissions.roles,
        [roleId]: {
          ...permissions.roles[roleId],
          [field]: value
        }
      }
    });
  };

  const handleRemoveUser = (userId: string) => {
    const { [userId]: removed, ...rest } = permissions.users;
    setPermissions({
      ...permissions,
      users: rest
    });
  };

  const handleRemoveRole = (roleId: string) => {
    const { [roleId]: removed, ...rest } = permissions.roles;
    setPermissions({
      ...permissions,
      roles: rest
    });
  };

  const handleSave = () => {
    updatePermissions(annotation.id, permissions);
    onUpdate(permissions);
    onClose();
  };

  const getUserById = (userId: string) => 
    mockUsers.find(u => u.id === userId) || { id: userId, name: userId, email: '' };

  const getRoleById = (roleId: string) => 
    mockRoles.find(r => r.id === roleId) || { id: roleId, name: roleId, description: '', color: '#666' };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AdminIcon />
        Permission Manager
        {!isOwner && (
          <Chip 
            label="View Only" 
            size="small" 
            color="warning" 
            sx={{ ml: 'auto' }}
          />
        )}
      </DialogTitle>
      
      <DialogContent dividers>
        {!isOwner && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Only the annotation owner can modify permissions
          </Alert>
        )}

        {/* Public Access Toggle */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <FormControlLabel
            control={
              <Switch 
                checked={permissions.public} 
                onChange={handleTogglePublic}
                disabled={!isOwner}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {permissions.public ? <PublicIcon /> : <LockIcon />}
                <Box>
                  <Typography variant="subtitle1">
                    {permissions.public ? 'Public Access' : 'Private Access'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {permissions.public 
                      ? 'Anyone with chart access can view this annotation' 
                      : 'Only specified users and roles can access this annotation'}
                  </Typography>
                </Box>
              </Box>
            }
          />
        </Paper>

        {/* User Permissions */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon />
            User Permissions
          </Typography>
          
          {isOwner && (
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Autocomplete
                options={mockUsers.filter(u => 
                  !permissions.users[u.id] && u.id !== permissions.owner
                )}
                getOptionLabel={(option) => `${option.name} (${option.email})`}
                value={selectedUser}
                onChange={(_, value) => setSelectedUser(value)}
                sx={{ flex: 1 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="Add user"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      )
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                      {option.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{option.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.email} • {option.role}
                      </Typography>
                    </Box>
                  </Box>
                )}
              />
              
              <TextField
                type="number"
                size="small"
                label="Expires in (days)"
                value={expirationDays}
                onChange={(e) => setExpirationDays(parseInt(e.target.value) || 0)}
                sx={{ width: 150 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <TimeIcon />
                    </InputAdornment>
                  )
                }}
              />
              
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddUser}
                disabled={!selectedUser}
              >
                Add
              </Button>
            </Box>
          )}

          <List>
            {/* Owner */}
            <ListItem>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  {getUserById(permissions.owner).name.charAt(0)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={getUserById(permissions.owner).name}
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip label="Owner" size="small" color="primary" />
                    <Typography variant="caption" color="text.secondary">
                      Full access
                    </Typography>
                  </Box>
                }
              />
            </ListItem>

            <Divider variant="inset" component="li" />

            {/* Other users */}
            {Object.entries(permissions.users).map(([userId, userPerm]) => {
              const user = getUserById(userId);
              return (
                <ListItem key={userId}>
                  <ListItemAvatar>
                    <Avatar>{user.name.charAt(0)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name}
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <FormGroup row>
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={userPerm.canView}
                                onChange={(e) => handleUpdateUserPermission(userId, 'canView', e.target.checked)}
                                disabled={!isOwner}
                              />
                            }
                            label={<Typography variant="caption">View</Typography>}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={userPerm.canEdit}
                                onChange={(e) => handleUpdateUserPermission(userId, 'canEdit', e.target.checked)}
                                disabled={!isOwner}
                              />
                            }
                            label={<Typography variant="caption">Edit</Typography>}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={userPerm.canDelete}
                                onChange={(e) => handleUpdateUserPermission(userId, 'canDelete', e.target.checked)}
                                disabled={!isOwner}
                              />
                            }
                            label={<Typography variant="caption">Delete</Typography>}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={userPerm.canShare}
                                onChange={(e) => handleUpdateUserPermission(userId, 'canShare', e.target.checked)}
                                disabled={!isOwner}
                              />
                            }
                            label={<Typography variant="caption">Share</Typography>}
                          />
                        </FormGroup>
                        {userPerm.expiresAt && (
                          <Typography variant="caption" color="text.secondary">
                            Expires {format(userPerm.expiresAt, 'MMM d, yyyy')}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  {isOwner && (
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleRemoveUser(userId)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Role Permissions */}
        <Box>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupIcon />
            Role Permissions
          </Typography>
          
          {isOwner && (
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Autocomplete
                options={mockRoles.filter(r => !permissions.roles[r.id])}
                getOptionLabel={(option) => option.name}
                value={selectedRole}
                onChange={(_, value) => setSelectedRole(value)}
                sx={{ flex: 1 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="Add role"
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Chip 
                      size="small" 
                      sx={{ bgcolor: option.color, color: 'white', mr: 1 }}
                      label={option.name.charAt(0)}
                    />
                    <Box>
                      <Typography variant="body2">{option.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Box>
                  </Box>
                )}
              />
              
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddRole}
                disabled={!selectedRole}
              >
                Add
              </Button>
            </Box>
          )}

          <List>
            {Object.entries(permissions.roles).map(([roleId, rolePerm]) => {
              const role = getRoleById(roleId);
              return (
                <ListItem key={roleId}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: role.color }}>
                      <GroupIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={role.name}
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <FormGroup row>
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={rolePerm.canView}
                                onChange={(e) => handleUpdateRolePermission(roleId, 'canView', e.target.checked)}
                                disabled={!isOwner}
                              />
                            }
                            label={<Typography variant="caption">View</Typography>}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={rolePerm.canEdit}
                                onChange={(e) => handleUpdateRolePermission(roleId, 'canEdit', e.target.checked)}
                                disabled={!isOwner}
                              />
                            }
                            label={<Typography variant="caption">Edit</Typography>}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={rolePerm.canDelete}
                                onChange={(e) => handleUpdateRolePermission(roleId, 'canDelete', e.target.checked)}
                                disabled={!isOwner}
                              />
                            }
                            label={<Typography variant="caption">Delete</Typography>}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={rolePerm.canShare}
                                onChange={(e) => handleUpdateRolePermission(roleId, 'canShare', e.target.checked)}
                                disabled={!isOwner}
                              />
                            }
                            label={<Typography variant="caption">Share</Typography>}
                          />
                        </FormGroup>
                        <Typography variant="caption" color="text.secondary">
                          {role.description}
                        </Typography>
                      </Box>
                    }
                  />
                  {isOwner && (
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleRemoveRole(roleId)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              );
            })}
          </List>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {isOwner && (
          <Button variant="contained" onClick={handleSave}>
            Save Permissions
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PermissionManagerDialog;
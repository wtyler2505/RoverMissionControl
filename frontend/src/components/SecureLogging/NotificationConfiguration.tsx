/**
 * Notification Configuration Component
 * 
 * Manages notification rules, channels, and recipients for the secure logging system
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Grid,
  Card,
  CardContent,
  CardActions,
  Switch,
  FormControlLabel,
  FormGroup,
  Checkbox,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Webhook as WebhookIcon,
  Chat as SlackIcon,
  ExpandMore as ExpandMoreIcon,
  Notifications as NotificationIcon,
  Security as SecurityIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Check as CheckIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';

// Types
interface NotificationChannel {
  id: string;
  type: 'email' | 'sms' | 'webhook' | 'slack';
  name: string;
  config: Record<string, any>;
  isActive: boolean;
}

interface NotificationRule {
  id: string;
  name: string;
  description?: string;
  event_types: string[];
  severity_levels: string[];
  channels: string[];
  recipients: Record<string, string[]>;
  template_id: string;
  cooldown_minutes: number;
  max_notifications_per_hour: number;
  escalation_delay_minutes?: number;
  escalation_channels?: string[];
  conditions?: Record<string, any>;
  is_active: boolean;
}

interface NotificationTemplate {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
}

const NotificationConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  
  // Dialog states
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  
  // Form states
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);

  // Load configuration
  useEffect(() => {
    // Load channels, rules, and templates from API
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    // This would load from the API
    // For now, using mock data
    setChannels([
      {
        id: '1',
        type: 'email',
        name: 'Primary Email',
        config: {
          smtp_host: 'smtp.gmail.com',
          smtp_port: 587,
          from_address: 'alerts@rover.com'
        },
        isActive: true
      },
      {
        id: '2',
        type: 'slack',
        name: 'Team Slack',
        config: {
          webhook_url: 'https://hooks.slack.com/...'
        },
        isActive: true
      }
    ]);
    
    setRules([
      {
        id: '1',
        name: 'Critical Emergency Events',
        description: 'Immediate notification for all critical events',
        event_types: ['emergency_stop', 'system_breach', 'auth_failure'],
        severity_levels: ['critical'],
        channels: ['1', '2'],
        recipients: {
          '1': ['security@rover.com', 'ops@rover.com'],
          '2': ['#security-alerts']
        },
        template_id: 'critical_alert',
        cooldown_minutes: 5,
        max_notifications_per_hour: 20,
        escalation_delay_minutes: 15,
        escalation_channels: ['sms'],
        is_active: true
      }
    ]);
  };

  // Channel management
  const handleSaveChannel = (channel: NotificationChannel) => {
    if (editingChannel) {
      setChannels(channels.map(c => c.id === channel.id ? channel : c));
    } else {
      setChannels([...channels, { ...channel, id: Date.now().toString() }]);
    }
    setChannelDialogOpen(false);
    setEditingChannel(null);
  };

  const handleDeleteChannel = (id: string) => {
    setChannels(channels.filter(c => c.id !== id));
  };

  // Rule management
  const handleSaveRule = (rule: NotificationRule) => {
    if (editingRule) {
      setRules(rules.map(r => r.id === rule.id ? rule : r));
    } else {
      setRules([...rules, { ...rule, id: Date.now().toString() }]);
    }
    setRuleDialogOpen(false);
    setEditingRule(null);
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  // Channel icon
  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email': return <EmailIcon />;
      case 'sms': return <SmsIcon />;
      case 'webhook': return <WebhookIcon />;
      case 'slack': return <SlackIcon />;
      default: return <NotificationIcon />;
    }
  };

  // Render channels tab
  const renderChannelsTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Notification Channels</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingChannel(null);
            setChannelDialogOpen(true);
          }}
        >
          Add Channel
        </Button>
      </Box>
      
      <Grid container spacing={2}>
        {channels.map((channel) => (
          <Grid item xs={12} md={6} key={channel.id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  {getChannelIcon(channel.type)}
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    {channel.name}
                  </Typography>
                  <Box flexGrow={1} />
                  <Chip
                    size="small"
                    label={channel.isActive ? 'Active' : 'Inactive'}
                    color={channel.isActive ? 'success' : 'default'}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Type: {channel.type.toUpperCase()}
                </Typography>
                {channel.type === 'email' && (
                  <Typography variant="body2">
                    SMTP: {channel.config.smtp_host}:{channel.config.smtp_port}
                  </Typography>
                )}
                {channel.type === 'slack' && (
                  <Typography variant="body2" noWrap>
                    Webhook: {channel.config.webhook_url}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    setEditingChannel(channel);
                    setChannelDialogOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDeleteChannel(channel.id)}
                >
                  Delete
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // Render rules tab
  const renderRulesTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Notification Rules</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingRule(null);
            setRuleDialogOpen(true);
          }}
        >
          Add Rule
        </Button>
      </Box>
      
      <List>
        {rules.map((rule) => (
          <React.Fragment key={rule.id}>
            <ListItem>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="subtitle1">{rule.name}</Typography>
                    <Chip
                      size="small"
                      label={rule.is_active ? 'Active' : 'Inactive'}
                      color={rule.is_active ? 'success' : 'default'}
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    {rule.description && (
                      <Typography variant="body2" color="text.secondary">
                        {rule.description}
                      </Typography>
                    )}
                    <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                      <Chip
                        size="small"
                        icon={<FilterIcon />}
                        label={`${rule.event_types.length} events`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={<WarningIcon />}
                        label={rule.severity_levels.join(', ')}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={<NotificationIcon />}
                        label={`${rule.channels.length} channels`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={<ScheduleIcon />}
                        label={`${rule.cooldown_minutes}min cooldown`}
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => {
                    setEditingRule(rule);
                    setRuleDialogOpen(true);
                  }}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => handleDeleteRule(rule.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            <Divider />
          </React.Fragment>
        ))}
      </List>
    </Box>
  );

  // Channel dialog
  const renderChannelDialog = () => (
    <Dialog
      open={channelDialogOpen}
      onClose={() => setChannelDialogOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {editingChannel ? 'Edit Channel' : 'Add Channel'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Channel Name"
            defaultValue={editingChannel?.name}
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Channel Type</InputLabel>
            <Select
              defaultValue={editingChannel?.type || 'email'}
              label="Channel Type"
            >
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="sms">SMS</MenuItem>
              <MenuItem value="webhook">Webhook</MenuItem>
              <MenuItem value="slack">Slack</MenuItem>
            </Select>
          </FormControl>
          
          {/* Dynamic configuration based on channel type */}
          <Typography variant="subtitle2" gutterBottom>
            Configuration
          </Typography>
          
          {/* Email configuration */}
          <Box>
            <TextField
              fullWidth
              label="SMTP Host"
              defaultValue={editingChannel?.config.smtp_host}
              sx={{ mb: 2 }}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="SMTP Port"
                  type="number"
                  defaultValue={editingChannel?.config.smtp_port || 587}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Use TLS"
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth
              label="From Address"
              type="email"
              defaultValue={editingChannel?.config.from_address}
              sx={{ mt: 2 }}
            />
          </Box>
          
          <FormControlLabel
            control={
              <Switch 
                defaultChecked={editingChannel?.isActive !== false}
              />
            }
            label="Active"
            sx={{ mt: 2 }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setChannelDialogOpen(false)}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={() => {
            // Save channel
            handleSaveChannel({
              id: editingChannel?.id || '',
              type: 'email',
              name: 'Test Channel',
              config: {},
              isActive: true
            });
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Rule dialog
  const renderRuleDialog = () => (
    <Dialog
      open={ruleDialogOpen}
      onClose={() => setRuleDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {editingRule ? 'Edit Rule' : 'Add Rule'}
      </DialogTitle>
      <DialogContent>
        <Stepper orientation="vertical" sx={{ mt: 2 }}>
          <Step active>
            <StepLabel>Basic Information</StepLabel>
            <StepContent>
              <TextField
                fullWidth
                label="Rule Name"
                defaultValue={editingRule?.name}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                defaultValue={editingRule?.description}
              />
            </StepContent>
          </Step>
          
          <Step active>
            <StepLabel>Event Filters</StepLabel>
            <StepContent>
              <Typography variant="body2" gutterBottom>
                Select event types to monitor:
              </Typography>
              <FormGroup row>
                <FormControlLabel
                  control={<Checkbox defaultChecked />}
                  label="Emergency Stop"
                />
                <FormControlLabel
                  control={<Checkbox />}
                  label="Auth Failure"
                />
                <FormControlLabel
                  control={<Checkbox />}
                  label="System Breach"
                />
                <FormControlLabel
                  control={<Checkbox />}
                  label="Data Export"
                />
              </FormGroup>
              
              <Typography variant="body2" sx={{ mt: 2 }} gutterBottom>
                Select severity levels:
              </Typography>
              <FormGroup row>
                <FormControlLabel
                  control={<Checkbox defaultChecked />}
                  label="Critical"
                />
                <FormControlLabel
                  control={<Checkbox />}
                  label="High"
                />
                <FormControlLabel
                  control={<Checkbox />}
                  label="Medium"
                />
                <FormControlLabel
                  control={<Checkbox />}
                  label="Low"
                />
              </FormGroup>
            </StepContent>
          </Step>
          
          <Step active>
            <StepLabel>Notification Settings</StepLabel>
            <StepContent>
              <Typography variant="body2" gutterBottom>
                Select channels to use:
              </Typography>
              <FormGroup>
                {channels.map((channel) => (
                  <FormControlLabel
                    key={channel.id}
                    control={<Checkbox defaultChecked={channel.id === '1'} />}
                    label={`${channel.name} (${channel.type})`}
                  />
                ))}
              </FormGroup>
              
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Cooldown (minutes)"
                    type="number"
                    defaultValue={editingRule?.cooldown_minutes || 5}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">min</InputAdornment>
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Max per hour"
                    type="number"
                    defaultValue={editingRule?.max_notifications_per_hour || 20}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">/hr</InputAdornment>
                    }}
                  />
                </Grid>
              </Grid>
            </StepContent>
          </Step>
          
          <Step active>
            <StepLabel>Recipients</StepLabel>
            <StepContent>
              <Typography variant="body2" gutterBottom>
                Configure recipients for each channel:
              </Typography>
              
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Email Recipients</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    fullWidth
                    label="Email Addresses"
                    placeholder="security@rover.com, ops@rover.com"
                    defaultValue={editingRule?.recipients['1']?.join(', ')}
                    helperText="Comma-separated email addresses"
                  />
                </AccordionDetails>
              </Accordion>
              
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Slack Channels</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    fullWidth
                    label="Slack Channels"
                    placeholder="#security-alerts, @oncall"
                    helperText="Comma-separated channels or users"
                  />
                </AccordionDetails>
              </Accordion>
            </StepContent>
          </Step>
          
          <Step active>
            <StepLabel optional>Escalation (Optional)</StepLabel>
            <StepContent>
              <FormControlLabel
                control={<Switch />}
                label="Enable escalation"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Escalation Delay"
                type="number"
                defaultValue={15}
                InputProps={{
                  endAdornment: <InputAdornment position="end">minutes</InputAdornment>
                }}
                sx={{ mb: 2 }}
              />
              <Typography variant="body2" gutterBottom>
                Escalation channels:
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={<Checkbox />}
                  label="SMS"
                />
                <FormControlLabel
                  control={<Checkbox />}
                  label="Phone Call"
                />
              </FormGroup>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setRuleDialogOpen(false)}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={() => {
            // Save rule
            handleSaveRule({
              id: editingRule?.id || '',
              name: 'Test Rule',
              event_types: [],
              severity_levels: [],
              channels: [],
              recipients: {},
              template_id: 'default',
              cooldown_minutes: 5,
              max_notifications_per_hour: 20,
              is_active: true
            });
          }}
        >
          Save Rule
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Notification Configuration
      </Typography>
      
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Channels" icon={<NotificationIcon />} />
        <Tab label="Rules" icon={<SecurityIcon />} />
        <Tab label="Templates" icon={<EmailIcon />} />
        <Tab label="Test" icon={<CheckIcon />} />
      </Tabs>
      
      {activeTab === 0 && renderChannelsTab()}
      {activeTab === 1 && renderRulesTab()}
      {activeTab === 2 && (
        <Box textAlign="center" py={4}>
          <Typography variant="h6">Notification Templates</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage email, SMS, and webhook templates
          </Typography>
        </Box>
      )}
      {activeTab === 3 && (
        <Box textAlign="center" py={4}>
          <Typography variant="h6">Test Notifications</Typography>
          <Typography variant="body2" color="text.secondary">
            Send test notifications to verify configuration
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }}>
            Send Test
          </Button>
        </Box>
      )}
      
      {renderChannelDialog()}
      {renderRuleDialog()}
    </Paper>
  );
};

export default NotificationConfiguration;
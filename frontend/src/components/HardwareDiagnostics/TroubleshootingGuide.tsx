import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  Chip,
  Grid,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Build as BuildIcon,
  BugReport as BugIcon,
  Lightbulb as LightbulbIcon,
  Link as LinkIcon,
  Cable as CableIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';

interface CommonIssue {
  issue: string;
  causes: string[];
  solutions: string[];
}

interface TroubleshootingData {
  device_id: string;
  protocol_type: string;
  current_state: string;
  is_connected: boolean;
  common_issues: CommonIssue[];
  specific_recommendations: string[];
  diagnostic_steps: string[];
  last_diagnostic?: {
    timestamp: string;
    health_status: string;
    issues_detected: number;
  };
}

interface DiagnosticCommand {
  [key: string]: string | number | any;
}

interface TroubleshootingGuideProps {
  deviceId: string;
  protocolType?: string;
}

const TroubleshootingGuide: React.FC<TroubleshootingGuideProps> = ({ deviceId, protocolType }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [troubleshootingData, setTroubleshootingData] = useState<TroubleshootingData | null>(null);
  const [diagnosticCommands, setDiagnosticCommands] = useState<Record<string, DiagnosticCommand> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [expandedIssues, setExpandedIssues] = useState<string[]>([]);

  useEffect(() => {
    fetchTroubleshootingData();
    if (protocolType) {
      fetchDiagnosticCommands(protocolType);
    }
  }, [deviceId, protocolType]);

  const fetchTroubleshootingData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/hardware/diagnostics/troubleshooting/${deviceId}`);
      setTroubleshootingData(response.data);
      
      // Fetch diagnostic commands if protocol type is available
      if (response.data.protocol_type && !protocolType) {
        fetchDiagnosticCommands(response.data.protocol_type);
      }
    } catch (error) {
      console.error('Failed to fetch troubleshooting data:', error);
      enqueueSnackbar('Failed to load troubleshooting guide', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchDiagnosticCommands = async (protocol: string) => {
    try {
      const response = await axios.get(`/api/hardware/diagnostics/commands/${protocol}`);
      setDiagnosticCommands(response.data.commands);
    } catch (error) {
      console.error('Failed to fetch diagnostic commands:', error);
    }
  };

  const handleStepClick = (step: number) => () => {
    setActiveStep(step);
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  const toggleIssue = (issue: string) => {
    setExpandedIssues(prev =>
      prev.includes(issue)
        ? prev.filter(i => i !== issue)
        : [...prev, issue]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied to clipboard', { variant: 'success' });
  };

  const getConnectionStatusIcon = () => {
    if (!troubleshootingData) return null;
    
    if (troubleshootingData.is_connected) {
      return <CheckIcon color="success" />;
    } else if (troubleshootingData.current_state === 'error') {
      return <ErrorIcon color="error" />;
    } else {
      return <WarningIcon color="warning" />;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (!troubleshootingData) {
    return (
      <Alert severity="error" action={
        <IconButton size="small" onClick={fetchTroubleshootingData}>
          <RefreshIcon />
        </IconButton>
      }>
        Failed to load troubleshooting guide
      </Alert>
    );
  }

  return (
    <Box>
      {/* Device Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h5" gutterBottom>
                Troubleshooting Guide for {deviceId}
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <Chip
                  icon={getConnectionStatusIcon()}
                  label={troubleshootingData.is_connected ? 'Connected' : 'Disconnected'}
                  color={troubleshootingData.is_connected ? 'success' : 'error'}
                />
                <Chip
                  label={troubleshootingData.protocol_type.toUpperCase()}
                  variant="outlined"
                />
                <Chip
                  label={`State: ${troubleshootingData.current_state}`}
                  variant="outlined"
                />
              </Box>
            </Box>
            
            {troubleshootingData.last_diagnostic && (
              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Last Diagnostic
                </Typography>
                <Typography variant="body2">
                  {new Date(troubleshootingData.last_diagnostic.timestamp).toLocaleString()}
                </Typography>
                <Chip
                  label={troubleshootingData.last_diagnostic.health_status}
                  color={getHealthStatusColor(troubleshootingData.last_diagnostic.health_status) as any}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </Paper>
            )}
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Common Issues */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Common Issues & Solutions
              </Typography>
              
              {troubleshootingData.common_issues.map((issue, index) => (
                <Accordion
                  key={index}
                  expanded={expandedIssues.includes(issue.issue)}
                  onChange={() => toggleIssue(issue.issue)}
                  sx={{ mb: 1 }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <BugIcon color="error" />
                      <Typography>{issue.issue}</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Possible Causes:
                      </Typography>
                      <List dense>
                        {issue.causes.map((cause, idx) => (
                          <ListItem key={idx}>
                            <ListItemIcon>
                              <WarningIcon color="warning" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={cause} />
                          </ListItem>
                        ))}
                      </List>
                      
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                        Solutions:
                      </Typography>
                      <List dense>
                        {issue.solutions.map((solution, idx) => (
                          <ListItem key={idx}>
                            <ListItemIcon>
                              <LightbulbIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={solution} />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Diagnostic Steps */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Diagnostic Steps
              </Typography>
              
              <Stepper activeStep={activeStep} orientation="vertical">
                {troubleshootingData.diagnostic_steps.map((step, index) => (
                  <Step key={index}>
                    <StepLabel
                      optional={
                        index === troubleshootingData.diagnostic_steps.length - 1 ? (
                          <Typography variant="caption">Last step</Typography>
                        ) : null
                      }
                    >
                      {step.split('.')[0]}
                    </StepLabel>
                    <StepContent>
                      <Typography>{step}</Typography>
                      <Box sx={{ mb: 2, mt: 2 }}>
                        <Button
                          variant="contained"
                          onClick={handleNext}
                          sx={{ mr: 1 }}
                          disabled={index === troubleshootingData.diagnostic_steps.length - 1}
                        >
                          {index === troubleshootingData.diagnostic_steps.length - 1 ? 'Finish' : 'Continue'}
                        </Button>
                        <Button
                          disabled={index === 0}
                          onClick={handleBack}
                          sx={{ mr: 1 }}
                        >
                          Back
                        </Button>
                      </Box>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
              
              {activeStep === troubleshootingData.diagnostic_steps.length && (
                <Paper square elevation={0} sx={{ p: 3 }}>
                  <Typography>All steps completed - diagnostics finished</Typography>
                  <Button onClick={handleReset} sx={{ mt: 1, mr: 1 }}>
                    Reset
                  </Button>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Specific Recommendations */}
        {troubleshootingData.specific_recommendations.length > 0 && (
          <Grid item xs={12}>
            <Alert severity="info">
              <AlertTitle>Specific Recommendations</AlertTitle>
              <List dense>
                {troubleshootingData.specific_recommendations.map((rec, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <BuildIcon />
                    </ListItemIcon>
                    <ListItemText primary={rec} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          </Grid>
        )}

        {/* Diagnostic Commands */}
        {diagnosticCommands && Object.keys(diagnosticCommands).length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Diagnostic Commands
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Protocol-specific commands for testing and debugging
                </Typography>
                
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {Object.entries(diagnosticCommands).map(([name, command]) => (
                    <Grid item xs={12} sm={6} key={name}>
                      <Paper sx={{ p: 2 }} variant="outlined">
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="subtitle2">
                              {name.replace(/_/g, ' ').toUpperCase()}
                            </Typography>
                            <Typography variant="caption" component="pre" sx={{ mt: 1 }}>
                              {typeof command === 'string' ? command : JSON.stringify(command, null, 2)}
                            </Typography>
                          </Box>
                          <Tooltip title="Copy command">
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(
                                typeof command === 'string' ? command : JSON.stringify(command)
                              )}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default TroubleshootingGuide;
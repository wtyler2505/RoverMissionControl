import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextareaAutosize,
  Alert,
  Stack,
  Tooltip,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Code as CodeIcon,
  ExpandMore as ExpandIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  ContentCopy as CopyIcon,
  PlayArrow as TestIcon
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import {
  ValidationRule,
  RuleType,
  RuleSeverity
} from '../../types/schema';
import schemaService from '../../services/schemaService';

interface ValidationRulesProps {
  schemaId: string;
  onRuleChange?: () => void;
}

const ValidationRules: React.FC<ValidationRulesProps> = ({ schemaId, onRuleChange }) => {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
  const [formData, setFormData] = useState<Partial<ValidationRule>>({
    name: '',
    description: '',
    ruleType: RuleType.REQUIRED_FIELD,
    severity: RuleSeverity.ERROR,
    field: '',
    condition: '',
    errorMessage: '',
    customValidator: '',
    isActive: true,
    businessContext: '',
    complianceRequirements: []
  });
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [testData, setTestData] = useState('{}');
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  useEffect(() => {
    loadRules();
  }, [schemaId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const rulesData = await schemaService.getValidationRules(schemaId);
      setRules(rulesData);
    } catch (error) {
      console.error('Failed to load validation rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (rule?: ValidationRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData(rule);
      setShowCustomEditor(rule.ruleType === RuleType.CUSTOM_FUNCTION);
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        ruleType: RuleType.REQUIRED_FIELD,
        severity: RuleSeverity.ERROR,
        field: '',
        condition: '',
        errorMessage: '',
        customValidator: '',
        isActive: true,
        businessContext: '',
        complianceRequirements: []
      });
      setShowCustomEditor(false);
    }
    setTestResult(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
    setTestResult(null);
  };

  const handleSave = async () => {
    try {
      if (editingRule) {
        await schemaService.updateValidationRule(schemaId, editingRule.id, formData);
      } else {
        await schemaService.createValidationRule(schemaId, formData);
      }
      handleCloseDialog();
      loadRules();
      onRuleChange?.();
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (window.confirm('Are you sure you want to delete this rule?')) {
      try {
        await schemaService.deleteValidationRule(schemaId, ruleId);
        loadRules();
        onRuleChange?.();
      } catch (error) {
        console.error('Failed to delete rule:', error);
      }
    }
  };

  const handleToggleActive = async (rule: ValidationRule) => {
    try {
      await schemaService.updateValidationRule(schemaId, rule.id, {
        isActive: !rule.isActive
      });
      loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const handleFieldChange = (field: keyof ValidationRule, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'ruleType') {
      setShowCustomEditor(value === RuleType.CUSTOM_FUNCTION);
      // Set default conditions based on rule type
      switch (value) {
        case RuleType.REQUIRED_FIELD:
          setFormData(prev => ({ 
            ...prev, 
            condition: 'value !== null && value !== undefined && value !== ""'
          }));
          break;
        case RuleType.TYPE_CHECK:
          setFormData(prev => ({ 
            ...prev, 
            condition: 'typeof value === "string"'
          }));
          break;
        case RuleType.RANGE_CHECK:
          setFormData(prev => ({ 
            ...prev, 
            condition: 'value >= 0 && value <= 100'
          }));
          break;
        case RuleType.PATTERN_MATCH:
          setFormData(prev => ({ 
            ...prev, 
            condition: '/^[A-Z][a-z]+$/.test(value)'
          }));
          break;
      }
    }
  };

  const handleTestRule = () => {
    try {
      const data = JSON.parse(testData);
      const field = formData.field || 'value';
      const value = field.split('.').reduce((obj, key) => obj?.[key], data);
      
      let isValid = false;
      let message = '';

      if (formData.ruleType === RuleType.CUSTOM_FUNCTION && formData.customValidator) {
        // Simulate custom validator execution
        try {
          const func = new Function('value', 'data', formData.customValidator);
          isValid = func(value, data);
          message = isValid ? 'Validation passed' : formData.errorMessage || 'Validation failed';
        } catch (error: any) {
          message = `Validator error: ${error.message}`;
        }
      } else {
        // Evaluate condition
        try {
          const func = new Function('value', `return ${formData.condition}`);
          isValid = func(value);
          message = isValid ? 'Validation passed' : formData.errorMessage || 'Validation failed';
        } catch (error: any) {
          message = `Condition error: ${error.message}`;
        }
      }

      setTestResult({ valid: isValid, message });
    } catch (error: any) {
      setTestResult({ valid: false, message: `JSON parse error: ${error.message}` });
    }
  };

  const getSeverityColor = (severity: RuleSeverity) => {
    switch (severity) {
      case RuleSeverity.ERROR:
        return 'error';
      case RuleSeverity.WARNING:
        return 'warning';
      case RuleSeverity.INFO:
        return 'info';
      default:
        return 'default';
    }
  };

  const getRuleTypeLabel = (type: RuleType) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getDefaultCustomValidator = () => {
    return `// Custom validation function
// Parameters: value (field value), data (entire object)
// Return: true if valid, false if invalid

if (value === undefined || value === null) {
  return false;
}

// Add your custom validation logic here
if (typeof value === 'string' && value.length < 3) {
  return false;
}

return true;`;
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            Custom Validation Rules
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Rule
          </Button>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : rules.length === 0 ? (
          <Alert severity="info">
            No custom validation rules defined. Click "Add Rule" to create one.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Rule Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Field</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {rule.name}
                        </Typography>
                        {rule.description && (
                          <Typography variant="caption" color="text.secondary">
                            {rule.description}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getRuleTypeLabel(rule.ruleType)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {rule.field || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rule.severity}
                        size="small"
                        color={getSeverityColor(rule.severity) as any}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={rule.isActive ? 'Active' : 'Inactive'}>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleActive(rule)}
                        >
                          {rule.isActive ? (
                            <ActiveIcon color="success" />
                          ) : (
                            <InactiveIcon color="disabled" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" justifyContent="flex-end" gap={0.5}>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(rule)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRule ? 'Edit Validation Rule' : 'Create Validation Rule'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Rule Name"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              fullWidth
              required
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            <FormControl fullWidth>
              <InputLabel>Rule Type</InputLabel>
              <Select
                value={formData.ruleType}
                label="Rule Type"
                onChange={(e) => handleFieldChange('ruleType', e.target.value)}
              >
                {Object.values(RuleType).map(type => (
                  <MenuItem key={type} value={type}>
                    {getRuleTypeLabel(type)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={formData.severity}
                label="Severity"
                onChange={(e) => handleFieldChange('severity', e.target.value)}
              >
                {Object.values(RuleSeverity).map(severity => (
                  <MenuItem key={severity} value={severity}>
                    {severity}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Field Path"
              value={formData.field}
              onChange={(e) => handleFieldChange('field', e.target.value)}
              fullWidth
              helperText="JSON path to the field (e.g., user.email, items[0].price)"
            />

            {!showCustomEditor && (
              <TextField
                label="Condition"
                value={formData.condition}
                onChange={(e) => handleFieldChange('condition', e.target.value)}
                fullWidth
                multiline
                rows={2}
                helperText="JavaScript expression that returns true if valid"
              />
            )}

            <TextField
              label="Error Message"
              value={formData.errorMessage}
              onChange={(e) => handleFieldChange('errorMessage', e.target.value)}
              fullWidth
              required
            />

            {showCustomEditor && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Custom Validator Function
                </Typography>
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Editor
                    height="200px"
                    language="javascript"
                    value={formData.customValidator || getDefaultCustomValidator()}
                    onChange={(value) => handleFieldChange('customValidator', value)}
                    theme="vs-light"
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14
                    }}
                  />
                </Box>
              </Box>
            )}

            <TextField
              label="Business Context"
              value={formData.businessContext}
              onChange={(e) => handleFieldChange('businessContext', e.target.value)}
              fullWidth
              multiline
              rows={2}
              helperText="Optional: Explain the business reason for this rule"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => handleFieldChange('isActive', e.target.checked)}
                />
              }
              label="Active"
            />

            <Accordion>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography>Test Rule</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Test your validation rule with sample data
                  </Typography>
                  <TextField
                    label="Test Data (JSON)"
                    value={testData}
                    onChange={(e) => setTestData(e.target.value)}
                    multiline
                    rows={4}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    startIcon={<TestIcon />}
                    onClick={handleTestRule}
                  >
                    Test Rule
                  </Button>
                  {testResult && (
                    <Alert severity={testResult.valid ? 'success' : 'error'}>
                      {testResult.message}
                    </Alert>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.name || !formData.errorMessage}
          >
            {editingRule ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ValidationRules;
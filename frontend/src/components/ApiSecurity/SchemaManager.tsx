import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Button,
  IconButton,
  Badge,
  Tooltip,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  CloudUpload as ImportIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import SchemaList from './SchemaList';
import SchemaEditor from './SchemaEditor';
import SchemaImporter from './SchemaImporter';
import ValidationTesting from './ValidationTesting';
import ValidationRules from './ValidationRules';
import SchemaVersioning from './SchemaVersioning';
import schemaService from '../../services/schemaService';
import { SchemaDefinition, SchemaMetrics } from '../../types/schema';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`schema-tabpanel-${index}`}
      aria-labelledby={`schema-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const SchemaManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedSchema, setSelectedSchema] = useState<SchemaDefinition | null>(null);
  const [schemas, setSchemas] = useState<SchemaDefinition[]>([]);
  const [metrics, setMetrics] = useState<SchemaMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadSchemas();
  }, [refreshTrigger]);

  useEffect(() => {
    if (selectedSchema) {
      loadMetrics(selectedSchema.id);
    }
  }, [selectedSchema]);

  const loadSchemas = async () => {
    try {
      setLoading(true);
      const response = await schemaService.getSchemas();
      setSchemas(response.schemas);
    } catch (err: any) {
      setError(err.message || 'Failed to load schemas');
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async (schemaId: string) => {
    try {
      const metricsData = await schemaService.getSchemaMetrics(schemaId);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSchemaSelect = (schema: SchemaDefinition) => {
    setSelectedSchema(schema);
  };

  const handleSchemaCreate = () => {
    setSelectedSchema(null);
    setActiveTab(1); // Switch to editor tab
  };

  const handleSchemaUpdate = async (schema: SchemaDefinition) => {
    try {
      setLoading(true);
      if (schema.id) {
        await schemaService.updateSchema(schema.id, schema);
        setSuccess('Schema updated successfully');
      } else {
        const created = await schemaService.createSchema(schema);
        setSelectedSchema(created);
        setSuccess('Schema created successfully');
      }
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to save schema');
    } finally {
      setLoading(false);
    }
  };

  const handleSchemaDelete = async (schemaId: string) => {
    try {
      setLoading(true);
      await schemaService.deleteSchema(schemaId);
      setSuccess('Schema deleted successfully');
      setSelectedSchema(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to delete schema');
    } finally {
      setLoading(false);
    }
  };

  const handleImportSuccess = (result: any) => {
    setSuccess(`Successfully imported schema: ${result.schemaId}`);
    setRefreshTrigger(prev => prev + 1);
    setActiveTab(0); // Switch back to list
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const getTabLabel = (label: string, count?: number) => {
    if (count !== undefined && count > 0) {
      return (
        <Badge badgeContent={count} color="primary">
          {label}
        </Badge>
      );
    }
    return label;
  };

  return (
    <Box>
      <Paper sx={{ mb: 2, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" component="h2">
            Schema Validation Management
          </Typography>
          <Box display="flex" gap={1}>
            <Tooltip title="Create new schema">
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleSchemaCreate}
              >
                New Schema
              </Button>
            </Tooltip>
            <Tooltip title="Import OpenAPI/Swagger">
              <Button
                variant="outlined"
                startIcon={<ImportIcon />}
                onClick={() => setActiveTab(2)}
              >
                Import
              </Button>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {selectedSchema && metrics && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>{selectedSchema.name}</strong> - 
            Total validations: {metrics.totalValidations}, 
            Failed: {metrics.failedValidations} 
            ({((metrics.failedValidations / metrics.totalValidations) * 100).toFixed(1)}%), 
            Avg time: {metrics.averageValidationTime.toFixed(2)}ms
          </Typography>
        </Alert>
      )}

      <Paper>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={getTabLabel("Schemas", schemas.length)} />
          <Tab label="Editor" />
          <Tab label="Import" />
          <Tab label="Validation Testing" />
          <Tab label={getTabLabel("Custom Rules", selectedSchema ? undefined : 0)} />
          <Tab label="Versioning" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <SchemaList
            schemas={schemas}
            selectedSchema={selectedSchema}
            onSchemaSelect={handleSchemaSelect}
            onSchemaDelete={handleSchemaDelete}
            loading={loading}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <SchemaEditor
            schema={selectedSchema}
            onSave={handleSchemaUpdate}
            onCancel={() => setActiveTab(0)}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <SchemaImporter
            onImportSuccess={handleImportSuccess}
            onCancel={() => setActiveTab(0)}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <ValidationTesting
            schema={selectedSchema}
            schemas={schemas}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          {selectedSchema ? (
            <ValidationRules
              schemaId={selectedSchema.id}
              onRuleChange={() => setRefreshTrigger(prev => prev + 1)}
            />
          ) : (
            <Alert severity="info">
              Please select a schema to manage validation rules
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={5}>
          {selectedSchema ? (
            <SchemaVersioning
              schemaId={selectedSchema.id}
              currentVersion={selectedSchema.version}
              onVersionChange={() => setRefreshTrigger(prev => prev + 1)}
            />
          ) : (
            <Alert severity="info">
              Please select a schema to view version history
            </Alert>
          )}
        </TabPanel>
      </Paper>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess(null)}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SchemaManager;
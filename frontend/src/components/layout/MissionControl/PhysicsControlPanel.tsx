/**
 * PhysicsControlPanel Component
 * 
 * Provides UI controls for adjusting physics parameters in real-time.
 * Allows users to modify gravity, rover properties, wheel settings, and more.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Button,
  Tooltip,
  IconButton,
  Switch,
  FormControlLabel,
  Divider,
  TextField,
  Chip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  RestartAlt as ResetIcon,
  Save as SaveIcon,
  Upload as LoadIcon,
  Science as ScienceIcon,
  Speed as SpeedIcon,
  Build as BuildIcon,
  Terrain as TerrainIcon
} from '@mui/icons-material';
import { PhysicsConfig, defaultPhysicsConfig, roverPresets } from './PhysicsConfig';

interface PhysicsControlPanelProps {
  config: PhysicsConfig;
  onConfigChange: (config: PhysicsConfig) => void;
  onReset?: () => void;
  onPresetSelect?: (presetName: string) => void;
}

export const PhysicsControlPanel: React.FC<PhysicsControlPanelProps> = ({
  config,
  onConfigChange,
  onReset,
  onPresetSelect
}) => {
  const [expandedPanels, setExpandedPanels] = useState<string[]>(['gravity']);
  const [selectedEnvironment, setSelectedEnvironment] = useState<'mars' | 'earth' | 'moon' | 'custom'>('mars');
  
  const handlePanelChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedPanels(isExpanded 
      ? [...expandedPanels, panel]
      : expandedPanels.filter(p => p !== panel)
    );
  };
  
  const updateConfig = useCallback((updates: Partial<PhysicsConfig>) => {
    onConfigChange({ ...config, ...updates });
  }, [config, onConfigChange]);
  
  const updateNestedConfig = useCallback((
    section: keyof PhysicsConfig,
    updates: any
  ) => {
    onConfigChange({
      ...config,
      [section]: {
        ...config[section],
        ...updates
      }
    });
  }, [config, onConfigChange]);
  
  const handleEnvironmentChange = (env: 'mars' | 'earth' | 'moon' | 'custom') => {
    setSelectedEnvironment(env);
    if (env !== 'custom') {
      updateNestedConfig('gravity', {
        custom: config.gravity[env]
      });
    }
  };
  
  const handlePresetSelect = (presetName: string) => {
    if (presetName in roverPresets) {
      onConfigChange(roverPresets[presetName as keyof typeof roverPresets]);
      if (onPresetSelect) {
        onPresetSelect(presetName);
      }
    }
  };
  
  return (
    <Paper 
      sx={{ 
        p: 2, 
        maxHeight: '80vh', 
        overflowY: 'auto',
        backgroundColor: 'background.paper',
        '& .MuiAccordion-root': {
          backgroundColor: 'background.default',
          '&:before': {
            display: 'none'
          }
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <ScienceIcon sx={{ mr: 1 }} />
        <Typography variant="h6" component="h2">
          Physics Configuration
        </Typography>
        <Box sx={{ ml: 'auto' }}>
          <Tooltip title="Reset to defaults">
            <IconButton size="small" onClick={onReset}>
              <ResetIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Rover Preset Selection */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Rover Preset</InputLabel>
        <Select
          value=""
          onChange={(e) => handlePresetSelect(e.target.value)}
          label="Rover Preset"
        >
          <MenuItem value="">Custom Configuration</MenuItem>
          <MenuItem value="perseverance">Perseverance</MenuItem>
          <MenuItem value="curiosity">Curiosity</MenuItem>
          <MenuItem value="opportunity">Opportunity</MenuItem>
          <MenuItem value="sojourner">Sojourner</MenuItem>
        </Select>
      </FormControl>
      
      {/* Gravity Settings */}
      <Accordion 
        expanded={expandedPanels.includes('gravity')}
        onChange={handlePanelChange('gravity')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ display: 'flex', alignItems: 'center' }}>
            <TerrainIcon sx={{ mr: 1 }} />
            Gravity & Environment
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Environment</InputLabel>
                <Select
                  value={selectedEnvironment}
                  onChange={(e) => handleEnvironmentChange(e.target.value as any)}
                  label="Environment"
                >
                  <MenuItem value="earth">Earth (9.81 m/s²)</MenuItem>
                  <MenuItem value="mars">Mars (3.72 m/s²)</MenuItem>
                  <MenuItem value="moon">Moon (1.62 m/s²)</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {selectedEnvironment === 'custom' && (
              <>
                <Grid item xs={12}>
                  <Typography gutterBottom>
                    Gravity Y: {config.gravity.custom[1].toFixed(2)} m/s²
                  </Typography>
                  <Slider
                    value={-config.gravity.custom[1]}
                    onChange={(_, value) => updateNestedConfig('gravity', {
                      custom: [0, -(value as number), 0]
                    })}
                    min={0}
                    max={15}
                    step={0.1}
                    valueLabelDisplay="auto"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>
      
      {/* Rover Properties */}
      <Accordion 
        expanded={expandedPanels.includes('rover')}
        onChange={handlePanelChange('rover')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ display: 'flex', alignItems: 'center' }}>
            <BuildIcon sx={{ mr: 1 }} />
            Rover Properties
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Mass: {config.rover.mass} kg
              </Typography>
              <Slider
                value={config.rover.mass}
                onChange={(_, value) => updateNestedConfig('rover', { mass: value })}
                min={10}
                max={2000}
                step={10}
                valueLabelDisplay="auto"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Linear Damping: {config.rover.linearDamping}
              </Typography>
              <Slider
                value={config.rover.linearDamping}
                onChange={(_, value) => updateNestedConfig('rover', { linearDamping: value })}
                min={0}
                max={1}
                step={0.01}
                valueLabelDisplay="auto"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Angular Damping: {config.rover.angularDamping}
              </Typography>
              <Slider
                value={config.rover.angularDamping}
                onChange={(_, value) => updateNestedConfig('rover', { angularDamping: value })}
                min={0}
                max={2}
                step={0.1}
                valueLabelDisplay="auto"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Friction: {config.rover.friction}
              </Typography>
              <Slider
                value={config.rover.friction}
                onChange={(_, value) => updateNestedConfig('rover', { friction: value })}
                min={0}
                max={2}
                step={0.1}
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
      
      {/* Wheel Properties */}
      <Accordion 
        expanded={expandedPanels.includes('wheels')}
        onChange={handlePanelChange('wheels')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ display: 'flex', alignItems: 'center' }}>
            <SpeedIcon sx={{ mr: 1 }} />
            Wheel Properties
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Wheel Friction: {config.wheels.friction}
              </Typography>
              <Slider
                value={config.wheels.friction}
                onChange={(_, value) => updateNestedConfig('wheels', { friction: value })}
                min={0}
                max={3}
                step={0.1}
                valueLabelDisplay="auto"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Rolling Friction: {config.wheels.rollingFriction}
              </Typography>
              <Slider
                value={config.wheels.rollingFriction}
                onChange={(_, value) => updateNestedConfig('wheels', { rollingFriction: value })}
                min={0}
                max={0.5}
                step={0.01}
                valueLabelDisplay="auto"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Max Torque: {config.wheels.maxTorque} N⋅m
              </Typography>
              <Slider
                value={config.wheels.maxTorque}
                onChange={(_, value) => updateNestedConfig('wheels', { maxTorque: value })}
                min={50}
                max={1000}
                step={50}
                valueLabelDisplay="auto"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Max Steering: {(config.wheels.maxSteeringAngle * 180 / Math.PI).toFixed(0)}°
              </Typography>
              <Slider
                value={config.wheels.maxSteeringAngle * 180 / Math.PI}
                onChange={(_, value) => updateNestedConfig('wheels', { 
                  maxSteeringAngle: (value as number) * Math.PI / 180 
                })}
                min={0}
                max={45}
                step={5}
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
      
      {/* Suspension Settings */}
      <Accordion 
        expanded={expandedPanels.includes('suspension')}
        onChange={handlePanelChange('suspension')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Suspension System</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Stiffness: {(config.suspension.stiffness / 1000).toFixed(0)} kN/m
              </Typography>
              <Slider
                value={config.suspension.stiffness}
                onChange={(_, value) => updateNestedConfig('suspension', { stiffness: value })}
                min={5000}
                max={100000}
                step={1000}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${(value / 1000).toFixed(0)}k`}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Damping: {config.suspension.damping}
              </Typography>
              <Slider
                value={config.suspension.damping}
                onChange={(_, value) => updateNestedConfig('suspension', { damping: value })}
                min={500}
                max={10000}
                step={500}
                valueLabelDisplay="auto"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Rest Length: {config.suspension.restLength} m
              </Typography>
              <Slider
                value={config.suspension.restLength}
                onChange={(_, value) => updateNestedConfig('suspension', { restLength: value })}
                min={0.2}
                max={1.5}
                step={0.1}
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
      
      {/* Terrain Types */}
      <Accordion 
        expanded={expandedPanels.includes('terrain')}
        onChange={handlePanelChange('terrain')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Terrain Types</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={1}>
            {Object.entries(config.terrain.types).map(([type, props]) => (
              <Grid item xs={12} key={type}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Chip 
                      size="small" 
                      label={`Friction: ${props.friction}`}
                      variant="outlined"
                    />
                    <Chip 
                      size="small" 
                      label={`Rolling: ${props.rollingResistance}`}
                      variant="outlined"
                    />
                    <Chip 
                      size="small" 
                      label={`Sink: ${props.sinkDepth}m`}
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>
      
      {/* Simulation Settings */}
      <Accordion 
        expanded={expandedPanels.includes('simulation')}
        onChange={handlePanelChange('simulation')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Simulation Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.simulation.enableCCD}
                    onChange={(e) => updateNestedConfig('simulation', { 
                      enableCCD: e.target.checked 
                    })}
                  />
                }
                label="Continuous Collision Detection"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Velocity Iterations: {config.simulation.maxVelocityIterations}
              </Typography>
              <Slider
                value={config.simulation.maxVelocityIterations}
                onChange={(_, value) => updateNestedConfig('simulation', { 
                  maxVelocityIterations: value 
                })}
                min={1}
                max={20}
                step={1}
                valueLabelDisplay="auto"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Position Iterations: {config.simulation.maxPositionIterations}
              </Typography>
              <Slider
                value={config.simulation.maxPositionIterations}
                onChange={(_, value) => updateNestedConfig('simulation', { 
                  maxPositionIterations: value 
                })}
                min={1}
                max={10}
                step={1}
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
};

export default PhysicsControlPanel;
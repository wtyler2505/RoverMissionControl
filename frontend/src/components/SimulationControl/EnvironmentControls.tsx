/**
 * Environment Controls Component
 * Controls environmental conditions for simulation
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Slider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Button,
  IconButton,
  Divider,
  Chip,
  Tooltip,
  Paper,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Thermostat,
  Air,
  WaterDrop,
  WbSunny,
  Terrain,
  Speed,
  Explore,
  CloudQueue,
  Waves,
  Landscape,
  FilterDrama,
  Restore,
  Save,
  PlayArrow
} from '@mui/icons-material';
import { EnvironmentalConditions, TerrainType } from './types';
import { CircularProgress } from '@mui/material';

interface EnvironmentControlsProps {
  conditions: EnvironmentalConditions | null;
  onChange: (conditions: EnvironmentalConditions) => void;
}

interface EnvironmentPreset {
  name: string;
  description: string;
  conditions: Partial<EnvironmentalConditions>;
  icon: React.ReactNode;
}

const environmentPresets: EnvironmentPreset[] = [
  {
    name: 'Earth - Temperate',
    description: 'Typical Earth conditions at sea level',
    icon: <Landscape />,
    conditions: {
      temperature: 20,
      pressure: 101325,
      humidity: 60,
      windSpeed: 5,
      gravity: 9.81,
      terrainType: TerrainType.FLAT
    }
  },
  {
    name: 'Mars Surface',
    description: 'Martian surface conditions',
    icon: <Terrain />,
    conditions: {
      temperature: -63,
      pressure: 610,
      humidity: 0.03,
      windSpeed: 7,
      gravity: 3.71,
      terrainType: TerrainType.ROCKY,
      dustDensity: 100
    }
  },
  {
    name: 'Moon Surface',
    description: 'Lunar surface conditions',
    icon: <Explore />,
    conditions: {
      temperature: -23,
      pressure: 0,
      humidity: 0,
      windSpeed: 0,
      gravity: 1.62,
      terrainType: TerrainType.CRATER
    }
  },
  {
    name: 'Desert',
    description: 'Hot desert conditions',
    icon: <WbSunny />,
    conditions: {
      temperature: 45,
      pressure: 101325,
      humidity: 15,
      windSpeed: 12,
      gravity: 9.81,
      terrainType: TerrainType.SANDY,
      solarIrradiance: 1200
    }
  },
  {
    name: 'Arctic',
    description: 'Arctic conditions',
    icon: <FilterDrama />,
    conditions: {
      temperature: -30,
      pressure: 101325,
      humidity: 80,
      windSpeed: 20,
      gravity: 9.81,
      terrainType: TerrainType.FLAT,
      ambientLight: 5000
    }
  },
  {
    name: 'Deep Ocean',
    description: 'Deep underwater conditions',
    icon: <Waves />,
    conditions: {
      temperature: 4,
      pressure: 1013250, // 10 atm
      humidity: 100,
      windSpeed: 0,
      gravity: 9.81,
      terrainType: TerrainType.FLAT,
      ambientLight: 0
    }
  }
];

export const EnvironmentControls: React.FC<EnvironmentControlsProps> = ({
  conditions,
  onChange
}) => {
  const [localConditions, setLocalConditions] = useState<EnvironmentalConditions>(
    conditions || {
      temperature: 20,
      pressure: 101325,
      humidity: 50,
      windSpeed: 0,
      windDirection: 0,
      dustDensity: 0,
      solarIrradiance: 1000,
      ambientLight: 10000,
      magneticField: { x: 0, y: 0, z: -50 },
      gravity: 9.81,
      terrainType: TerrainType.FLAT,
      terrainSlope: 0,
      terrainRoughness: 0,
      radioNoiseFloor: -90,
      multipathSeverity: 0
    }
  );
  
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [animationRunning, setAnimationRunning] = useState(false);
  
  const handleConditionChange = (
    field: keyof EnvironmentalConditions,
    value: any
  ) => {
    const updated = { ...localConditions, [field]: value };
    setLocalConditions(updated);
    setSelectedPreset(null); // Clear preset selection on manual change
  };
  
  const handleMagneticFieldChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const updated = {
      ...localConditions,
      magneticField: {
        ...localConditions.magneticField,
        [axis]: value
      }
    };
    setLocalConditions(updated);
  };
  
  const handlePresetSelect = (preset: EnvironmentPreset) => {
    const updated = {
      ...localConditions,
      ...preset.conditions
    };
    setLocalConditions(updated);
    setSelectedPreset(preset.name);
  };
  
  const handleApply = () => {
    onChange(localConditions);
  };
  
  const handleReset = () => {
    if (conditions) {
      setLocalConditions(conditions);
    }
  };
  
  const runAnimation = async () => {
    setAnimationRunning(true);
    
    // Simulate day/night cycle
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const hour = i;
      const temp = 20 + 10 * Math.sin((hour - 6) * Math.PI / 12);
      const light = 50000 * Math.max(0, Math.sin((hour - 6) * Math.PI / 12));
      
      const animated = {
        ...localConditions,
        temperature: temp,
        ambientLight: light,
        solarIrradiance: light / 50
      };
      
      setLocalConditions(animated);
      onChange(animated);
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    setAnimationRunning(false);
  };
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Environmental Conditions
      </Typography>
      
      {/* Presets */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Environment Presets
          </Typography>
          <Grid container spacing={2}>
            {environmentPresets.map((preset) => (
              <Grid item xs={6} md={4} key={preset.name}>
                <Paper
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: selectedPreset === preset.name ? 2 : 0,
                    borderColor: 'primary.main',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                  onClick={() => handlePresetSelect(preset)}
                >
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    {preset.icon}
                    <Typography variant="subtitle2">{preset.name}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {preset.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
      
      {/* Atmospheric Conditions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Atmospheric Conditions
          </Typography>
          
          <Grid container spacing={3}>
            {/* Temperature */}
            <Grid item xs={12} md={4}>
              <Box>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Thermostat />
                  <Typography>
                    Temperature: {localConditions.temperature.toFixed(1)}°C
                  </Typography>
                </Box>
                <Slider
                  value={localConditions.temperature}
                  onChange={(e, value) => handleConditionChange('temperature', value)}
                  min={-100}
                  max={100}
                  step={0.1}
                  marks={[
                    { value: -100, label: '-100°C' },
                    { value: 0, label: '0°C' },
                    { value: 100, label: '100°C' }
                  ]}
                />
              </Box>
            </Grid>
            
            {/* Pressure */}
            <Grid item xs={12} md={4}>
              <Box>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Air />
                  <Typography>
                    Pressure: {(localConditions.pressure / 1000).toFixed(1)} kPa
                  </Typography>
                </Box>
                <Slider
                  value={localConditions.pressure}
                  onChange={(e, value) => handleConditionChange('pressure', value)}
                  min={0}
                  max={1013250} // 10 atm
                  step={100}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 101325, label: '1 atm' },
                    { value: 1013250, label: '10 atm' }
                  ]}
                />
              </Box>
            </Grid>
            
            {/* Humidity */}
            <Grid item xs={12} md={4}>
              <Box>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <WaterDrop />
                  <Typography>
                    Humidity: {localConditions.humidity.toFixed(0)}%
                  </Typography>
                </Box>
                <Slider
                  value={localConditions.humidity}
                  onChange={(e, value) => handleConditionChange('humidity', value)}
                  min={0}
                  max={100}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 50, label: '50%' },
                    { value: 100, label: '100%' }
                  ]}
                />
              </Box>
            </Grid>
            
            {/* Wind */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Wind Speed"
                type="number"
                value={localConditions.windSpeed}
                onChange={(e) => handleConditionChange('windSpeed', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
                  startAdornment: <Speed />
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Wind Direction"
                type="number"
                value={localConditions.windDirection}
                onChange={(e) => handleConditionChange('windDirection', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">degrees</InputAdornment>,
                  startAdornment: <Explore />
                }}
                inputProps={{ min: 0, max: 360 }}
              />
            </Grid>
            
            {/* Dust Density */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Dust Density"
                type="number"
                value={localConditions.dustDensity}
                onChange={(e) => handleConditionChange('dustDensity', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">mg/m³</InputAdornment>,
                  startAdornment: <CloudQueue />
                }}
              />
            </Grid>
            
            {/* Gravity */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Gravity"
                type="number"
                value={localConditions.gravity}
                onChange={(e) => handleConditionChange('gravity', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">m/s²</InputAdornment>
                }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Lighting Conditions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Lighting Conditions
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography gutterBottom>
                  Solar Irradiance: {localConditions.solarIrradiance.toFixed(0)} W/m²
                </Typography>
                <Slider
                  value={localConditions.solarIrradiance}
                  onChange={(e, value) => handleConditionChange('solarIrradiance', value)}
                  min={0}
                  max={2000}
                  marks={[
                    { value: 0, label: 'Night' },
                    { value: 1000, label: 'Noon' },
                    { value: 2000, label: 'Desert' }
                  ]}
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box>
                <Typography gutterBottom>
                  Ambient Light: {localConditions.ambientLight.toFixed(0)} lux
                </Typography>
                <Slider
                  value={Math.log10(localConditions.ambientLight + 1)}
                  onChange={(e, value) => handleConditionChange(
                    'ambientLight',
                    Math.pow(10, value as number) - 1
                  )}
                  min={0}
                  max={5}
                  marks={[
                    { value: 0, label: 'Dark' },
                    { value: 2, label: 'Indoor' },
                    { value: 4, label: 'Daylight' }
                  ]}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Terrain Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Terrain Configuration
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Terrain Type</InputLabel>
                <Select
                  value={localConditions.terrainType}
                  onChange={(e) => handleConditionChange('terrainType', e.target.value)}
                  label="Terrain Type"
                >
                  {Object.values(TerrainType).map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Terrain Slope"
                type="number"
                value={localConditions.terrainSlope}
                onChange={(e) => handleConditionChange('terrainSlope', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">degrees</InputAdornment>
                }}
                inputProps={{ min: -90, max: 90 }}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box>
                <Typography gutterBottom>
                  Terrain Roughness: {(localConditions.terrainRoughness * 100).toFixed(0)}%
                </Typography>
                <Slider
                  value={localConditions.terrainRoughness}
                  onChange={(e, value) => handleConditionChange('terrainRoughness', value)}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Magnetic Field */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Magnetic Field (μT)
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="X Component"
                type="number"
                value={localConditions.magneticField.x}
                onChange={(e) => handleMagneticFieldChange('x', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">μT</InputAdornment>
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Y Component"
                type="number"
                value={localConditions.magneticField.y}
                onChange={(e) => handleMagneticFieldChange('y', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">μT</InputAdornment>
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Z Component"
                type="number"
                value={localConditions.magneticField.z}
                onChange={(e) => handleMagneticFieldChange('z', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">μT</InputAdornment>
                }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Radio Environment */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Radio Environment
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Radio Noise Floor"
                type="number"
                value={localConditions.radioNoiseFloor}
                onChange={(e) => handleConditionChange('radioNoiseFloor', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">dBm</InputAdornment>
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box>
                <Typography gutterBottom>
                  Multipath Severity: {(localConditions.multipathSeverity * 100).toFixed(0)}%
                </Typography>
                <Slider
                  value={localConditions.multipathSeverity}
                  onChange={(e, value) => handleConditionChange('multipathSeverity', value)}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Action Buttons */}
      <Box display="flex" justifyContent="space-between" gap={2}>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<PlayArrow />}
            onClick={runAnimation}
            disabled={animationRunning}
          >
            {animationRunning ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Running Day/Night Cycle
              </>
            ) : (
              'Run Day/Night Cycle'
            )}
          </Button>
        </Box>
        
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Restore />}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleApply}
          >
            Apply Environment
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
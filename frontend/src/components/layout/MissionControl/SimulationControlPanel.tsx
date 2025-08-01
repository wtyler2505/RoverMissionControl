/**
 * SimulationControlPanel Component
 * 
 * Unified control panel for the complete 3D rover simulation.
 * Integrates physics, kinematics, camera, and configuration management.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card } from '../../ui/core';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { 
  Settings, Camera, Zap, Cog, Save, Play, Pause, 
  RotateCcw, Activity, Sliders 
} from 'lucide-react';
import { PhysicsControlPanel } from './PhysicsControlPanel';
import { KinematicsControlPanel } from './KinematicsControlPanel';
import { CameraControlPanel } from './CameraControlPanel';
import { ConfigurationManager } from './ConfigurationManager';
import type { PhysicsConfig } from './PhysicsConfig';
import type { Joint, IKTarget } from './KinematicsSystem';
import type { CameraMode, CameraPreset } from './CameraSystem';

// ========== Types ==========

export interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  timeScale: number;
  currentTime: number;
  frameRate: number;
  physicsEnabled: boolean;
  kinematicsEnabled: boolean;
  renderingEnabled: boolean;
}

export interface SimulationConfig {
  physics: PhysicsConfig;
  kinematics: {
    joints: Joint[];
    targets: IKTarget[];
    animations: string[];
  };
  camera: {
    mode: CameraMode;
    presets: CameraPreset[];
    splitScreen: boolean;
  };
  rendering: {
    quality: 'low' | 'medium' | 'high' | 'ultra';
    shadows: boolean;
    antialiasing: boolean;
    bloom: boolean;
    motionBlur: boolean;
  };
}

export interface SimulationControlPanelProps {
  // Physics
  physicsConfig: PhysicsConfig;
  onPhysicsConfigChange: (config: Partial<PhysicsConfig>) => void;
  
  // Kinematics
  joints: Joint[];
  onJointChange: (jointId: string, angle?: number, distance?: number) => void;
  onIKTargetSet: (target: IKTarget) => void;
  onAnimationPlay: (clipId: string) => void;
  onAnimationStop: () => void;
  currentAnimation?: string | null;
  animationTime?: number;
  
  // Camera
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  cameraPresets?: CameraPreset[];
  onCameraPresetSave?: (preset: CameraPreset) => void;
  onCameraPresetLoad?: (preset: CameraPreset) => void;
  onCameraPresetDelete?: (presetId: string) => void;
  
  // Simulation
  simulationState: SimulationState;
  onSimulationStateChange: (state: Partial<SimulationState>) => void;
  onReset?: () => void;
  
  // Configuration
  onConfigLoad?: (config: any) => void;
  onConfigSave?: (config: any) => void;
  
  className?: string;
}

// ========== Component ==========

export const SimulationControlPanel: React.FC<SimulationControlPanelProps> = ({
  // Physics props
  physicsConfig,
  onPhysicsConfigChange,
  
  // Kinematics props
  joints,
  onJointChange,
  onIKTargetSet,
  onAnimationPlay,
  onAnimationStop,
  currentAnimation,
  animationTime,
  
  // Camera props
  cameraMode,
  onCameraModeChange,
  cameraPresets,
  onCameraPresetSave,
  onCameraPresetLoad,
  onCameraPresetDelete,
  
  // Simulation props
  simulationState,
  onSimulationStateChange,
  onReset,
  
  // Configuration props
  onConfigLoad,
  onConfigSave,
  
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState('physics');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Build current configuration
  const currentConfig = useMemo(() => ({
    physics: physicsConfig,
    kinematics: {
      joints,
      currentAnimation,
      animationTime
    },
    camera: {
      mode: cameraMode,
      presets: cameraPresets
    },
    simulation: simulationState
  }), [physicsConfig, joints, currentAnimation, animationTime, cameraMode, cameraPresets, simulationState]);

  // Handle configuration load
  const handleConfigLoad = useCallback((config: any) => {
    if (config.physics && onPhysicsConfigChange) {
      onPhysicsConfigChange(config.physics);
    }
    
    if (config.camera && onCameraModeChange && config.camera.mode) {
      onCameraModeChange(config.camera.mode);
    }
    
    if (config.simulation && onSimulationStateChange) {
      onSimulationStateChange(config.simulation);
    }
    
    if (onConfigLoad) {
      onConfigLoad(config);
    }
  }, [onPhysicsConfigChange, onCameraModeChange, onSimulationStateChange, onConfigLoad]);

  // Toggle simulation
  const handleToggleSimulation = useCallback(() => {
    if (simulationState.isRunning && !simulationState.isPaused) {
      onSimulationStateChange({ isPaused: true });
    } else if (simulationState.isRunning && simulationState.isPaused) {
      onSimulationStateChange({ isPaused: false });
    } else {
      onSimulationStateChange({ isRunning: true, isPaused: false });
    }
  }, [simulationState, onSimulationStateChange]);

  // Render simulation controls
  const renderSimulationControls = () => (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggleSimulation}
          className="p-2 rounded hover:bg-muted transition-colors"
          title={simulationState.isPaused ? 'Resume' : 'Pause'}
        >
          {simulationState.isRunning && !simulationState.isPaused ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>
        
        {onReset && (
          <button
            onClick={onReset}
            className="p-2 rounded hover:bg-muted transition-colors"
            title="Reset Simulation"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        )}
        
        <div className="ml-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span>{simulationState.frameRate.toFixed(0)} FPS</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <span>{simulationState.timeScale.toFixed(1)}x</span>
          </div>
        </div>
      </div>
      
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="p-2 rounded hover:bg-muted transition-colors"
        title="Advanced Settings"
      >
        <Sliders className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <Card className={`simulation-control-panel ${className} h-full flex flex-col`}>
      {renderSimulationControls()}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5 px-4">
          <TabsTrigger value="physics" className="text-xs">
            <Zap className="w-4 h-4 mr-1" />
            Physics
          </TabsTrigger>
          <TabsTrigger value="kinematics" className="text-xs">
            <Cog className="w-4 h-4 mr-1" />
            Kinematics
          </TabsTrigger>
          <TabsTrigger value="camera" className="text-xs">
            <Camera className="w-4 h-4 mr-1" />
            Camera
          </TabsTrigger>
          <TabsTrigger value="config" className="text-xs">
            <Save className="w-4 h-4 mr-1" />
            Config
          </TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs">
            <Settings className="w-4 h-4 mr-1" />
            Advanced
          </TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-y-auto">
          <TabsContent value="physics" className="h-full">
            <PhysicsControlPanel
              config={physicsConfig}
              onConfigChange={onPhysicsConfigChange}
              className="border-0 shadow-none"
            />
          </TabsContent>
          
          <TabsContent value="kinematics" className="h-full">
            <KinematicsControlPanel
              joints={joints}
              onJointChange={onJointChange}
              onIKTargetSet={onIKTargetSet}
              onAnimationPlay={onAnimationPlay}
              onAnimationStop={onAnimationStop}
              currentAnimation={currentAnimation}
              animationTime={animationTime}
              className="border-0 shadow-none"
            />
          </TabsContent>
          
          <TabsContent value="camera" className="h-full">
            <CameraControlPanel
              currentMode={cameraMode}
              onModeChange={onCameraModeChange}
              presets={cameraPresets}
              onPresetSave={onCameraPresetSave}
              onPresetLoad={onCameraPresetLoad}
              onPresetDelete={onCameraPresetDelete}
              className="border-0 shadow-none"
            />
          </TabsContent>
          
          <TabsContent value="config" className="h-full">
            <ConfigurationManager
              currentConfig={currentConfig}
              onConfigLoad={handleConfigLoad}
              onConfigSave={onConfigSave}
              className="border-0 shadow-none"
            />
          </TabsContent>
          
          <TabsContent value="advanced" className="h-full p-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Simulation Settings</h4>
                <div className="space-y-2">
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Physics Engine</span>
                    <input
                      type="checkbox"
                      checked={simulationState.physicsEnabled}
                      onChange={(e) => onSimulationStateChange({ physicsEnabled: e.target.checked })}
                      className="toggle"
                    />
                  </label>
                  
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Kinematics System</span>
                    <input
                      type="checkbox"
                      checked={simulationState.kinematicsEnabled}
                      onChange={(e) => onSimulationStateChange({ kinematicsEnabled: e.target.checked })}
                      className="toggle"
                    />
                  </label>
                  
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Rendering</span>
                    <input
                      type="checkbox"
                      checked={simulationState.renderingEnabled}
                      onChange={(e) => onSimulationStateChange({ renderingEnabled: e.target.checked })}
                      className="toggle"
                    />
                  </label>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Time Control</h4>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm">Time Scale</label>
                    <input
                      type="range"
                      min="0.1"
                      max="5"
                      step="0.1"
                      value={simulationState.timeScale}
                      onChange={(e) => onSimulationStateChange({ timeScale: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0.1x</span>
                      <span>{simulationState.timeScale.toFixed(1)}x</span>
                      <span>5x</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Performance</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Frame Rate</span>
                    <span>{simulationState.frameRate.toFixed(0)} FPS</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Simulation Time</span>
                    <span>{simulationState.currentTime.toFixed(2)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Physics Enabled</span>
                    <span>{simulationState.physicsEnabled ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kinematics Enabled</span>
                    <span>{simulationState.kinematicsEnabled ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
};

export default SimulationControlPanel;
/**
 * CameraControlPanel Component
 * 
 * UI control panel for managing camera modes, settings, and cinematic features.
 * Provides an intuitive interface for mission control operators to switch
 * between different camera views and configure camera behaviors.
 * 
 * Features:
 * - Camera mode selection with visual previews
 * - View settings (FOV, clipping planes)
 * - Split-screen configuration
 * - Camera path recording and playback
 * - Picture-in-picture mode controls
 * - Camera preset management
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import {
  VideoCameraOutlined,
  EyeOutlined,
  CompassOutlined,
  RocketOutlined,
  ExpandOutlined,
  SplitCellsOutlined,
  SettingOutlined,
  RecordCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SaveOutlined,
  DeleteOutlined,
  PictureInPictureOutlined,
  CameraOutlined,
  AimOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import { Tooltip, Slider, Switch, Select, Input, Button, Collapse, Space, Tag, Popconfirm, message } from 'antd';
import { CameraMode, CameraConfig, CameraSystemRef } from './CameraSystem';
import { CameraPath } from './CameraController';

const { Panel } = Collapse;
const { Option } = Select;

// Styled components
const PanelContainer = styled.div`
  background: ${props => props.theme.colors.background.secondary};
  border: 1px solid ${props => props.theme.colors.border.primary};
  border-radius: ${props => props.theme.borderRadius.medium};
  padding: ${props => props.theme.spacing.medium};
  width: 100%;
  max-width: 350px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: ${props => props.theme.shadows.medium};

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: ${props => props.theme.colors.background.primary};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${props => props.theme.colors.primary.main};
    border-radius: 4px;

    &:hover {
      background: ${props => props.theme.colors.primary.dark};
    }
  }
`;

const SectionTitle = styled.h3`
  color: ${props => props.theme.colors.text.primary};
  font-size: ${props => props.theme.typography.sizes.medium};
  font-weight: ${props => props.theme.typography.weights.semibold};
  margin: 0 0 ${props => props.theme.spacing.small} 0;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.small};
`;

const CameraModeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${props => props.theme.spacing.small};
  margin-bottom: ${props => props.theme.spacing.medium};
`;

const CameraModeButton = styled.button<{ active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.spacing.small};
  border: 2px solid ${props => props.active ? props.theme.colors.primary.main : props.theme.colors.border.primary};
  border-radius: ${props => props.theme.borderRadius.medium};
  background: ${props => props.active ? props.theme.colors.primary.main + '20' : props.theme.colors.background.primary};
  color: ${props => props.active ? props.theme.colors.primary.main : props.theme.colors.text.primary};
  cursor: pointer;
  transition: all ${props => props.theme.transitions.default};
  font-size: ${props => props.theme.typography.sizes.small};
  height: 80px;

  &:hover {
    border-color: ${props => props.theme.colors.primary.main};
    background: ${props => props.theme.colors.primary.main + '10'};
  }

  &:focus {
    outline: 2px solid ${props => props.theme.colors.primary.main};
    outline-offset: 2px;
  }

  .anticon {
    font-size: 24px;
    margin-bottom: 4px;
  }
`;

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${props => props.theme.spacing.small};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SettingLabel = styled.label`
  color: ${props => props.theme.colors.text.secondary};
  font-size: ${props => props.theme.typography.sizes.small};
  min-width: 100px;
`;

const PresetList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.small};
`;

const PresetItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${props => props.theme.spacing.small};
  background: ${props => props.theme.colors.background.primary};
  border: 1px solid ${props => props.theme.colors.border.primary};
  border-radius: ${props => props.theme.borderRadius.small};
  
  &:hover {
    border-color: ${props => props.theme.colors.primary.main};
  }
`;

const PathTimeline = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.small};
  margin: ${props => props.theme.spacing.medium} 0;
`;

const PathProgress = styled.div`
  flex: 1;
  height: 4px;
  background: ${props => props.theme.colors.background.primary};
  border-radius: 2px;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: ${props => props.theme.colors.primary.main};
    width: var(--progress, 0%);
    transition: width 0.1s ease;
  }
`;

const PiPPreview = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: ${props => props.theme.colors.background.primary};
  border: 1px solid ${props => props.theme.colors.border.primary};
  border-radius: ${props => props.theme.borderRadius.small};
  overflow: hidden;
  margin-bottom: ${props => props.theme.spacing.small};

  &::before {
    content: 'Preview';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: ${props => props.theme.colors.text.tertiary};
    font-size: ${props => props.theme.typography.sizes.small};
  }
`;

// Types
export interface CameraControlPanelProps {
  /** Reference to camera system */
  cameraSystemRef?: React.RefObject<CameraSystemRef>;
  /** Current camera mode */
  currentMode?: CameraMode;
  /** Available camera modes */
  availableModes?: CameraMode[];
  /** Camera presets */
  presets?: Array<{
    id: string;
    name: string;
    config: Partial<CameraConfig>;
  }>;
  /** Saved camera paths */
  savedPaths?: CameraPath[];
  /** Enable split-screen controls */
  enableSplitScreen?: boolean;
  /** Enable picture-in-picture */
  enablePiP?: boolean;
  /** Callback when camera mode changes */
  onModeChange?: (mode: CameraMode) => void;
  /** Callback when settings change */
  onSettingsChange?: (settings: Partial<CameraConfig>) => void;
  /** Callback when preset is saved */
  onPresetSave?: (name: string, config: Partial<CameraConfig>) => void;
  /** Callback when preset is loaded */
  onPresetLoad?: (id: string) => void;
  /** Callback when preset is deleted */
  onPresetDelete?: (id: string) => void;
  /** Callback when path recording starts */
  onPathRecordStart?: () => void;
  /** Callback when path recording stops */
  onPathRecordStop?: () => CameraPath;
  /** Callback when path playback starts */
  onPathPlay?: (pathId: string) => void;
  /** Callback when path is deleted */
  onPathDelete?: (pathId: string) => void;
}

// Camera mode icons and labels
const CAMERA_MODE_INFO: Record<CameraMode, { icon: React.ReactNode; label: string; description: string }> = {
  orbit: {
    icon: <CompassOutlined />,
    label: 'Orbit',
    description: 'Free rotation around rover',
  },
  firstPerson: {
    icon: <EyeOutlined />,
    label: 'First Person',
    description: 'View from rover perspective',
  },
  chase: {
    icon: <RocketOutlined />,
    label: 'Chase',
    description: 'Follow behind rover',
  },
  overhead: {
    icon: <ExpandOutlined />,
    label: 'Overhead',
    description: 'Top-down tactical view',
  },
  cinematic: {
    icon: <VideoCameraOutlined />,
    label: 'Cinematic',
    description: 'Smooth cinematic camera',
  },
  custom: {
    icon: <SettingOutlined />,
    label: 'Custom',
    description: 'User-defined camera',
  },
};

/**
 * CameraControlPanel Component
 */
export const CameraControlPanel: React.FC<CameraControlPanelProps> = ({
  cameraSystemRef,
  currentMode = 'orbit',
  availableModes = ['orbit', 'firstPerson', 'chase', 'overhead', 'cinematic', 'custom'],
  presets = [],
  savedPaths = [],
  enableSplitScreen = true,
  enablePiP = true,
  onModeChange,
  onSettingsChange,
  onPresetSave,
  onPresetLoad,
  onPresetDelete,
  onPathRecordStart,
  onPathRecordStop,
  onPathPlay,
  onPathDelete,
}) => {
  const theme = useTheme();
  const [activeMode, setActiveMode] = useState<CameraMode>(currentMode);
  const [splitScreenMode, setSplitScreenMode] = useState<'off' | 'horizontal' | 'vertical' | 'quad'>('off');
  const [pipEnabled, setPipEnabled] = useState(false);
  const [pipPosition, setPipPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingPath, setCurrentPlayingPath] = useState<string | null>(null);
  const [pathProgress, setPathProgress] = useState(0);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);
  
  // Camera settings
  const [fov, setFov] = useState(75);
  const [nearPlane, setNearPlane] = useState(0.1);
  const [farPlane, setFarPlane] = useState(1000);
  const [dampingFactor, setDampingFactor] = useState(0.05);
  const [autoRotate, setAutoRotate] = useState(false);
  const [autoRotateSpeed, setAutoRotateSpeed] = useState(0.5);
  const [collisionDetection, setCollisionDetection] = useState(true);
  const [autoFocus, setAutoFocus] = useState(true);
  
  // Update active mode when prop changes
  useEffect(() => {
    setActiveMode(currentMode);
  }, [currentMode]);
  
  // Handle camera mode change
  const handleModeChange = useCallback((mode: CameraMode) => {
    setActiveMode(mode);
    if (onModeChange) {
      onModeChange(mode);
    }
    if (cameraSystemRef?.current) {
      cameraSystemRef.current.switchCamera(mode);
    }
  }, [onModeChange, cameraSystemRef]);
  
  // Handle settings change
  const handleSettingsChange = useCallback(() => {
    const settings: Partial<CameraConfig> = {
      fov,
      near: nearPlane,
      far: farPlane,
      dampingFactor,
      autoRotate,
      autoRotateSpeed,
    };
    
    if (onSettingsChange) {
      onSettingsChange(settings);
    }
  }, [fov, nearPlane, farPlane, dampingFactor, autoRotate, autoRotateSpeed, onSettingsChange]);
  
  // Update settings when they change
  useEffect(() => {
    handleSettingsChange();
  }, [handleSettingsChange]);
  
  // Handle preset save
  const handlePresetSave = useCallback(() => {
    if (!presetName.trim()) {
      message.warning('Please enter a preset name');
      return;
    }
    
    const config: Partial<CameraConfig> = {
      mode: activeMode,
      fov,
      near: nearPlane,
      far: farPlane,
      dampingFactor,
      autoRotate,
      autoRotateSpeed,
    };
    
    if (onPresetSave) {
      onPresetSave(presetName, config);
    }
    
    setPresetName('');
    setShowPresetInput(false);
    message.success('Camera preset saved');
  }, [presetName, activeMode, fov, nearPlane, farPlane, dampingFactor, autoRotate, autoRotateSpeed, onPresetSave]);
  
  // Handle path recording
  const handleRecordToggle = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      if (onPathRecordStop) {
        const path = onPathRecordStop();
        message.success(`Camera path "${path.name}" saved`);
      }
    } else {
      setIsRecording(true);
      if (onPathRecordStart) {
        onPathRecordStart();
      }
      message.info('Recording camera path...');
    }
  }, [isRecording, onPathRecordStart, onPathRecordStop]);
  
  // Handle path playback
  const handlePathPlay = useCallback((pathId: string) => {
    if (isPlaying && currentPlayingPath === pathId) {
      // Stop playback
      setIsPlaying(false);
      setCurrentPlayingPath(null);
      setPathProgress(0);
      if (cameraSystemRef?.current) {
        cameraSystemRef.current.stopCinematic();
      }
    } else {
      // Start playback
      setIsPlaying(true);
      setCurrentPlayingPath(pathId);
      setPathProgress(0);
      if (onPathPlay) {
        onPathPlay(pathId);
      }
      if (cameraSystemRef?.current) {
        cameraSystemRef.current.startCinematic(pathId);
      }
    }
  }, [isPlaying, currentPlayingPath, onPathPlay, cameraSystemRef]);
  
  // Handle split-screen mode change
  const handleSplitScreenChange = useCallback((mode: string) => {
    setSplitScreenMode(mode as any);
    // Implementation would update the camera system
  }, []);
  
  // Handle PiP toggle
  const handlePiPToggle = useCallback((enabled: boolean) => {
    setPipEnabled(enabled);
    // Implementation would enable/disable PiP mode
  }, []);
  
  return (
    <PanelContainer>
      <SectionTitle>
        <CameraOutlined />
        Camera Controls
      </SectionTitle>
      
      {/* Camera Mode Selection */}
      <CameraModeGrid>
        {availableModes.map(mode => (
          <Tooltip key={mode} title={CAMERA_MODE_INFO[mode].description}>
            <CameraModeButton
              active={activeMode === mode}
              onClick={() => handleModeChange(mode)}
              aria-label={`Switch to ${CAMERA_MODE_INFO[mode].label} camera`}
            >
              {CAMERA_MODE_INFO[mode].icon}
              <span>{CAMERA_MODE_INFO[mode].label}</span>
            </CameraModeButton>
          </Tooltip>
        ))}
      </CameraModeGrid>
      
      <Collapse defaultActiveKey={['settings']} ghost>
        {/* Camera Settings */}
        <Panel header="View Settings" key="settings">
          <SettingRow>
            <SettingLabel>Field of View</SettingLabel>
            <Slider
              min={30}
              max={120}
              value={fov}
              onChange={setFov}
              style={{ width: 150 }}
              marks={{ 30: '30°', 75: '75°', 120: '120°' }}
            />
          </SettingRow>
          
          <SettingRow>
            <SettingLabel>Near Plane</SettingLabel>
            <Slider
              min={0.01}
              max={1}
              step={0.01}
              value={nearPlane}
              onChange={setNearPlane}
              style={{ width: 150 }}
            />
          </SettingRow>
          
          <SettingRow>
            <SettingLabel>Far Plane</SettingLabel>
            <Slider
              min={100}
              max={2000}
              step={100}
              value={farPlane}
              onChange={setFarPlane}
              style={{ width: 150 }}
            />
          </SettingRow>
          
          <SettingRow>
            <SettingLabel>Damping</SettingLabel>
            <Slider
              min={0}
              max={0.2}
              step={0.01}
              value={dampingFactor}
              onChange={setDampingFactor}
              style={{ width: 150 }}
            />
          </SettingRow>
          
          <SettingRow>
            <SettingLabel>Auto Rotate</SettingLabel>
            <Switch
              checked={autoRotate}
              onChange={setAutoRotate}
              checkedChildren="On"
              unCheckedChildren="Off"
            />
          </SettingRow>
          
          {autoRotate && (
            <SettingRow>
              <SettingLabel>Rotate Speed</SettingLabel>
              <Slider
                min={0.1}
                max={2}
                step={0.1}
                value={autoRotateSpeed}
                onChange={setAutoRotateSpeed}
                style={{ width: 150 }}
              />
            </SettingRow>
          )}
          
          <SettingRow>
            <SettingLabel>Collision Detection</SettingLabel>
            <Switch
              checked={collisionDetection}
              onChange={setCollisionDetection}
              checkedChildren="On"
              unCheckedChildren="Off"
            />
          </SettingRow>
          
          <SettingRow>
            <SettingLabel>Auto Focus</SettingLabel>
            <Switch
              checked={autoFocus}
              onChange={setAutoFocus}
              checkedChildren="On"
              unCheckedChildren="Off"
            />
          </SettingRow>
        </Panel>
        
        {/* Split Screen Controls */}
        {enableSplitScreen && (
          <Panel header="Split Screen" key="splitscreen">
            <SettingRow>
              <SettingLabel>Mode</SettingLabel>
              <Select
                value={splitScreenMode}
                onChange={handleSplitScreenChange}
                style={{ width: 150 }}
              >
                <Option value="off">Off</Option>
                <Option value="horizontal">Horizontal</Option>
                <Option value="vertical">Vertical</Option>
                <Option value="quad">Quad</Option>
              </Select>
            </SettingRow>
            
            {splitScreenMode !== 'off' && (
              <div style={{ marginTop: theme.spacing.medium }}>
                <Tag color="blue">Configure each view in split mode</Tag>
              </div>
            )}
          </Panel>
        )}
        
        {/* Picture-in-Picture */}
        {enablePiP && (
          <Panel header="Picture-in-Picture" key="pip">
            <PiPPreview />
            <SettingRow>
              <SettingLabel>Enable PiP</SettingLabel>
              <Switch
                checked={pipEnabled}
                onChange={handlePiPToggle}
                checkedChildren="On"
                unCheckedChildren="Off"
              />
            </SettingRow>
            
            {pipEnabled && (
              <SettingRow>
                <SettingLabel>Position</SettingLabel>
                <Select
                  value={pipPosition}
                  onChange={setPipPosition}
                  style={{ width: 150 }}
                >
                  <Option value="top-left">Top Left</Option>
                  <Option value="top-right">Top Right</Option>
                  <Option value="bottom-left">Bottom Left</Option>
                  <Option value="bottom-right">Bottom Right</Option>
                </Select>
              </SettingRow>
            )}
          </Panel>
        )}
        
        {/* Camera Presets */}
        <Panel header="Camera Presets" key="presets">
          <PresetList>
            {presets.map(preset => (
              <PresetItem key={preset.id}>
                <span>{preset.name}</span>
                <Space>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => onPresetLoad && onPresetLoad(preset.id)}
                  >
                    Load
                  </Button>
                  <Popconfirm
                    title="Delete this preset?"
                    onConfirm={() => onPresetDelete && onPresetDelete(preset.id)}
                  >
                    <Button size="small" type="link" danger>
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              </PresetItem>
            ))}
          </PresetList>
          
          {showPresetInput ? (
            <Space style={{ marginTop: theme.spacing.small, width: '100%' }}>
              <Input
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="Preset name"
                onPressEnter={handlePresetSave}
                style={{ flex: 1 }}
              />
              <Button onClick={handlePresetSave} type="primary" icon={<SaveOutlined />} />
              <Button onClick={() => setShowPresetInput(false)}>Cancel</Button>
            </Space>
          ) : (
            <Button
              onClick={() => setShowPresetInput(true)}
              icon={<SaveOutlined />}
              style={{ marginTop: theme.spacing.small, width: '100%' }}
            >
              Save Current as Preset
            </Button>
          )}
        </Panel>
        
        {/* Camera Paths */}
        <Panel header="Camera Paths" key="paths">
          <Space style={{ marginBottom: theme.spacing.medium, width: '100%' }}>
            <Button
              type={isRecording ? 'danger' : 'primary'}
              icon={isRecording ? <PauseCircleOutlined /> : <RecordCircleOutlined />}
              onClick={handleRecordToggle}
              loading={isRecording}
            >
              {isRecording ? 'Stop Recording' : 'Record Path'}
            </Button>
          </Space>
          
          <PresetList>
            {savedPaths.map(path => (
              <PresetItem key={path.id}>
                <span>{path.name}</span>
                <Space>
                  <Button
                    size="small"
                    type="link"
                    icon={isPlaying && currentPlayingPath === path.id ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    onClick={() => handlePathPlay(path.id)}
                  >
                    {isPlaying && currentPlayingPath === path.id ? 'Stop' : 'Play'}
                  </Button>
                  <Popconfirm
                    title="Delete this path?"
                    onConfirm={() => onPathDelete && onPathDelete(path.id)}
                  >
                    <Button size="small" type="link" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </PresetItem>
            ))}
          </PresetList>
          
          {isPlaying && (
            <PathTimeline>
              <PathProgress style={{ '--progress': `${pathProgress * 100}%` } as any} />
              <span style={{ fontSize: theme.typography.sizes.small, color: theme.colors.text.secondary }}>
                {Math.round(pathProgress * 100)}%
              </span>
            </PathTimeline>
          )}
        </Panel>
      </Collapse>
    </PanelContainer>
  );
};

export default CameraControlPanel;
# Animation System Implementation Example

## Integration with Existing Rover Components

This document provides concrete implementation examples showing how the animation system integrates with the existing kinematics, physics, and visualization components.

## Core Animation Manager Implementation

```typescript
// File: frontend/src/components/Animation/AnimationManager.ts

import * as THREE from 'three';
import { EventEmitter } from 'events';
import { KinematicsSolver } from '../layout/MissionControl/KinematicsSystem';
import { RoverPhysicsRef } from '../layout/MissionControl/RoverPhysics';

export class AnimationManager extends EventEmitter implements IAnimationManager {
  private animations: Map<string, AnimationDefinition> = new Map();
  private activeAnimations: Map<string, AnimationInstance> = new Map();
  private timeline: TimelineSystem;
  private blender: AnimationBlender;
  private stateMachine: AnimationStateMachine;
  private parameters: Map<string, any> = new Map();
  private globalTimeScale: number = 1.0;
  
  // Integration references
  private kinematicsSolver?: KinematicsSolver;
  private physicsRef?: RoverPhysicsRef;
  private renderCallback?: (pose: AnimationPose) => void;
  
  constructor() {
    super();
    this.timeline = new TimelineSystem();
    this.blender = new AnimationBlender();
    this.stateMachine = new AnimationStateMachine();
    
    // Register default rover animations
    this.registerDefaultAnimations();
  }
  
  /**
   * Main update loop - called from React Three Fiber's useFrame
   */
  update(deltaTime: number): void {
    const scaledDelta = deltaTime * this.globalTimeScale;
    
    // Update timeline
    this.timeline.update(scaledDelta);
    
    // Update active animations
    for (const [id, instance] of this.activeAnimations) {
      if (instance.state === 'playing') {
        this.updateAnimation(instance, scaledDelta);
      }
    }
    
    // Update state machine
    this.stateMachine.update(scaledDelta);
    
    // Blend all active animations
    const finalPose = this.blendAnimations();
    
    // Apply to render system
    if (this.renderCallback && finalPose) {
      this.renderCallback(finalPose);
    }
    
    // Apply to kinematics
    if (this.kinematicsSolver && finalPose) {
      this.applyToKinematics(finalPose);
    }
    
    // Apply to physics
    if (this.physicsRef && finalPose) {
      this.applyToPhysics(finalPose);
    }
  }
  
  play(animationId: string, options: PlayOptions = {}): AnimationHandle {
    const definition = this.animations.get(animationId);
    if (!definition) {
      throw new Error(`Animation '${animationId}' not found`);
    }
    
    const instance = new AnimationInstance(definition, options);
    this.activeAnimations.set(instance.id, instance);
    
    // Handle fade in
    if (options.fadeIn) {
      this.blender.startBlend(instance.id, 0, 1, options.fadeIn);
    }
    
    // Emit start event
    this.emit(AnimationEvent.START, {
      timestamp: Date.now(),
      animationId: instance.id,
      data: { name: definition.name }
    });
    
    return instance.getHandle();
  }
  
  private updateAnimation(instance: AnimationInstance, deltaTime: number): void {
    instance.advance(deltaTime);
    
    // Check for completion
    if (instance.isComplete()) {
      if (instance.options.loop) {
        instance.restart();
        this.emit(AnimationEvent.LOOP, {
          timestamp: Date.now(),
          animationId: instance.id
        });
      } else {
        this.completeAnimation(instance);
      }
    }
    
    // Update callbacks
    if (instance.options.onUpdate) {
      instance.options.onUpdate(instance.progress);
    }
  }
  
  private blendAnimations(): AnimationPose | null {
    const activePoses: Array<{ pose: AnimationPose; weight: number }> = [];
    
    // Collect all active animation poses
    for (const [id, instance] of this.activeAnimations) {
      if (instance.state === 'playing') {
        const pose = instance.evaluate();
        const weight = this.blender.getWeight(id);
        activePoses.push({ pose, weight });
      }
    }
    
    if (activePoses.length === 0) return null;
    
    // Blend all poses
    return this.blender.blendMultiple(activePoses);
  }
  
  private applyToKinematics(pose: AnimationPose): void {
    if (!this.kinematicsSolver) return;
    
    // Apply joint rotations from animation
    for (const joint of pose.joints) {
      this.kinematicsSolver.setJointTarget(
        joint.name,
        joint.rotation.toEuler().y, // Assuming Y-axis rotation for simplicity
        joint.position?.y // For prismatic joints
      );
    }
  }
  
  private applyToPhysics(pose: AnimationPose): void {
    if (!this.physicsRef) return;
    
    // Apply transformations to physics bodies
    const bodies = this.physicsRef.getBodies();
    for (const body of bodies) {
      const joint = pose.getJoint(body.name);
      if (joint) {
        body.setTransform(joint.position, joint.rotation);
      }
    }
  }
  
  // Integration methods
  setKinematicsSolver(solver: KinematicsSolver): void {
    this.kinematicsSolver = solver;
  }
  
  setPhysicsRef(ref: RoverPhysicsRef): void {
    this.physicsRef = ref;
  }
  
  setRenderCallback(callback: (pose: AnimationPose) => void): void {
    this.renderCallback = callback;
  }
}
```

## React Component Integration

```typescript
// File: frontend/src/components/Animation/AnimationProvider.tsx

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AnimationManager } from './AnimationManager';
import { TelemetryAnimationDriver } from './TelemetryAnimationDriver';
import { useWebSocket } from '../WebSocket/WebSocketProvider';

interface AnimationContextValue {
  manager: AnimationManager;
  telemetryDriver: TelemetryAnimationDriver;
}

const AnimationContext = createContext<AnimationContextValue | null>(null);

export const AnimationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const managerRef = useRef<AnimationManager>();
  const telemetryDriverRef = useRef<TelemetryAnimationDriver>();
  const { telemetryStream } = useWebSocket();
  
  // Initialize animation system
  useEffect(() => {
    managerRef.current = new AnimationManager();
    telemetryDriverRef.current = new TelemetryAnimationDriver(managerRef.current);
    
    // Connect telemetry
    if (telemetryStream) {
      telemetryDriverRef.current.connect({
        stream: telemetryStream,
        updateRate: 30
      });
      
      // Map telemetry to animations
      telemetryDriverRef.current.mapParameters([
        {
          telemetryKey: 'rover.wheels.speed',
          parameterName: 'wheelSpeed',
          transform: (speed: number) => Math.abs(speed)
        },
        {
          telemetryKey: 'rover.arm.position',
          parameterName: 'armPosition',
          smooth: 0.1
        },
        {
          telemetryKey: 'rover.camera.angle',
          parameterName: 'cameraAngle',
          clamp: { min: -180, max: 180 }
        }
      ]);
    }
    
    return () => {
      managerRef.current?.destroy();
      telemetryDriverRef.current?.disconnect();
    };
  }, [telemetryStream]);
  
  // Update animation system each frame
  useFrame((state, delta) => {
    managerRef.current?.update(delta);
  });
  
  const value = {
    manager: managerRef.current!,
    telemetryDriver: telemetryDriverRef.current!
  };
  
  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  );
};

export const useAnimation = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimation must be used within AnimationProvider');
  }
  return context;
};
```

## Rover Animation Hook Implementation

```typescript
// File: frontend/src/hooks/useRoverAnimation.ts

import { useCallback, useEffect, useState } from 'react';
import { useAnimation } from '../components/Animation/AnimationProvider';
import { RoverAnimation, PlayOptions, AnimationHandle } from '../types/animation';

export function useRoverAnimation() {
  const { manager } = useAnimation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeHandle, setActiveHandle] = useState<AnimationHandle | null>(null);
  
  // Play animation
  const play = useCallback(async (
    animation: RoverAnimation,
    options?: PlayOptions
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Stop current animation if playing
        if (activeHandle) {
          activeHandle.stop();
        }
        
        // Play new animation
        const handle = manager.play(animation, {
          ...options,
          onComplete: () => {
            setIsPlaying(false);
            setCurrentAnimation(null);
            setProgress(0);
            setActiveHandle(null);
            options?.onComplete?.();
            resolve();
          },
          onUpdate: (prog) => {
            setProgress(prog);
            options?.onUpdate?.(prog);
          }
        });
        
        setActiveHandle(handle);
        setIsPlaying(true);
        setCurrentAnimation(animation);
      } catch (error) {
        reject(error);
      }
    });
  }, [manager, activeHandle]);
  
  // Stop animation
  const stop = useCallback(() => {
    if (activeHandle) {
      activeHandle.stop();
      setIsPlaying(false);
      setCurrentAnimation(null);
      setProgress(0);
      setActiveHandle(null);
    }
  }, [activeHandle]);
  
  // Pause animation
  const pause = useCallback(() => {
    if (activeHandle) {
      activeHandle.pause();
      setIsPlaying(false);
    }
  }, [activeHandle]);
  
  // Resume animation
  const resume = useCallback(() => {
    if (activeHandle && activeHandle.state === 'paused') {
      activeHandle.play();
      setIsPlaying(true);
    }
  }, [activeHandle]);
  
  // Component-specific controls
  const arm = {
    deploy: () => play(RoverAnimation.ARM_DEPLOY),
    stow: () => play(RoverAnimation.ARM_STOW),
    moveTo: async (position: THREE.Vector3) => {
      // Create dynamic IK animation
      const animation = manager.createIKAnimation('robotic_arm', position, 2.0);
      return play(animation);
    },
    setJoint: (joint: string, angle: number) => {
      manager.setParameter(`arm.${joint}.angle`, angle);
    },
    grab: () => play(RoverAnimation.ARM_GRAB),
    release: () => play(RoverAnimation.ARM_RELEASE)
  };
  
  const camera = {
    scan: (range: number = 360) => {
      manager.setParameter('camera.scanRange', range);
      return play(RoverAnimation.CAMERA_SCAN_360);
    },
    lookAt: async (target: THREE.Vector3) => {
      const animation = manager.createLookAtAnimation('mast_camera', target, 1.0);
      return play(animation);
    },
    track: (targetId: string) => {
      manager.startTracking('mast_camera', targetId);
    },
    stopTracking: () => {
      manager.stopTracking('mast_camera');
    },
    capture: () => play(RoverAnimation.CAMERA_CAPTURE)
  };
  
  const wheels = {
    setSpeed: (speed: number) => {
      manager.setParameter('wheels.targetSpeed', speed);
    },
    setTurnRate: (rate: number) => {
      manager.setParameter('wheels.turnRate', rate);
    },
    brake: () => {
      manager.setParameter('wheels.targetSpeed', 0);
      return play(RoverAnimation.WHEELS_BRAKE);
    }
  };
  
  const antenna = {
    deploy: () => play(RoverAnimation.ANTENNA_DEPLOY),
    track: (target: 'earth' | 'satellite') => {
      manager.setParameter('antenna.trackTarget', target);
      return play(RoverAnimation.ANTENNA_TRACK);
    },
    stow: () => play(RoverAnimation.ANTENNA_STOW)
  };
  
  return {
    play,
    stop,
    pause,
    resume,
    state: {
      isPlaying,
      current: currentAnimation,
      progress
    },
    arm,
    camera,
    wheels,
    antenna
  };
}
```

## Integration with Existing Components

### Enhanced RoverVisualization3D Component

```typescript
// File: frontend/src/components/layout/MissionControl/RoverVisualization3DAnimated.tsx

import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { useRoverAnimation } from '../../../hooks/useRoverAnimation';
import { AnimationProvider } from '../../Animation/AnimationProvider';
import { DetailedRoverModel } from './DetailedRoverModel';
import KinematicsSystem from './KinematicsSystem';
import RoverPhysics from './RoverPhysics';

interface RoverVisualization3DAnimatedProps {
  enablePhysics?: boolean;
  enableAnimation?: boolean;
  telemetryData?: any;
}

export const RoverVisualization3DAnimated: React.FC<RoverVisualization3DAnimatedProps> = ({
  enablePhysics = true,
  enableAnimation = true,
  telemetryData
}) => {
  const roverRef = useRef<Group>(null);
  const animation = useRoverAnimation();
  
  // Example: Animate based on telemetry
  useEffect(() => {
    if (!telemetryData || !enableAnimation) return;
    
    // Auto-deploy arm when reaching waypoint
    if (telemetryData.waypointReached && telemetryData.waypointType === 'sample') {
      animation.arm.deploy();
    }
    
    // Adjust wheel speed based on telemetry
    if (telemetryData.wheelSpeed !== undefined) {
      animation.wheels.setSpeed(telemetryData.wheelSpeed);
    }
    
    // Camera tracking
    if (telemetryData.trackingTarget) {
      animation.camera.track(telemetryData.trackingTarget);
    }
  }, [telemetryData, animation, enableAnimation]);
  
  // Animation update loop
  useFrame((state, delta) => {
    if (!roverRef.current || !enableAnimation) return;
    
    // The animation system automatically updates through the provider
    // Additional per-frame logic can go here
  });
  
  return (
    <AnimationProvider>
      <group ref={roverRef}>
        {/* Rover model with animation support */}
        <DetailedRoverModel
          animated={enableAnimation}
          onJointUpdate={(joints) => {
            // Joints are automatically updated by the animation system
          }}
        />
        
        {/* Kinematics system integration */}
        <KinematicsSystem
          onJointUpdate={(joints) => {
            // Forward kinematics updates to animation system
            if (enableAnimation) {
              animation.manager.updateKinematicsJoints(joints);
            }
          }}
        />
        
        {/* Physics integration */}
        {enablePhysics && (
          <RoverPhysics
            onPhysicsUpdate={(state) => {
              // Physics can drive animations
              if (enableAnimation && state.collision) {
                animation.play(RoverAnimation.COLLISION_RESPONSE);
              }
            }}
          />
        )}
      </group>
    </AnimationProvider>
  );
};
```

### Animation Control Panel

```typescript
// File: frontend/src/components/Animation/AnimationControlPanel.tsx

import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  ButtonGroup, 
  Slider,
  FormControlLabel,
  Switch,
  Select,
  MenuItem
} from '@mui/material';
import { useRoverAnimation } from '../../hooks/useRoverAnimation';
import { RoverAnimation } from '../../types/animation';

export const AnimationControlPanel: React.FC = () => {
  const animation = useRoverAnimation();
  const [selectedAnimation, setSelectedAnimation] = React.useState<RoverAnimation>(
    RoverAnimation.ARM_DEPLOY
  );
  const [loop, setLoop] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);
  
  const handlePlay = () => {
    animation.play(selectedAnimation, {
      loop: loop ? -1 : 0,
      speed
    });
  };
  
  return (
    <Paper sx={{ p: 2, m: 2 }}>
      <Typography variant="h6" gutterBottom>
        Animation Controls
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Animation selection */}
        <Select
          value={selectedAnimation}
          onChange={(e) => setSelectedAnimation(e.target.value as RoverAnimation)}
          fullWidth
        >
          <MenuItem value={RoverAnimation.ARM_DEPLOY}>Arm Deploy</MenuItem>
          <MenuItem value={RoverAnimation.ARM_STOW}>Arm Stow</MenuItem>
          <MenuItem value={RoverAnimation.CAMERA_SCAN_360}>Camera Scan</MenuItem>
          <MenuItem value={RoverAnimation.ANTENNA_DEPLOY}>Antenna Deploy</MenuItem>
          <MenuItem value={RoverAnimation.MOVE_FORWARD}>Move Forward</MenuItem>
          <MenuItem value={RoverAnimation.DISCOVERY_DANCE}>Discovery Dance</MenuItem>
        </Select>
        
        {/* Playback controls */}
        <ButtonGroup variant="contained" fullWidth>
          <Button onClick={handlePlay} disabled={animation.state.isPlaying}>
            Play
          </Button>
          <Button onClick={animation.pause} disabled={!animation.state.isPlaying}>
            Pause
          </Button>
          <Button onClick={animation.resume} disabled={animation.state.isPlaying}>
            Resume
          </Button>
          <Button onClick={animation.stop}>
            Stop
          </Button>
        </ButtonGroup>
        
        {/* Animation options */}
        <FormControlLabel
          control={<Switch checked={loop} onChange={(e) => setLoop(e.target.checked)} />}
          label="Loop"
        />
        
        <Box>
          <Typography gutterBottom>Speed: {speed}x</Typography>
          <Slider
            value={speed}
            onChange={(_, value) => setSpeed(value as number)}
            min={0.1}
            max={3}
            step={0.1}
            marks
          />
        </Box>
        
        {/* Progress indicator */}
        {animation.state.isPlaying && (
          <Box>
            <Typography variant="body2">
              Current: {animation.state.current}
            </Typography>
            <Slider
              value={animation.state.progress * 100}
              disabled
              sx={{ mt: 1 }}
            />
          </Box>
        )}
        
        {/* Quick actions */}
        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          Quick Actions
        </Typography>
        <ButtonGroup size="small" fullWidth>
          <Button onClick={() => animation.arm.deploy()}>Deploy Arm</Button>
          <Button onClick={() => animation.camera.scan()}>Scan Area</Button>
          <Button onClick={() => animation.wheels.brake()}>Emergency Stop</Button>
        </ButtonGroup>
      </Box>
    </Paper>
  );
};
```

## Telemetry-Driven Animation Example

```typescript
// File: frontend/src/components/Animation/TelemetryAnimationExample.tsx

import React, { useEffect } from 'react';
import { useAnimation } from './AnimationProvider';
import { useWebSocket } from '../WebSocket/WebSocketProvider';
import { RoverAnimation } from '../../types/animation';

export const TelemetryAnimationIntegration: React.FC = () => {
  const { telemetryDriver, manager } = useAnimation();
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    // Configure telemetry-driven animations
    telemetryDriver.addTrigger({
      name: 'Low Battery Warning',
      condition: {
        type: 'threshold',
        parameter: 'battery_level',
        operator: '<',
        value: 20
      },
      animation: RoverAnimation.LOW_BATTERY_WARNING,
      options: {
        priority: 10,
        interruptible: false
      }
    });
    
    telemetryDriver.addTrigger({
      name: 'Obstacle Detected',
      condition: {
        type: 'event',
        event: 'obstacle_detected'
      },
      animation: RoverAnimation.OBSTACLE_AVOIDANCE,
      options: {
        immediate: true
      }
    });
    
    telemetryDriver.addTrigger({
      name: 'Sample Collection',
      condition: {
        type: 'compound',
        conditions: [
          { parameter: 'at_waypoint', operator: '==', value: true },
          { parameter: 'waypoint_type', operator: '==', value: 'sample' }
        ]
      },
      animation: RoverAnimation.SAMPLE_COLLECTION_SEQUENCE
    });
    
    // Procedural animations based on telemetry
    const unsubscribe = subscribe('telemetry', (data) => {
      // Wheel rotation based on speed
      if (data.wheel_speeds) {
        const avgSpeed = data.wheel_speeds.reduce((a: number, b: number) => a + b) / data.wheel_speeds.length;
        manager.setParameter('wheel_rotation_speed', avgSpeed * 0.5);
      }
      
      // Suspension height based on terrain
      if (data.suspension_travel) {
        data.suspension_travel.forEach((travel: number, index: number) => {
          manager.setParameter(`suspension_${index}_height`, travel);
        });
      }
      
      // Camera tracking based on sun position
      if (data.sun_angle !== undefined) {
        manager.setParameter('solar_panel_angle', data.sun_angle);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [telemetryDriver, manager, subscribe]);
  
  return null; // This component only sets up the integration
};
```

This implementation example demonstrates how the animation system integrates seamlessly with existing components while providing powerful features for complex rover animations.
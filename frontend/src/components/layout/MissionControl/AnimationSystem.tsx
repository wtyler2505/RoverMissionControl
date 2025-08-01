/**
 * AnimationSystem Component
 * 
 * Advanced animation engine supporting keyframe, procedural, and physics-driven animations.
 * Integrates with KinematicsSystem for rover articulation and movement animations.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Joint, KinematicChain } from './KinematicsSystem';

// ========== Types ==========

export interface AnimationKeyframe {
  time: number;
  value: any;
  easing?: EasingFunction;
  interpolation?: InterpolationType;
}

export interface AnimationTrack {
  id: string;
  name: string;
  type: 'transform' | 'joint' | 'material' | 'custom';
  targetId: string;
  property: string;
  keyframes: AnimationKeyframe[];
  enabled: boolean;
  weight: number;
  blendMode?: BlendMode;
}

export interface AnimationClip {
  id: string;
  name: string;
  duration: number;
  tracks: AnimationTrack[];
  loop: boolean;
  loopCount?: number;
  speed: number;
  metadata?: {
    creator?: string;
    created?: Date;
    modified?: Date;
    tags?: string[];
    description?: string;
  };
}

export interface AnimationState {
  clipId: string;
  time: number;
  isPlaying: boolean;
  weight: number;
  timeScale: number;
  currentLoop: number;
  fadeInTime?: number;
  fadeOutTime?: number;
}

export interface AnimationLayer {
  id: string;
  name: string;
  states: AnimationState[];
  weight: number;
  blendMode: BlendMode;
  enabled: boolean;
}

export interface AnimationEvent {
  id: string;
  clipId: string;
  time: number;
  type: 'trigger' | 'sound' | 'particle' | 'custom';
  data: any;
  fired?: boolean;
}

export interface ProceduralAnimation {
  id: string;
  name: string;
  type: 'noise' | 'sine' | 'physics' | 'custom';
  targetId: string;
  property: string;
  parameters: { [key: string]: number };
  weight: number;
  enabled: boolean;
}

export interface PhysicsAnimation {
  id: string;
  name: string;
  type: 'spring' | 'pendulum' | 'ragdoll' | 'soft-body';
  targetId: string;
  config: {
    mass?: number;
    stiffness?: number;
    damping?: number;
    gravity?: THREE.Vector3;
    constraints?: any[];
  };
  enabled: boolean;
}

export type EasingFunction = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 
  'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad' |
  'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' |
  'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic' |
  'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce';

export type InterpolationType = 'linear' | 'step' | 'cubic' | 'bezier';
export type BlendMode = 'override' | 'additive' | 'multiply' | 'screen';

export interface AnimationMixerState {
  layers: AnimationLayer[];
  globalWeight: number;
  timeScale: number;
}

export interface AnimationSystemConfig {
  maxLayers: number;
  defaultFadeTime: number;
  enableEvents: boolean;
  enableProcedural: boolean;
  enablePhysics: boolean;
  updateRate: number;
}

// ========== Default Configuration ==========

const DEFAULT_CONFIG: AnimationSystemConfig = {
  maxLayers: 8,
  defaultFadeTime: 0.3,
  enableEvents: true,
  enableProcedural: true,
  enablePhysics: true,
  updateRate: 60
};

// ========== Easing Functions ==========

const EASING_FUNCTIONS: { [key: string]: (t: number) => number } = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    const p = 0.3;
    const s = p / 4;
    return -(Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1 - s) * (2 * Math.PI) / p));
  },
  easeOutElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    const p = 0.3;
    const s = p / 4;
    return Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
  },
  easeInOutElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    const p = 0.45;
    const s = p / 4;
    if (t < 0.5) {
      return -0.5 * Math.pow(2, 10 * (t * 2 - 1)) * Math.sin(((t * 2 - 1) - s) * (2 * Math.PI) / p);
    }
    return Math.pow(2, -10 * (t * 2 - 1)) * Math.sin(((t * 2 - 1) - s) * (2 * Math.PI) / p) * 0.5 + 1;
  },
  easeInBounce: (t: number) => {
    return 1 - EASING_FUNCTIONS.easeOutBounce(1 - t);
  },
  easeOutBounce: (t: number) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  },
  easeInOutBounce: (t: number) => {
    return t < 0.5
      ? EASING_FUNCTIONS.easeInBounce(t * 2) * 0.5
      : EASING_FUNCTIONS.easeOutBounce(t * 2 - 1) * 0.5 + 0.5;
  }
};

// ========== Animation Mixer ==========

class AnimationMixer {
  private clips: Map<string, AnimationClip> = new Map();
  private layers: Map<string, AnimationLayer> = new Map();
  private events: Map<string, AnimationEvent[]> = new Map();
  private proceduralAnims: Map<string, ProceduralAnimation> = new Map();
  private physicsAnims: Map<string, PhysicsAnimation> = new Map();
  private config: AnimationSystemConfig;
  private time: number = 0;

  constructor(config: AnimationSystemConfig) {
    this.config = config;
    this.initializeLayers();
  }

  private initializeLayers(): void {
    // Create default base layer
    this.layers.set('base', {
      id: 'base',
      name: 'Base Layer',
      states: [],
      weight: 1.0,
      blendMode: 'override',
      enabled: true
    });
  }

  // Add animation clip
  addClip(clip: AnimationClip): void {
    this.clips.set(clip.id, clip);
    
    // Extract events from clip metadata
    if (clip.metadata?.tags?.includes('events')) {
      this.extractEvents(clip);
    }
  }

  // Play animation
  play(clipId: string, layerId: string = 'base', fadeInTime?: number): AnimationState | null {
    const clip = this.clips.get(clipId);
    const layer = this.layers.get(layerId);
    
    if (!clip || !layer) return null;

    const state: AnimationState = {
      clipId,
      time: 0,
      isPlaying: true,
      weight: 0,
      timeScale: clip.speed,
      currentLoop: 0,
      fadeInTime: fadeInTime ?? this.config.defaultFadeTime
    };

    layer.states.push(state);
    return state;
  }

  // Stop animation
  stop(clipId: string, layerId: string = 'base', fadeOutTime?: number): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    const state = layer.states.find(s => s.clipId === clipId);
    if (state) {
      state.fadeOutTime = fadeOutTime ?? this.config.defaultFadeTime;
      state.isPlaying = false;
    }
  }

  // Update mixer
  update(deltaTime: number): any[] {
    this.time += deltaTime;
    const results: any[] = [];

    // Update each layer
    this.layers.forEach(layer => {
      if (!layer.enabled) return;

      // Update states in layer
      layer.states = layer.states.filter(state => {
        const clip = this.clips.get(state.clipId);
        if (!clip) return false;

        // Update time
        if (state.isPlaying) {
          state.time += deltaTime * state.timeScale;

          // Handle looping
          if (state.time >= clip.duration) {
            if (clip.loop) {
              state.currentLoop++;
              if (!clip.loopCount || state.currentLoop < clip.loopCount) {
                state.time = state.time % clip.duration;
              } else {
                state.isPlaying = false;
              }
            } else {
              state.isPlaying = false;
              state.time = clip.duration;
            }
          }
        }

        // Update weight
        if (state.fadeInTime !== undefined && state.fadeInTime > 0) {
          state.weight = Math.min(1, state.weight + deltaTime / state.fadeInTime);
          if (state.weight >= 1) state.fadeInTime = undefined;
        }
        
        if (state.fadeOutTime !== undefined && state.fadeOutTime > 0) {
          state.weight = Math.max(0, state.weight - deltaTime / state.fadeOutTime);
          if (state.weight <= 0) return false; // Remove state
        }

        // Evaluate tracks
        const trackResults = this.evaluateTracks(clip, state, layer);
        results.push(...trackResults);

        return true; // Keep state
      });
    });

    // Process procedural animations
    if (this.config.enableProcedural) {
      const proceduralResults = this.updateProceduralAnimations(deltaTime);
      results.push(...proceduralResults);
    }

    // Process physics animations
    if (this.config.enablePhysics) {
      const physicsResults = this.updatePhysicsAnimations(deltaTime);
      results.push(...physicsResults);
    }

    // Process events
    if (this.config.enableEvents) {
      this.processEvents();
    }

    return results;
  }

  private evaluateTracks(clip: AnimationClip, state: AnimationState, layer: AnimationLayer): any[] {
    const results: any[] = [];

    clip.tracks.forEach(track => {
      if (!track.enabled) return;

      const value = this.interpolateTrack(track, state.time);
      const weight = state.weight * track.weight * layer.weight;

      results.push({
        targetId: track.targetId,
        property: track.property,
        value,
        weight,
        blendMode: track.blendMode || layer.blendMode,
        type: track.type
      });
    });

    return results;
  }

  private interpolateTrack(track: AnimationTrack, time: number): any {
    const keyframes = track.keyframes;
    if (keyframes.length === 0) return null;
    if (keyframes.length === 1) return keyframes[0].value;

    // Find surrounding keyframes
    let prevKey = keyframes[0];
    let nextKey = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (time >= keyframes[i].time && time <= keyframes[i + 1].time) {
        prevKey = keyframes[i];
        nextKey = keyframes[i + 1];
        break;
      }
    }

    // Calculate interpolation factor
    const duration = nextKey.time - prevKey.time;
    const elapsed = time - prevKey.time;
    let t = duration > 0 ? elapsed / duration : 0;

    // Apply easing
    const easingFunc = EASING_FUNCTIONS[nextKey.easing || 'linear'];
    if (easingFunc) t = easingFunc(t);

    // Interpolate based on type
    return this.interpolateValues(prevKey.value, nextKey.value, t, nextKey.interpolation || 'linear');
  }

  private interpolateValues(a: any, b: any, t: number, type: InterpolationType): any {
    switch (type) {
      case 'step':
        return t < 1 ? a : b;
      
      case 'linear':
      default:
        if (typeof a === 'number' && typeof b === 'number') {
          return a + (b - a) * t;
        } else if (a instanceof THREE.Vector3 && b instanceof THREE.Vector3) {
          return new THREE.Vector3().lerpVectors(a, b, t);
        } else if (a instanceof THREE.Quaternion && b instanceof THREE.Quaternion) {
          return new THREE.Quaternion().slerpQuaternions(a, b, t);
        } else if (a instanceof THREE.Color && b instanceof THREE.Color) {
          return new THREE.Color().lerpColors(a, b, t);
        }
        return t < 0.5 ? a : b;
    }
  }

  private updateProceduralAnimations(deltaTime: number): any[] {
    const results: any[] = [];

    this.proceduralAnims.forEach(anim => {
      if (!anim.enabled) return;

      let value: any;
      const t = this.time;

      switch (anim.type) {
        case 'sine':
          value = Math.sin(t * (anim.parameters.frequency || 1)) * (anim.parameters.amplitude || 1);
          break;
        
        case 'noise':
          // Simple noise implementation
          value = (Math.sin(t * 1.3) + Math.sin(t * 2.1) + Math.sin(t * 3.7)) / 3 * (anim.parameters.amplitude || 1);
          break;
        
        case 'custom':
          // Custom procedural function would go here
          value = 0;
          break;
        
        default:
          value = 0;
      }

      results.push({
        targetId: anim.targetId,
        property: anim.property,
        value,
        weight: anim.weight,
        blendMode: 'additive',
        type: 'procedural'
      });
    });

    return results;
  }

  private updatePhysicsAnimations(deltaTime: number): any[] {
    const results: any[] = [];

    this.physicsAnims.forEach(anim => {
      if (!anim.enabled) return;

      // Simple physics simulation
      // In a real implementation, this would integrate with a physics engine
      let value: any;

      switch (anim.type) {
        case 'spring':
          // Spring physics placeholder
          value = 0;
          break;
        
        case 'pendulum':
          // Pendulum physics placeholder
          value = 0;
          break;
        
        default:
          value = 0;
      }

      results.push({
        targetId: anim.targetId,
        property: 'physics_' + anim.type,
        value,
        weight: 1.0,
        blendMode: 'override',
        type: 'physics'
      });
    });

    return results;
  }

  private extractEvents(clip: AnimationClip): void {
    // Extract events from clip metadata
    // This is a placeholder - in real implementation, events would be defined in clip data
    const events: AnimationEvent[] = [];
    this.events.set(clip.id, events);
  }

  private processEvents(): void {
    this.layers.forEach(layer => {
      layer.states.forEach(state => {
        const events = this.events.get(state.clipId);
        if (!events) return;

        events.forEach(event => {
          if (!event.fired && state.time >= event.time) {
            // Fire event
            event.fired = true;
            // Event handling would go here
          }
        });
      });
    });
  }

  // Create layer
  createLayer(id: string, name: string, blendMode: BlendMode = 'override'): AnimationLayer {
    const layer: AnimationLayer = {
      id,
      name,
      states: [],
      weight: 1.0,
      blendMode,
      enabled: true
    };
    
    this.layers.set(id, layer);
    return layer;
  }

  // Get layer
  getLayer(id: string): AnimationLayer | undefined {
    return this.layers.get(id);
  }

  // Add procedural animation
  addProceduralAnimation(anim: ProceduralAnimation): void {
    this.proceduralAnims.set(anim.id, anim);
  }

  // Add physics animation
  addPhysicsAnimation(anim: PhysicsAnimation): void {
    this.physicsAnims.set(anim.id, anim);
  }
}

// ========== React Component ==========

export interface AnimationSystemProps {
  config?: Partial<AnimationSystemConfig>;
  clips?: AnimationClip[];
  onAnimationUpdate?: (results: any[]) => void;
  onEventTrigger?: (event: AnimationEvent) => void;
  debug?: boolean;
}

export interface AnimationSystemRef {
  mixer: AnimationMixer;
  play: (clipId: string, layerId?: string, fadeIn?: number) => void;
  stop: (clipId: string, layerId?: string, fadeOut?: number) => void;
  pause: (clipId: string, layerId?: string) => void;
  resume: (clipId: string, layerId?: string) => void;
  createLayer: (id: string, name: string, blendMode?: BlendMode) => void;
  addClip: (clip: AnimationClip) => void;
  addProceduralAnimation: (anim: ProceduralAnimation) => void;
  addPhysicsAnimation: (anim: PhysicsAnimation) => void;
}

export const AnimationSystem = React.forwardRef<AnimationSystemRef, AnimationSystemProps>(({
  config = {},
  clips = [],
  onAnimationUpdate,
  onEventTrigger,
  debug = false
}, ref) => {
  const mixerRef = useRef<AnimationMixer>();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize mixer
  useEffect(() => {
    mixerRef.current = new AnimationMixer({ ...DEFAULT_CONFIG, ...config });
    
    // Add initial clips
    clips.forEach(clip => {
      mixerRef.current!.addClip(clip);
    });

    setIsInitialized(true);
  }, []);

  // Animation controls
  const play = useCallback((clipId: string, layerId?: string, fadeIn?: number) => {
    if (!mixerRef.current) return;
    mixerRef.current.play(clipId, layerId, fadeIn);
  }, []);

  const stop = useCallback((clipId: string, layerId?: string, fadeOut?: number) => {
    if (!mixerRef.current) return;
    mixerRef.current.stop(clipId, layerId, fadeOut);
  }, []);

  const pause = useCallback((clipId: string, layerId?: string) => {
    if (!mixerRef.current) return;
    const layer = mixerRef.current.getLayer(layerId || 'base');
    if (!layer) return;
    
    const state = layer.states.find(s => s.clipId === clipId);
    if (state) state.isPlaying = false;
  }, []);

  const resume = useCallback((clipId: string, layerId?: string) => {
    if (!mixerRef.current) return;
    const layer = mixerRef.current.getLayer(layerId || 'base');
    if (!layer) return;
    
    const state = layer.states.find(s => s.clipId === clipId);
    if (state) state.isPlaying = true;
  }, []);

  const createLayer = useCallback((id: string, name: string, blendMode?: BlendMode) => {
    if (!mixerRef.current) return;
    mixerRef.current.createLayer(id, name, blendMode);
  }, []);

  const addClip = useCallback((clip: AnimationClip) => {
    if (!mixerRef.current) return;
    mixerRef.current.addClip(clip);
  }, []);

  const addProceduralAnimation = useCallback((anim: ProceduralAnimation) => {
    if (!mixerRef.current) return;
    mixerRef.current.addProceduralAnimation(anim);
  }, []);

  const addPhysicsAnimation = useCallback((anim: PhysicsAnimation) => {
    if (!mixerRef.current) return;
    mixerRef.current.addPhysicsAnimation(anim);
  }, []);

  // Expose ref
  React.useImperativeHandle(ref, () => ({
    mixer: mixerRef.current!,
    play,
    stop,
    pause,
    resume,
    createLayer,
    addClip,
    addProceduralAnimation,
    addPhysicsAnimation
  }), [play, stop, pause, resume, createLayer, addClip, addProceduralAnimation, addPhysicsAnimation]);

  // Update loop
  useFrame((state, delta) => {
    if (!mixerRef.current || !isInitialized) return;

    const results = mixerRef.current.update(delta);
    
    if (onAnimationUpdate && results.length > 0) {
      onAnimationUpdate(results);
    }
  });

  // Debug visualization
  const renderDebug = () => {
    if (!debug || !mixerRef.current) return null;

    return (
      <group name="animation-debug">
        {/* Debug visualization would go here */}
      </group>
    );
  };

  return (
    <>
      {renderDebug()}
    </>
  );
});

AnimationSystem.displayName = 'AnimationSystem';

// ========== Preset Animations ==========

export const ROVER_PRESET_ANIMATIONS: AnimationClip[] = [
  {
    id: 'arm_deployment',
    name: 'Arm Deployment Sequence',
    duration: 5,
    speed: 1,
    loop: false,
    tracks: [
      {
        id: 'arm_base_rotation',
        name: 'Arm Base Rotation',
        type: 'joint',
        targetId: 'arm_base',
        property: 'angle',
        enabled: true,
        weight: 1,
        keyframes: [
          { time: 0, value: 0, easing: 'easeInOut' },
          { time: 2, value: Math.PI / 4, easing: 'easeInOut' },
          { time: 5, value: Math.PI / 3, easing: 'easeOut' }
        ]
      },
      {
        id: 'arm_shoulder_rotation',
        name: 'Arm Shoulder Rotation',
        type: 'joint',
        targetId: 'arm_shoulder',
        property: 'angle',
        enabled: true,
        weight: 1,
        keyframes: [
          { time: 0, value: -Math.PI / 2, easing: 'easeInOut' },
          { time: 1.5, value: -Math.PI / 4, easing: 'easeInOut' },
          { time: 3, value: 0, easing: 'easeInOut' },
          { time: 5, value: Math.PI / 6, easing: 'easeOut' }
        ]
      },
      {
        id: 'arm_elbow_rotation',
        name: 'Arm Elbow Rotation',
        type: 'joint',
        targetId: 'arm_elbow',
        property: 'angle',
        enabled: true,
        weight: 1,
        keyframes: [
          { time: 0, value: -Math.PI * 0.7, easing: 'easeInOut' },
          { time: 2, value: -Math.PI / 2, easing: 'easeInOut' },
          { time: 4, value: -Math.PI / 4, easing: 'easeInOut' },
          { time: 5, value: -Math.PI / 6, easing: 'easeOut' }
        ]
      }
    ],
    metadata: {
      description: 'Full deployment sequence for the robotic arm',
      tags: ['arm', 'deployment', 'sequence']
    }
  },
  {
    id: 'camera_scan_pattern',
    name: 'Camera Scanning Pattern',
    duration: 8,
    speed: 1,
    loop: true,
    tracks: [
      {
        id: 'mast_pan',
        name: 'Mast Pan',
        type: 'joint',
        targetId: 'mast_pan',
        property: 'angle',
        enabled: true,
        weight: 1,
        keyframes: [
          { time: 0, value: -Math.PI / 2, easing: 'easeInOut' },
          { time: 2, value: 0, easing: 'linear' },
          { time: 4, value: Math.PI / 2, easing: 'linear' },
          { time: 6, value: 0, easing: 'linear' },
          { time: 8, value: -Math.PI / 2, easing: 'easeInOut' }
        ]
      },
      {
        id: 'mast_tilt',
        name: 'Mast Tilt',
        type: 'joint',
        targetId: 'mast_tilt',
        property: 'angle',
        enabled: true,
        weight: 1,
        keyframes: [
          { time: 0, value: 0, easing: 'easeInOut' },
          { time: 2, value: Math.PI / 6, easing: 'easeInOut' },
          { time: 4, value: 0, easing: 'easeInOut' },
          { time: 6, value: -Math.PI / 6, easing: 'easeInOut' },
          { time: 8, value: 0, easing: 'easeInOut' }
        ]
      }
    ],
    metadata: {
      description: 'Panoramic scanning pattern for the mast camera',
      tags: ['camera', 'scan', 'panoramic']
    }
  },
  {
    id: 'wheel_calibration',
    name: 'Wheel Calibration Routine',
    duration: 6,
    speed: 1,
    loop: false,
    tracks: [
      {
        id: 'wheel_test',
        name: 'Wheel Test Rotation',
        type: 'custom',
        targetId: 'wheels',
        property: 'calibration',
        enabled: true,
        weight: 1,
        keyframes: [
          { time: 0, value: { speed: 0, steering: 0 }, easing: 'easeIn' },
          { time: 1, value: { speed: 0.5, steering: 0 }, easing: 'linear' },
          { time: 2, value: { speed: 0, steering: 0.5 }, easing: 'linear' },
          { time: 3, value: { speed: 0, steering: -0.5 }, easing: 'linear' },
          { time: 4, value: { speed: -0.5, steering: 0 }, easing: 'linear' },
          { time: 5, value: { speed: 0, steering: 0 }, easing: 'easeOut' },
          { time: 6, value: { speed: 0, steering: 0 }, easing: 'linear' }
        ]
      }
    ],
    metadata: {
      description: 'Calibration routine for wheel motors and steering',
      tags: ['wheels', 'calibration', 'diagnostic']
    }
  },
  {
    id: 'emergency_stop',
    name: 'Emergency Stop Animation',
    duration: 0.5,
    speed: 2,
    loop: false,
    tracks: [
      {
        id: 'all_stop',
        name: 'All Systems Stop',
        type: 'custom',
        targetId: 'all',
        property: 'emergency',
        enabled: true,
        weight: 1,
        blendMode: 'override',
        keyframes: [
          { time: 0, value: { active: false }, easing: 'linear' },
          { time: 0.5, value: { active: true }, easing: 'easeOutQuad' }
        ]
      }
    ],
    metadata: {
      description: 'Emergency stop sequence for all systems',
      tags: ['emergency', 'safety', 'stop']
    }
  },
  {
    id: 'tool_operation',
    name: 'Tool Operation Sequence',
    duration: 10,
    speed: 1,
    loop: false,
    tracks: [
      {
        id: 'tool_deploy',
        name: 'Tool Deployment',
        type: 'joint',
        targetId: 'arm_tool',
        property: 'angle',
        enabled: true,
        weight: 1,
        keyframes: [
          { time: 0, value: 0, easing: 'easeInOut' },
          { time: 2, value: Math.PI / 2, easing: 'easeInOut' },
          { time: 4, value: Math.PI, easing: 'linear' },
          { time: 6, value: Math.PI * 1.5, easing: 'linear' },
          { time: 8, value: Math.PI * 2, easing: 'easeInOut' },
          { time: 10, value: 0, easing: 'easeOut' }
        ]
      },
      {
        id: 'tool_vibration',
        name: 'Tool Vibration',
        type: 'custom',
        targetId: 'arm_tool',
        property: 'vibration',
        enabled: true,
        weight: 0.3,
        blendMode: 'additive',
        keyframes: [
          { time: 2, value: 0, easing: 'easeIn' },
          { time: 3, value: 1, easing: 'linear' },
          { time: 7, value: 1, easing: 'linear' },
          { time: 8, value: 0, easing: 'easeOut' }
        ]
      }
    ],
    metadata: {
      description: 'Complete tool operation sequence with vibration',
      tags: ['tool', 'operation', 'drilling']
    }
  }
];

// ========== Procedural Animation Presets ==========

export const PROCEDURAL_PRESETS: ProceduralAnimation[] = {
  antenna_wobble: {
    id: 'antenna_wobble',
    name: 'Antenna Wobble',
    type: 'sine',
    targetId: 'antenna_elevation',
    property: 'angle_offset',
    parameters: {
      frequency: 2,
      amplitude: 0.05
    },
    weight: 0.3,
    enabled: true
  },
  wheel_vibration: {
    id: 'wheel_vibration',
    name: 'Wheel Vibration',
    type: 'noise',
    targetId: 'wheels',
    property: 'vibration',
    parameters: {
      amplitude: 0.02,
      frequency: 10
    },
    weight: 0.2,
    enabled: true
  }
};

export default AnimationSystem;
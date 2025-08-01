# Animation System API Specification

## Core API Reference

### AnimationManager API

```typescript
/**
 * Central animation management system
 */
export interface IAnimationManager {
  /**
   * Play an animation with optional configuration
   * @param animationId - Unique identifier for the animation
   * @param options - Playback options
   * @returns Handle for controlling the animation
   */
  play(animationId: string, options?: PlayOptions): AnimationHandle;
  
  /**
   * Play multiple animations in sequence
   * @param sequence - Array of animation configurations
   * @returns Handle for the sequence
   */
  playSequence(sequence: AnimationSequence[]): SequenceHandle;
  
  /**
   * Play multiple animations in parallel
   * @param animations - Array of animation IDs
   * @param options - Parallel playback options
   * @returns Handle for the parallel group
   */
  playParallel(animations: string[], options?: ParallelOptions): GroupHandle;
  
  /**
   * Stop an animation or all animations
   * @param handle - Optional handle to stop specific animation
   */
  stop(handle?: AnimationHandle): void;
  
  /**
   * Pause an animation or all animations
   * @param handle - Optional handle to pause specific animation
   */
  pause(handle?: AnimationHandle): void;
  
  /**
   * Resume a paused animation or all animations
   * @param handle - Optional handle to resume specific animation
   */
  resume(handle?: AnimationHandle): void;
  
  /**
   * Register a new animation
   * @param animation - Animation definition
   * @returns Animation ID
   */
  register(animation: AnimationDefinition): string;
  
  /**
   * Set a global parameter
   * @param name - Parameter name
   * @param value - Parameter value
   */
  setParameter(name: string, value: any): void;
  
  /**
   * Get current animation state
   * @returns Current state of all animations
   */
  getState(): AnimationManagerState;
}

/**
 * Animation playback options
 */
export interface PlayOptions {
  /** Start time offset in seconds */
  startTime?: number;
  /** Playback speed multiplier */
  speed?: number;
  /** Number of times to loop (0 = infinite) */
  loop?: number;
  /** Blend in duration */
  fadeIn?: number;
  /** Blend out duration */
  fadeOut?: number;
  /** Priority for blending */
  priority?: number;
  /** Layer to play on */
  layer?: string;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Callback for each frame */
  onUpdate?: (progress: number) => void;
}

/**
 * Animation handle for runtime control
 */
export interface AnimationHandle {
  /** Unique identifier */
  id: string;
  /** Current playback state */
  state: 'playing' | 'paused' | 'stopped';
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Progress from 0 to 1 */
  progress: number;
  
  /** Control methods */
  play(): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setSpeed(speed: number): void;
  setLoop(loop: number): void;
  
  /** Event handlers */
  onComplete(callback: () => void): void;
  onLoop(callback: (iteration: number) => void): void;
  onUpdate(callback: (progress: number) => void): void;
}
```

### Timeline API

```typescript
/**
 * Timeline for sequencing animations
 */
export interface ITimeline {
  /**
   * Add an animation to the timeline
   * @param animation - Animation configuration
   * @param startTime - When to start the animation
   */
  add(animation: TimelineAnimation, startTime: number): void;
  
  /**
   * Add a marker at a specific time
   * @param time - Time in seconds
   * @param callback - Function to call when marker is reached
   */
  addMarker(time: number, callback: () => void): void;
  
  /**
   * Add a time range
   * @param range - Time range configuration
   */
  addRange(range: TimeRange): void;
  
  /**
   * Play the timeline
   * @param options - Playback options
   */
  play(options?: TimelinePlayOptions): void;
  
  /**
   * Seek to a specific time
   * @param time - Time in seconds
   */
  seek(time: number): void;
  
  /**
   * Get current state
   */
  getState(): TimelineState;
}

/**
 * Timeline animation configuration
 */
export interface TimelineAnimation {
  /** Animation ID or inline definition */
  animation: string | AnimationDefinition;
  /** Duration override */
  duration?: number;
  /** Time stretch factor */
  timeScale?: number;
  /** Blend mode */
  blendMode?: 'override' | 'additive' | 'multiply';
  /** Easing function */
  easing?: EasingFunction;
}

/**
 * Time range for timeline
 */
export interface TimeRange {
  /** Range name */
  name: string;
  /** Start time */
  start: number;
  /** End time */
  end: number;
  /** Color for UI display */
  color?: string;
}
```

### State Machine API

```typescript
/**
 * Animation state machine
 */
export interface IAnimationStateMachine {
  /**
   * Add a state to the machine
   * @param state - State definition
   */
  addState(state: AnimationState): void;
  
  /**
   * Add a transition between states
   * @param from - Source state ID
   * @param to - Target state ID
   * @param condition - Transition condition
   */
  addTransition(from: string, to: string, condition: TransitionCondition): void;
  
  /**
   * Set the current state
   * @param stateId - State to transition to
   * @param immediate - Skip transition animation
   */
  setState(stateId: string, immediate?: boolean): void;
  
  /**
   * Send an event to the state machine
   * @param event - Event name
   * @param data - Event data
   */
  sendEvent(event: string, data?: any): void;
  
  /**
   * Set a parameter value
   * @param name - Parameter name
   * @param value - Parameter value
   */
  setParameter(name: string, value: any): void;
  
  /**
   * Get current state
   */
  getCurrentState(): AnimationState;
  
  /**
   * Check if a transition is possible
   * @param to - Target state ID
   */
  canTransitionTo(to: string): boolean;
}

/**
 * Animation state definition
 */
export interface AnimationState {
  /** Unique state ID */
  id: string;
  /** Display name */
  name: string;
  /** Animation to play in this state */
  animation?: string | AnimationDefinition;
  /** Blend tree for complex states */
  blendTree?: BlendTreeNode;
  /** Speed multiplier */
  speed?: number;
  /** Mirror animation */
  mirror?: boolean;
  /** State tags */
  tags?: string[];
  
  /** Lifecycle callbacks */
  onEnter?: () => void;
  onUpdate?: (deltaTime: number) => void;
  onExit?: () => void;
}

/**
 * Transition condition
 */
export interface TransitionCondition {
  /** Condition type */
  type: 'parameter' | 'event' | 'time' | 'custom';
  
  /** Parameter conditions */
  parameter?: {
    name: string;
    operator: '==' | '!=' | '<' | '>' | '<=' | '>=';
    value: any;
  };
  
  /** Event condition */
  event?: string;
  
  /** Time condition (seconds in state) */
  time?: number;
  
  /** Custom condition function */
  custom?: (params: Map<string, any>) => boolean;
  
  /** Transition settings */
  duration?: number;
  exitTime?: number;
  hasExitTime?: boolean;
}
```

### Animation Types API

```typescript
/**
 * Skeletal animation interface
 */
export interface ISkeletalAnimation extends IAnimation {
  /** Animation type identifier */
  type: 'skeletal';
  
  /**
   * Set bone transformation
   * @param boneName - Name of the bone
   * @param transform - Transformation to apply
   */
  setBoneTransform(boneName: string, transform: BoneTransform): void;
  
  /**
   * Apply inverse kinematics
   * @param chainId - IK chain identifier
   * @param target - Target position/rotation
   */
  applyIK(chainId: string, target: IKTarget): void;
  
  /**
   * Add bone constraint
   * @param constraint - Constraint definition
   */
  addConstraint(constraint: BoneConstraint): void;
  
  /**
   * Get current bone pose
   * @param boneName - Name of the bone
   */
  getBonePose(boneName: string): BoneTransform;
}

/**
 * Procedural animation interface
 */
export interface IProceduralAnimation extends IAnimation {
  /** Animation type identifier */
  type: 'procedural';
  
  /**
   * Set generator function
   * @param generator - Animation generator
   */
  setGenerator(generator: AnimationGenerator): void;
  
  /**
   * Update generator parameters
   * @param params - Generator parameters
   */
  updateParameters(params: Record<string, any>): void;
  
  /**
   * Set noise function for variation
   * @param noise - Noise configuration
   */
  setNoise(noise: NoiseConfig): void;
}

/**
 * Keyframe animation interface
 */
export interface IKeyframeAnimation extends IAnimation {
  /** Animation type identifier */
  type: 'keyframe';
  
  /**
   * Add a keyframe
   * @param time - Time in seconds
   * @param values - Keyframe values
   */
  addKeyframe(time: number, values: KeyframeValues): void;
  
  /**
   * Remove a keyframe
   * @param time - Time of keyframe to remove
   */
  removeKeyframe(time: number): void;
  
  /**
   * Set interpolation mode
   * @param mode - Interpolation type
   */
  setInterpolation(mode: InterpolationMode): void;
  
  /**
   * Get keyframes
   */
  getKeyframes(): Keyframe[];
}

/**
 * Physics-driven animation interface
 */
export interface IPhysicsAnimation extends IAnimation {
  /** Animation type identifier */
  type: 'physics';
  
  /**
   * Apply force to the animation
   * @param force - Force vector
   * @param point - Application point (optional)
   */
  applyForce(force: Vector3, point?: Vector3): void;
  
  /**
   * Apply impulse
   * @param impulse - Impulse vector
   * @param point - Application point
   */
  applyImpulse(impulse: Vector3, point: Vector3): void;
  
  /**
   * Set physics properties
   * @param properties - Physics configuration
   */
  setPhysicsProperties(properties: PhysicsProperties): void;
  
  /**
   * Enable/disable ragdoll mode
   * @param enabled - Ragdoll state
   */
  setRagdoll(enabled: boolean): void;
}
```

### React Hooks API

```typescript
/**
 * Main animation hook
 */
export function useRoverAnimation(options?: UseAnimationOptions): RoverAnimationControls {
  // Implementation
}

export interface RoverAnimationControls {
  /** Play a predefined animation */
  play: (animation: RoverAnimationType, options?: PlayOptions) => Promise<void>;
  
  /** Stop current animation */
  stop: () => void;
  
  /** Pause current animation */
  pause: () => void;
  
  /** Resume paused animation */
  resume: () => void;
  
  /** Current animation state */
  state: AnimationState;
  
  /** Is any animation playing */
  isPlaying: boolean;
  
  /** Current animation name */
  current: string | null;
  
  /** Animation progress (0-1) */
  progress: number;
  
  /** Component-specific controls */
  arm: ArmControls;
  camera: CameraControls;
  wheels: WheelControls;
  antenna: AntennaControls;
}

/**
 * Arm control interface
 */
export interface ArmControls {
  deploy: () => Promise<void>;
  stow: () => Promise<void>;
  moveTo: (position: Vector3) => Promise<void>;
  setJoint: (joint: ArmJoint, angle: number) => void;
  grab: () => Promise<void>;
  release: () => Promise<void>;
}

/**
 * Camera control interface
 */
export interface CameraControls {
  scan: (range: number) => Promise<void>;
  lookAt: (target: Vector3) => Promise<void>;
  track: (targetId: string) => void;
  stopTracking: () => void;
  capture: () => Promise<void>;
}

/**
 * Animation state hook
 */
export function useAnimationState(animationId: string): AnimationStateInfo {
  // Implementation
}

export interface AnimationStateInfo {
  isPlaying: boolean;
  isPaused: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  loop: number;
  speed: number;
}

/**
 * Animation timeline hook
 */
export function useAnimationTimeline(): TimelineControls {
  // Implementation
}

export interface TimelineControls {
  create: (config: TimelineConfig) => Timeline;
  play: (timeline: Timeline) => void;
  pause: () => void;
  seek: (time: number) => void;
  addMarker: (time: number, callback: () => void) => void;
  currentTime: number;
  duration: number;
}
```

### Event System API

```typescript
/**
 * Animation event types
 */
export enum AnimationEvent {
  START = 'animation:start',
  END = 'animation:end',
  LOOP = 'animation:loop',
  PAUSE = 'animation:pause',
  RESUME = 'animation:resume',
  KEYFRAME = 'animation:keyframe',
  STATE_CHANGE = 'animation:stateChange',
  BLEND_START = 'animation:blendStart',
  BLEND_END = 'animation:blendEnd',
  ERROR = 'animation:error'
}

/**
 * Event listener interface
 */
export interface IAnimationEventEmitter {
  /**
   * Subscribe to an event
   * @param event - Event type
   * @param handler - Event handler
   */
  on(event: AnimationEvent, handler: EventHandler): void;
  
  /**
   * Subscribe to an event once
   * @param event - Event type
   * @param handler - Event handler
   */
  once(event: AnimationEvent, handler: EventHandler): void;
  
  /**
   * Unsubscribe from an event
   * @param event - Event type
   * @param handler - Event handler
   */
  off(event: AnimationEvent, handler: EventHandler): void;
  
  /**
   * Emit an event
   * @param event - Event type
   * @param data - Event data
   */
  emit(event: AnimationEvent, data?: any): void;
}

/**
 * Event handler type
 */
export type EventHandler = (data: AnimationEventData) => void;

/**
 * Animation event data
 */
export interface AnimationEventData {
  /** Event timestamp */
  timestamp: number;
  /** Animation ID */
  animationId: string;
  /** Event-specific data */
  data?: any;
}
```

### Telemetry Integration API

```typescript
/**
 * Telemetry animation driver
 */
export interface ITelemetryAnimationDriver {
  /**
   * Connect to telemetry stream
   * @param config - Connection configuration
   */
  connect(config: TelemetryConfig): void;
  
  /**
   * Map telemetry data to animation parameters
   * @param mapping - Parameter mapping
   */
  mapParameters(mapping: ParameterMapping[]): void;
  
  /**
   * Add animation trigger
   * @param trigger - Trigger configuration
   */
  addTrigger(trigger: AnimationTrigger): void;
  
  /**
   * Set data smoothing
   * @param enabled - Enable smoothing
   * @param factor - Smoothing factor (0-1)
   */
  setSmoothing(enabled: boolean, factor?: number): void;
  
  /**
   * Get current telemetry state
   */
  getTelemetryState(): TelemetryState;
}

/**
 * Parameter mapping configuration
 */
export interface ParameterMapping {
  /** Telemetry data key */
  telemetryKey: string;
  /** Animation parameter name */
  parameterName: string;
  /** Value transformation */
  transform?: (value: any) => any;
  /** Min/max clamping */
  clamp?: { min?: number; max?: number };
  /** Smoothing factor */
  smooth?: number;
}

/**
 * Animation trigger configuration
 */
export interface AnimationTrigger {
  /** Trigger name */
  name: string;
  /** Condition to evaluate */
  condition: TriggerCondition;
  /** Animation to play */
  animation: string;
  /** Trigger options */
  options?: TriggerOptions;
}
```

### Preset Animations

```typescript
/**
 * Predefined rover animations
 */
export enum RoverAnimation {
  // Arm animations
  ARM_DEPLOY = 'arm_deploy',
  ARM_STOW = 'arm_stow',
  ARM_DRILL = 'arm_drill',
  ARM_SAMPLE = 'arm_sample',
  ARM_WAVE = 'arm_wave',
  
  // Camera animations
  CAMERA_SCAN_360 = 'camera_scan_360',
  CAMERA_LOOK_UP = 'camera_look_up',
  CAMERA_LOOK_DOWN = 'camera_look_down',
  CAMERA_TRACK_SUN = 'camera_track_sun',
  CAMERA_SELFIE = 'camera_selfie',
  
  // Movement animations
  MOVE_FORWARD = 'move_forward',
  MOVE_BACKWARD = 'move_backward',
  TURN_LEFT = 'turn_left',
  TURN_RIGHT = 'turn_right',
  CLIMB_ROCK = 'climb_rock',
  
  // System animations
  ANTENNA_DEPLOY = 'antenna_deploy',
  ANTENNA_TRACK = 'antenna_track',
  SOLAR_PANEL_DEPLOY = 'solar_panel_deploy',
  SOLAR_PANEL_TRACK = 'solar_panel_track',
  
  // Emergency animations
  EMERGENCY_STOP = 'emergency_stop',
  SAFE_MODE = 'safe_mode',
  RECOVERY_SEQUENCE = 'recovery_sequence',
  
  // Celebration animations
  MISSION_SUCCESS = 'mission_success',
  DISCOVERY_DANCE = 'discovery_dance',
  COMMUNICATION_ESTABLISHED = 'comm_established'
}

/**
 * Animation preset configuration
 */
export interface AnimationPreset {
  /** Unique ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Category */
  category: 'movement' | 'arm' | 'camera' | 'system' | 'emergency' | 'celebration';
  /** Duration in seconds */
  duration: number;
  /** Can be interrupted */
  interruptible: boolean;
  /** Required rover state */
  requiredState?: string[];
  /** Animation data */
  animation: AnimationDefinition;
}
```

### Usage Examples

```typescript
// Basic animation playback
const animation = useRoverAnimation();

// Play arm deployment
await animation.play(RoverAnimation.ARM_DEPLOY);

// Play with options
await animation.play(RoverAnimation.CAMERA_SCAN_360, {
  speed: 0.5,
  loop: 2,
  onComplete: () => console.log('Scan complete')
});

// Direct joint control
animation.arm.setJoint('elbow', Math.PI / 4);

// Complex sequence
const timeline = animation.timeline.create({
  name: 'Sample Collection Sequence'
});

timeline.add({ animation: RoverAnimation.ARM_DEPLOY }, 0);
timeline.add({ animation: RoverAnimation.MOVE_FORWARD }, 2);
timeline.add({ animation: RoverAnimation.ARM_DRILL }, 5);
timeline.add({ animation: RoverAnimation.ARM_SAMPLE }, 10);
timeline.add({ animation: RoverAnimation.ARM_STOW }, 15);

animation.timeline.play(timeline);

// Telemetry-driven animation
const telemetryDriver = new TelemetryAnimationDriver();

telemetryDriver.mapParameters([
  {
    telemetryKey: 'wheel_speed',
    parameterName: 'wheelRotationSpeed',
    transform: (speed) => speed * 0.1
  },
  {
    telemetryKey: 'suspension_compression',
    parameterName: 'suspensionHeight',
    clamp: { min: 0, max: 1 }
  }
]);

telemetryDriver.addTrigger({
  name: 'High speed celebration',
  condition: {
    type: 'threshold',
    parameter: 'wheel_speed',
    operator: '>',
    value: 5
  },
  animation: RoverAnimation.DISCOVERY_DANCE
});
```
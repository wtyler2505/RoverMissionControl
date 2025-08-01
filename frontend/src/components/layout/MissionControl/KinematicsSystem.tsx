/**
 * KinematicsSystem Component
 * 
 * Implements forward and inverse kinematics for rover articulation.
 * Supports hierarchical joint systems, constraints, and animation blending.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ========== Types ==========

export interface Joint {
  id: string;
  name: string;
  type: 'revolute' | 'prismatic' | 'spherical' | 'fixed';
  parentId?: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  axis: THREE.Vector3;
  minAngle?: number;
  maxAngle?: number;
  minDistance?: number;
  maxDistance?: number;
  currentAngle: number;
  currentDistance: number;
  targetAngle?: number;
  targetDistance?: number;
  speed: number;
  children: string[];
}

export interface KinematicChain {
  id: string;
  name: string;
  joints: string[];
  endEffectorId: string;
  baseId: string;
}

export interface IKTarget {
  id: string;
  chainId: string;
  position: THREE.Vector3;
  rotation?: THREE.Quaternion;
  priority: number;
  weight: number;
}

export interface AnimationClip {
  id: string;
  name: string;
  duration: number;
  loop: boolean;
  keyframes: {
    time: number;
    joints: { [jointId: string]: { angle?: number; distance?: number } };
  }[];
}

export interface KinematicsConfig {
  iterations: number;
  tolerance: number;
  damping: number;
  enableConstraints: boolean;
  enableCollisionAvoidance: boolean;
  blendFactor: number;
}

// ========== Default Configurations ==========

const DEFAULT_CONFIG: KinematicsConfig = {
  iterations: 10,
  tolerance: 0.001,
  damping: 0.5,
  enableConstraints: true,
  enableCollisionAvoidance: false,
  blendFactor: 0.1
};

// Mars rover articulation hierarchy
export const ROVER_JOINTS: Joint[] = [
  // Robotic Arm
  {
    id: 'arm_base',
    name: 'Arm Base',
    type: 'revolute',
    position: new THREE.Vector3(0.8, 0.5, 0),
    rotation: new THREE.Euler(0, 0, 0),
    axis: new THREE.Vector3(0, 1, 0),
    minAngle: -Math.PI,
    maxAngle: Math.PI,
    currentAngle: 0,
    speed: 0.5,
    children: ['arm_shoulder']
  },
  {
    id: 'arm_shoulder',
    name: 'Arm Shoulder',
    type: 'revolute',
    parentId: 'arm_base',
    position: new THREE.Vector3(0, 0.2, 0),
    rotation: new THREE.Euler(0, 0, 0),
    axis: new THREE.Vector3(1, 0, 0),
    minAngle: -Math.PI / 2,
    maxAngle: Math.PI / 2,
    currentAngle: 0,
    speed: 0.3,
    children: ['arm_elbow']
  },
  {
    id: 'arm_elbow',
    name: 'Arm Elbow',
    type: 'revolute',
    parentId: 'arm_shoulder',
    position: new THREE.Vector3(0, 0.5, 0),
    rotation: new THREE.Euler(0, 0, 0),
    axis: new THREE.Vector3(1, 0, 0),
    minAngle: -Math.PI * 0.7,
    maxAngle: 0,
    currentAngle: -Math.PI / 4,
    speed: 0.3,
    children: ['arm_wrist']
  },
  {
    id: 'arm_wrist',
    name: 'Arm Wrist',
    type: 'revolute',
    parentId: 'arm_elbow',
    position: new THREE.Vector3(0, 0.4, 0),
    rotation: new THREE.Euler(0, 0, 0),
    axis: new THREE.Vector3(0, 1, 0),
    minAngle: -Math.PI / 2,
    maxAngle: Math.PI / 2,
    currentAngle: 0,
    speed: 0.5,
    children: ['arm_tool']
  },
  {
    id: 'arm_tool',
    name: 'Arm Tool',
    type: 'revolute',
    parentId: 'arm_wrist',
    position: new THREE.Vector3(0, 0.15, 0),
    rotation: new THREE.Euler(0, 0, 0),
    axis: new THREE.Vector3(0, 0, 1),
    minAngle: -Math.PI,
    maxAngle: Math.PI,
    currentAngle: 0,
    speed: 1.0,
    children: []
  },
  // Mast Camera
  {
    id: 'mast_base',
    name: 'Mast Base',
    type: 'fixed',
    position: new THREE.Vector3(-0.5, 1.0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    axis: new THREE.Vector3(0, 1, 0),
    currentAngle: 0,
    currentDistance: 0,
    speed: 0,
    children: ['mast_pan']
  },
  {
    id: 'mast_pan',
    name: 'Mast Pan',
    type: 'revolute',
    parentId: 'mast_base',
    position: new THREE.Vector3(0, 0.8, 0),
    rotation: new THREE.Euler(0, 0, 0),
    axis: new THREE.Vector3(0, 1, 0),
    minAngle: -Math.PI * 0.9,
    maxAngle: Math.PI * 0.9,
    currentAngle: 0,
    speed: 0.5,
    children: ['mast_tilt']
  },
  {
    id: 'mast_tilt',
    name: 'Mast Tilt',
    type: 'revolute',
    parentId: 'mast_pan',
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    axis: new THREE.Vector3(1, 0, 0),
    minAngle: -Math.PI / 3,
    maxAngle: Math.PI / 3,
    currentAngle: 0,
    speed: 0.3,
    children: []
  },
  // High Gain Antenna
  {
    id: 'antenna_base',
    name: 'Antenna Base',
    type: 'revolute',
    position: new THREE.Vector3(-1.0, 0.7, 0.5),
    rotation: new THREE.Euler(0, 0, 0),
    axis: new THREE.Vector3(0, 1, 0),
    minAngle: -Math.PI / 2,
    maxAngle: Math.PI / 2,
    currentAngle: 0,
    speed: 0.2,
    children: ['antenna_elevation']
  },
  {
    id: 'antenna_elevation',
    name: 'Antenna Elevation',
    type: 'revolute',
    parentId: 'antenna_base',
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    axis: new THREE.Vector3(1, 0, 0),
    minAngle: 0,
    maxAngle: Math.PI / 2,
    currentAngle: Math.PI / 4,
    speed: 0.2,
    children: []
  }
];

// Kinematic chains
export const ROVER_CHAINS: KinematicChain[] = [
  {
    id: 'robotic_arm',
    name: 'Robotic Arm',
    joints: ['arm_base', 'arm_shoulder', 'arm_elbow', 'arm_wrist', 'arm_tool'],
    endEffectorId: 'arm_tool',
    baseId: 'arm_base'
  },
  {
    id: 'mast_camera',
    name: 'Mast Camera',
    joints: ['mast_base', 'mast_pan', 'mast_tilt'],
    endEffectorId: 'mast_tilt',
    baseId: 'mast_base'
  },
  {
    id: 'antenna',
    name: 'High Gain Antenna',
    joints: ['antenna_base', 'antenna_elevation'],
    endEffectorId: 'antenna_elevation',
    baseId: 'antenna_base'
  }
];

// ========== Kinematics Solver ==========

class KinematicsSolver {
  private joints: Map<string, Joint>;
  private chains: Map<string, KinematicChain>;
  private config: KinematicsConfig;

  constructor(joints: Joint[], chains: KinematicChain[], config: KinematicsConfig) {
    this.joints = new Map(joints.map(j => [j.id, { ...j }]));
    this.chains = new Map(chains.map(c => [c.id, c]));
    this.config = config;
  }

  // Forward kinematics: Calculate end effector position from joint angles
  forwardKinematics(chainId: string): THREE.Vector3 {
    const chain = this.chains.get(chainId);
    if (!chain) return new THREE.Vector3();

    let position = new THREE.Vector3();
    let rotation = new THREE.Quaternion();

    for (const jointId of chain.joints) {
      const joint = this.joints.get(jointId);
      if (!joint) continue;

      // Apply joint transformation
      const jointTransform = new THREE.Matrix4();
      jointTransform.makeRotationAxis(joint.axis, joint.currentAngle);
      jointTransform.setPosition(joint.position);

      // Update position
      position.applyMatrix4(jointTransform);
    }

    return position;
  }

  // Inverse kinematics: Calculate joint angles to reach target position
  inverseKinematics(chainId: string, target: IKTarget): boolean {
    const chain = this.chains.get(chainId);
    if (!chain) return false;

    // CCD (Cyclic Coordinate Descent) algorithm
    for (let iteration = 0; iteration < this.config.iterations; iteration++) {
      // Get current end effector position
      const endEffectorPos = this.forwardKinematics(chainId);
      const error = target.position.distanceTo(endEffectorPos);

      if (error < this.config.tolerance) {
        return true; // Target reached
      }

      // Iterate through joints from end to base
      for (let i = chain.joints.length - 2; i >= 0; i--) {
        const joint = this.joints.get(chain.joints[i]);
        if (!joint || joint.type === 'fixed') continue;

        // Calculate rotation needed
        const jointPos = joint.position.clone();
        const toEnd = endEffectorPos.clone().sub(jointPos).normalize();
        const toTarget = target.position.clone().sub(jointPos).normalize();
        
        const angle = toEnd.angleTo(toTarget);
        const axis = toEnd.clone().cross(toTarget).normalize();

        // Apply rotation with damping
        const deltaAngle = angle * this.config.damping;
        joint.targetAngle = joint.currentAngle + deltaAngle;

        // Apply constraints
        if (this.config.enableConstraints) {
          this.applyConstraints(joint);
        }
      }
    }

    return false; // Failed to reach target
  }

  // Apply joint constraints
  private applyConstraints(joint: Joint): void {
    if (joint.type === 'revolute' && joint.targetAngle !== undefined) {
      if (joint.minAngle !== undefined && joint.targetAngle < joint.minAngle) {
        joint.targetAngle = joint.minAngle;
      }
      if (joint.maxAngle !== undefined && joint.targetAngle > joint.maxAngle) {
        joint.targetAngle = joint.maxAngle;
      }
    } else if (joint.type === 'prismatic' && joint.targetDistance !== undefined) {
      if (joint.minDistance !== undefined && joint.targetDistance < joint.minDistance) {
        joint.targetDistance = joint.minDistance;
      }
      if (joint.maxDistance !== undefined && joint.targetDistance > joint.maxDistance) {
        joint.targetDistance = joint.maxDistance;
      }
    }
  }

  // Update joint positions smoothly
  updateJoints(deltaTime: number): void {
    this.joints.forEach(joint => {
      if (joint.type === 'revolute' && joint.targetAngle !== undefined) {
        const diff = joint.targetAngle - joint.currentAngle;
        joint.currentAngle += diff * joint.speed * deltaTime;
      } else if (joint.type === 'prismatic' && joint.targetDistance !== undefined) {
        const diff = joint.targetDistance - joint.currentDistance;
        joint.currentDistance += diff * joint.speed * deltaTime;
      }
    });
  }

  // Get joint state
  getJoint(id: string): Joint | undefined {
    return this.joints.get(id);
  }

  // Set joint target
  setJointTarget(id: string, angle?: number, distance?: number): void {
    const joint = this.joints.get(id);
    if (!joint) return;

    if (angle !== undefined && joint.type === 'revolute') {
      joint.targetAngle = angle;
      this.applyConstraints(joint);
    }
    if (distance !== undefined && joint.type === 'prismatic') {
      joint.targetDistance = distance;
      this.applyConstraints(joint);
    }
  }

  // Get all joints
  getAllJoints(): Joint[] {
    return Array.from(this.joints.values());
  }
}

// ========== React Component ==========

export interface KinematicsSystemProps {
  joints?: Joint[];
  chains?: KinematicChain[];
  config?: Partial<KinematicsConfig>;
  targets?: IKTarget[];
  animations?: AnimationClip[];
  debug?: boolean;
  onJointUpdate?: (joints: Joint[]) => void;
}

export const KinematicsSystem: React.FC<KinematicsSystemProps> = ({
  joints = ROVER_JOINTS,
  chains = ROVER_CHAINS,
  config = {},
  targets = [],
  animations = [],
  debug = false,
  onJointUpdate
}) => {
  const solverRef = useRef<KinematicsSolver>();
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  const [animationTime, setAnimationTime] = useState(0);

  // Initialize solver
  useEffect(() => {
    solverRef.current = new KinematicsSolver(
      joints,
      chains,
      { ...DEFAULT_CONFIG, ...config }
    );
  }, [joints, chains, config]);

  // Animation playback
  const playAnimation = useCallback((clipId: string) => {
    setCurrentAnimation(clipId);
    setAnimationTime(0);
  }, []);

  const stopAnimation = useCallback(() => {
    setCurrentAnimation(null);
    setAnimationTime(0);
  }, []);

  // Update loop
  useFrame((state, delta) => {
    if (!solverRef.current) return;

    // Process IK targets
    targets.forEach(target => {
      solverRef.current!.inverseKinematics(target.chainId, target);
    });

    // Process animations
    if (currentAnimation) {
      const clip = animations.find(a => a.id === currentAnimation);
      if (clip) {
        // Update animation time
        setAnimationTime(prev => {
          const newTime = prev + delta;
          return clip.loop ? newTime % clip.duration : Math.min(newTime, clip.duration);
        });

        // Find current keyframes
        const currentFrame = clip.keyframes.findIndex(kf => kf.time > animationTime);
        if (currentFrame > 0) {
          const prevKeyframe = clip.keyframes[currentFrame - 1];
          const nextKeyframe = clip.keyframes[currentFrame];
          const t = (animationTime - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);

          // Interpolate joint values
          Object.entries(prevKeyframe.joints).forEach(([jointId, prevValues]) => {
            const nextValues = nextKeyframe.joints[jointId];
            if (nextValues) {
              const angle = prevValues.angle !== undefined && nextValues.angle !== undefined
                ? THREE.MathUtils.lerp(prevValues.angle, nextValues.angle, t)
                : undefined;
              const distance = prevValues.distance !== undefined && nextValues.distance !== undefined
                ? THREE.MathUtils.lerp(prevValues.distance, nextValues.distance, t)
                : undefined;
              
              solverRef.current!.setJointTarget(jointId, angle, distance);
            }
          });
        }
      }
    }

    // Update joint positions
    solverRef.current.updateJoints(delta);

    // Callback with updated joints
    if (onJointUpdate) {
      onJointUpdate(solverRef.current.getAllJoints());
    }
  });

  // Debug visualization
  const renderDebug = () => {
    if (!debug || !solverRef.current) return null;

    return (
      <group name="kinematics-debug">
        {solverRef.current.getAllJoints().map(joint => (
          <group key={joint.id} position={joint.position.toArray()}>
            {/* Joint sphere */}
            <mesh>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color={joint.type === 'fixed' ? '#666' : '#0ff'} />
            </mesh>
            
            {/* Axis indicator */}
            {joint.type !== 'fixed' && (
              <arrowHelper
                args={[
                  joint.axis,
                  new THREE.Vector3(),
                  0.2,
                  joint.type === 'revolute' ? 0xff0000 : 0x00ff00
                ]}
              />
            )}
            
            {/* Joint name */}
            <sprite position={[0, 0.1, 0]}>
              <spriteMaterial>
                <canvasTexture attach="map">
                  {(() => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 256;
                    canvas.height = 64;
                    const ctx = canvas.getContext('2d')!;
                    ctx.fillStyle = 'white';
                    ctx.font = '24px Arial';
                    ctx.fillText(joint.name, 10, 40);
                    return canvas;
                  })()}
                </canvasTexture>
              </spriteMaterial>
            </sprite>
          </group>
        ))}
      </group>
    );
  };

  return (
    <>
      {renderDebug()}
      {/* Hidden component for state management */}
      <group visible={false} userData={{ 
        solver: solverRef.current,
        playAnimation,
        stopAnimation,
        currentAnimation,
        animationTime
      }} />
    </>
  );
};

// ========== Utilities ==========

export const createAnimationClip = (
  name: string,
  keyframes: { time: number; joints: { [jointId: string]: { angle?: number; distance?: number } } }[],
  loop = true
): AnimationClip => {
  const duration = keyframes[keyframes.length - 1]?.time || 0;
  return {
    id: `clip_${Date.now()}`,
    name,
    duration,
    loop,
    keyframes
  };
};

// Preset animations
export const ROVER_ANIMATIONS = {
  armDeploy: createAnimationClip('Arm Deploy', [
    { time: 0, joints: {
      arm_shoulder: { angle: -Math.PI / 2 },
      arm_elbow: { angle: -Math.PI * 0.7 },
      arm_wrist: { angle: 0 }
    }},
    { time: 2, joints: {
      arm_shoulder: { angle: 0 },
      arm_elbow: { angle: -Math.PI / 4 },
      arm_wrist: { angle: 0 }
    }},
    { time: 3, joints: {
      arm_base: { angle: Math.PI / 4 }
    }}
  ], false),
  
  armStow: createAnimationClip('Arm Stow', [
    { time: 0, joints: {
      arm_base: { angle: 0 },
      arm_wrist: { angle: 0 }
    }},
    { time: 1, joints: {
      arm_shoulder: { angle: -Math.PI / 2 },
      arm_elbow: { angle: -Math.PI * 0.7 }
    }}
  ], false),
  
  cameraScan: createAnimationClip('Camera Scan', [
    { time: 0, joints: { mast_pan: { angle: -Math.PI / 2 } }},
    { time: 2, joints: { mast_pan: { angle: Math.PI / 2 } }},
    { time: 4, joints: { mast_pan: { angle: 0 } }}
  ], false),
  
  antennaTrack: createAnimationClip('Antenna Track', [
    { time: 0, joints: { 
      antenna_base: { angle: 0 },
      antenna_elevation: { angle: Math.PI / 4 }
    }},
    { time: 2, joints: { 
      antenna_base: { angle: Math.PI / 3 },
      antenna_elevation: { angle: Math.PI / 3 }
    }},
    { time: 4, joints: { 
      antenna_base: { angle: -Math.PI / 3 },
      antenna_elevation: { angle: Math.PI / 6 }
    }},
    { time: 6, joints: { 
      antenna_base: { angle: 0 },
      antenna_elevation: { angle: Math.PI / 4 }
    }}
  ], true)
};

export default KinematicsSystem;
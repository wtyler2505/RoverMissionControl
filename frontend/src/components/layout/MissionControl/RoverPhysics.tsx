/**
 * RoverPhysics Component
 * 
 * Implements the physics system for the Mars rover using Rapier physics engine.
 * This component manages the rover's rigid body, wheel physics, suspension system,
 * and terrain interaction.
 * 
 * Note: This component is designed to work with @react-three/rapier but can be
 * adapted to work with other physics engines if needed.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { PhysicsConfig, defaultPhysicsConfig } from './PhysicsConfig';
import { DetailedRoverModel, DetailedRoverModelRef, RoverAnimationState } from './DetailedRoverModel';
import { AdvancedWheelPhysics, AdvancedWheelPhysicsRef, WheelPhysicsState, WheelControls } from './AdvancedWheelPhysics';
import { WheelPhysicsConfig, defaultWheelPhysicsConfig, TerrainType } from './WheelPhysicsConfig';

// Types for physics components
export interface RoverPhysicsProps {
  /** Physics configuration */
  config?: PhysicsConfig;
  /** Wheel physics configuration */
  wheelConfig?: WheelPhysicsConfig;
  /** Initial position of the rover */
  position?: [number, number, number];
  /** Initial rotation of the rover */
  rotation?: [number, number, number];
  /** Enable debug visualization */
  debug?: boolean;
  /** Enable advanced wheel physics */
  useAdvancedWheelPhysics?: boolean;
  /** Terrain types under each wheel */
  terrainTypes?: TerrainType[];
  /** Callback when physics is updated */
  onPhysicsUpdate?: (state: RoverPhysicsState) => void;
  /** Control inputs */
  controls?: RoverControls;
}

export interface RoverPhysicsState {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  wheelRotations: number[];
  suspensionCompressions: number[];
  groundContacts: boolean[];
  speed: number;
  heading: number;
  /** Advanced wheel physics state (if enabled) */
  wheelPhysics?: WheelPhysicsState;
  /** Current traction level (0-1) */
  traction?: number;
  /** Slip ratios for each wheel */
  slipRatios?: number[];
}

export interface RoverControls {
  forward: number; // -1 to 1
  turn: number; // -1 to 1
  brake: boolean;
  boost: boolean;
}

export interface RoverPhysicsRef {
  getState: () => RoverPhysicsState;
  reset: (position?: [number, number, number], rotation?: [number, number, number]) => void;
  applyImpulse: (impulse: [number, number, number]) => void;
  setControls: (controls: RoverControls) => void;
}

/**
 * Physics implementation without Rapier (fallback)
 * This provides a basic physics simulation that can be used before Rapier is installed
 */
const RoverPhysicsSimple = forwardRef<RoverPhysicsRef, RoverPhysicsProps>(({
  config = defaultPhysicsConfig,
  wheelConfig = defaultWheelPhysicsConfig,
  position = [0, 2, 0],
  rotation = [0, 0, 0],
  debug = false,
  useAdvancedWheelPhysics = false,
  terrainTypes = Array(6).fill('regolith' as TerrainType),
  onPhysicsUpdate,
  controls = { forward: 0, turn: 0, brake: false, boost: false }
}, ref) => {
  // Rover body mesh
  const roverRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<THREE.Mesh[]>([]);
  const roverModelRef = useRef<DetailedRoverModelRef>(null);
  const wheelPhysicsRef = useRef<AdvancedWheelPhysicsRef>(null);
  
  // Physics state
  const state = useRef<RoverPhysicsState>({
    position: new THREE.Vector3(...position),
    rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    velocity: new THREE.Vector3(0, 0, 0),
    angularVelocity: new THREE.Vector3(0, 0, 0),
    wheelRotations: [0, 0, 0, 0, 0, 0],
    suspensionCompressions: [0, 0, 0, 0, 0, 0],
    groundContacts: [true, true, true, true, true, true],
    speed: 0,
    heading: rotation[1]
  });
  
  // Control state
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  
  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getState: () => state.current,
    reset: (newPos?: [number, number, number], newRot?: [number, number, number]) => {
      if (newPos) {
        state.current.position.set(...newPos);
        if (roverRef.current) {
          roverRef.current.position.set(...newPos);
        }
      }
      if (newRot) {
        state.current.rotation.setFromEuler(new THREE.Euler(...newRot));
        if (roverRef.current) {
          roverRef.current.rotation.set(...newRot);
        }
      }
      state.current.velocity.set(0, 0, 0);
      state.current.angularVelocity.set(0, 0, 0);
    },
    applyImpulse: (impulse: [number, number, number]) => {
      state.current.velocity.add(new THREE.Vector3(...impulse).multiplyScalar(1 / config.rover.mass));
    },
    setControls: (newControls: RoverControls) => {
      controlsRef.current = newControls;
    }
  }));
  
  // Physics update with optional advanced wheel physics
  useFrame((_, delta) => {
    if (!roverRef.current) return;
    
    const dt = Math.min(delta, 0.1); // Cap delta time for stability
    const controls = controlsRef.current;
    
    // Apply gravity
    const gravity = new THREE.Vector3(...config.gravity.mars);
    state.current.velocity.add(gravity.multiplyScalar(dt));
    
    if (useAdvancedWheelPhysics && wheelPhysicsRef.current) {
      // Advanced wheel physics mode
      const wheelState = wheelPhysicsRef.current.getState();
      
      // Update wheel controls
      const wheelControls: WheelControls = {
        throttle: controls.forward,
        steering: controls.turn,
        brake: controls.brake ? 1 : 0,
        tractionControl: true,
        torqueMode: controls.boost ? 'adaptive' : 'equal'
      };
      wheelPhysicsRef.current.setControls(wheelControls);
      
      // Calculate forces from wheels
      let totalForce = new THREE.Vector3();
      let totalTorque = new THREE.Vector3();
      
      wheelState.wheels.forEach((wheel, i) => {
        if (wheel.isGrounded) {
          // Calculate wheel force contribution
          const wheelForce = new THREE.Vector3(0, wheelState.normalForces[i], 0);
          
          // Add traction force based on wheel rotation and friction
          const tractionForce = wheel.angularVelocity * wheelConfig.dimensions.radius * 
            wheel.friction * wheelState.normalForces[i] / 1000;
          const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(state.current.rotation);
          
          if (i === 0 || i === 1) {
            // Front wheels with steering
            forwardDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), wheel.steeringAngle);
          }
          
          wheelForce.add(forwardDir.multiplyScalar(tractionForce));
          totalForce.add(wheelForce);
          
          // Calculate torque from wheel position
          const wheelWorldPos = wheel.position.clone().applyQuaternion(state.current.rotation);
          const torqueArm = wheelWorldPos.cross(wheelForce);
          totalTorque.add(torqueArm);
        }
      });
      
      // Apply forces to rover body
      state.current.velocity.add(totalForce.multiplyScalar(dt / config.rover.mass));
      
      // Apply rocker-bogie stabilization
      const { rockerAngles, bogieAngles, differentialAngle } = wheelState;
      
      // Adjust rover orientation based on suspension geometry
      const rollCorrection = -differentialAngle * 0.5; // Differential keeps body level
      const pitchCorrection = (rockerAngles[0] + rockerAngles[1]) / 4; // Average rocker angle
      
      state.current.angularVelocity.x += rollCorrection * dt * 2;
      state.current.angularVelocity.z += pitchCorrection * dt * 2;
      
      // Update physics state with wheel data
      state.current.wheelPhysics = wheelState;
      state.current.traction = wheelState.totalTraction;
      state.current.slipRatios = wheelState.slipRatios;
      state.current.wheelRotations = wheelState.wheels.map(w => w.rotation);
      state.current.suspensionCompressions = wheelState.suspensionTravel;
      state.current.groundContacts = wheelState.groundContacts;
      
    } else {
      // Simple physics mode (original implementation)
      if (Math.abs(controls.forward) > 0.01) {
        const force = controls.forward * config.wheels.maxTorque * (controls.boost ? 1.5 : 1);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(state.current.rotation);
        state.current.velocity.add(forward.multiplyScalar(force * dt / config.rover.mass));
      }
      
      if (Math.abs(controls.turn) > 0.01) {
        const torque = controls.turn * config.wheels.maxSteeringAngle;
        state.current.angularVelocity.y += torque * dt;
      }
      
      // Update wheel rotations (visual only)
      const wheelSpeed = state.current.speed / config.wheels.radius;
      state.current.wheelRotations = state.current.wheelRotations.map(rot => rot + wheelSpeed * dt);
    }
    
    // Apply damping
    state.current.velocity.multiplyScalar(1 - config.rover.linearDamping * dt);
    state.current.angularVelocity.multiplyScalar(1 - config.rover.angularDamping * dt);
    
    // Apply brake (additional damping)
    if (controls.brake) {
      state.current.velocity.multiplyScalar(0.95);
      state.current.angularVelocity.multiplyScalar(0.95);
    }
    
    // Simple ground collision (keep rover above ground based on suspension)
    const minHeight = useAdvancedWheelPhysics && state.current.wheelPhysics ? 
      config.wheels.radius + wheelConfig.suspension.restLength * 
      (1 - Math.max(...state.current.wheelPhysics.suspensionTravel)) :
      config.wheels.radius;
    
    if (state.current.position.y < minHeight) {
      state.current.position.y = minHeight;
      state.current.velocity.y = Math.max(0, state.current.velocity.y);
    }
    
    // Update position and rotation
    state.current.position.add(state.current.velocity.clone().multiplyScalar(dt));
    const rotationDelta = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        state.current.angularVelocity.x * dt,
        state.current.angularVelocity.y * dt,
        state.current.angularVelocity.z * dt
      )
    );
    state.current.rotation.multiply(rotationDelta);
    
    // Update speed and heading
    state.current.speed = state.current.velocity.length();
    state.current.heading = Math.atan2(state.current.velocity.x, state.current.velocity.z);
    
    // Apply state to mesh
    roverRef.current.position.copy(state.current.position);
    roverRef.current.quaternion.copy(state.current.rotation);
    
    // Update rover model animation
    if (roverModelRef.current) {
      const animationState: RoverAnimationState = {
        wheelRotations: state.current.wheelRotations,
        steeringAngles: [
          controls.turn * config.wheels.maxSteeringAngle,
          controls.turn * config.wheels.maxSteeringAngle,
          0, 0, 0, 0
        ],
      };
      roverModelRef.current.updateAnimation(animationState);
    }
    
    // Notify update
    if (onPhysicsUpdate) {
      onPhysicsUpdate(state.current);
    }
  });
  
  // Wheel positions relative to rover center
  const wheelPositionsArray: [number, number, number][] = [
    [-1.2, -0.5, -1.2], // Front left
    [1.2, -0.5, -1.2],  // Front right
    [-1.2, -0.5, 0],    // Middle left
    [1.2, -0.5, 0],     // Middle right
    [-1.2, -0.5, 1.2],  // Rear left
    [1.2, -0.5, 1.2]    // Rear right
  ];
  
  const wheelPositionVectors = useMemo(() => 
    wheelPositionsArray.map(pos => new THREE.Vector3(...pos)),
    []
  );
  
  return (
    <group ref={roverRef} position={position} rotation={rotation}>
      {/* Detailed Rover Model */}
      <DetailedRoverModel
        ref={roverModelRef}
        lod={0}
        debug={debug}
        castShadow
        receiveShadow
      />
      
      {/* Advanced Wheel Physics System */}
      {useAdvancedWheelPhysics && (
        <AdvancedWheelPhysics
          ref={wheelPhysicsRef}
          config={wheelConfig}
          wheelCount={6}
          wheelPositions={wheelPositionVectors}
          terrainTypes={terrainTypes}
          debug={debug}
          onWheelUpdate={(wheelState) => {
            // Wheel physics state is updated in the main physics loop
          }}
          externalForces={Array(6).fill(new THREE.Vector3())}
          roverVelocity={state.current.velocity}
          controls={{
            throttle: controls.forward,
            steering: controls.turn,
            brake: controls.brake ? 1 : 0,
            tractionControl: true,
            torqueMode: controls.boost ? 'adaptive' : 'equal'
          }}
        />
      )}
      
      {/* Debug visualization */}
      {debug && (
        <>
          {/* Velocity vector */}
          <arrowHelper args={[
            state.current.velocity.normalize(),
            new THREE.Vector3(0, 0, 0),
            state.current.velocity.length() * 2,
            0x00ff00
          ]} />
          
          {/* Physics wheel positions (invisible, for physics calculations) */}
          {!useAdvancedWheelPhysics && wheelPositionsArray.map((pos, i) => (
            <mesh key={`physics-wheel-${i}`} position={pos} visible={false}>
              <cylinderGeometry args={[config.wheels.radius, config.wheels.radius, config.wheels.width, 8]} />
            </mesh>
          ))}
          
          {/* Physics state HUD */}
          {useAdvancedWheelPhysics && state.current.wheelPhysics && (
            <Html position={[0, 4, 0]}>
              <div style={{
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '8px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '11px'
              }}>
                <div>Traction: {(state.current.traction! * 100).toFixed(1)}%</div>
                <div>Speed: {state.current.speed.toFixed(2)} m/s</div>
                <div>Slip: {state.current.slipRatios?.map(s => (s * 100).toFixed(0)).join('%, ')}%</div>
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
});

RoverPhysicsSimple.displayName = 'RoverPhysicsSimple';

/**
 * Main RoverPhysics component
 * This will use Rapier when available, otherwise falls back to simple physics
 */
export const RoverPhysics = forwardRef<RoverPhysicsRef, RoverPhysicsProps>((props, ref) => {
  // For now, we'll use the simple physics implementation
  // When @react-three/rapier is installed, we can switch to the full implementation
  return <RoverPhysicsSimple ref={ref} {...props} />;
});

RoverPhysics.displayName = 'RoverPhysics';

export default RoverPhysics;
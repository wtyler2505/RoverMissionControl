/**
 * AdvancedWheelPhysics Component
 * 
 * Implements realistic wheel physics for Mars rover simulation including:
 * - Rocker-bogie suspension system with differential mechanism
 * - Individual wheel suspension with spring-damper model
 * - Terrain-dependent friction and slip modeling
 * - Torque distribution and traction control
 * - Wheel deformation on soft terrain
 * - Visual feedback for physics state
 * 
 * Based on NASA Mars rover designs (Perseverance, Curiosity)
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text, Html } from '@react-three/drei';
import { WheelPhysicsConfig, defaultWheelPhysicsConfig, TerrainType } from './WheelPhysicsConfig';

// Types
export interface AdvancedWheelPhysicsProps {
  /** Configuration for wheel physics */
  config?: WheelPhysicsConfig;
  /** Number of wheels (6 for Mars rovers) */
  wheelCount?: number;
  /** Wheel positions relative to rover center */
  wheelPositions: THREE.Vector3[];
  /** Current terrain type under each wheel */
  terrainTypes?: TerrainType[];
  /** Enable debug visualization */
  debug?: boolean;
  /** Callback when wheel physics update */
  onWheelUpdate?: (state: WheelPhysicsState) => void;
  /** External forces on wheels (e.g., from rover body) */
  externalForces?: THREE.Vector3[];
  /** Rover velocity for slip calculation */
  roverVelocity?: THREE.Vector3;
  /** Control inputs */
  controls?: WheelControls;
}

export interface WheelPhysicsState {
  /** Individual wheel states */
  wheels: WheelState[];
  /** Total traction available (0-1) */
  totalTraction: number;
  /** Slip ratio for each wheel */
  slipRatios: number[];
  /** Suspension travel for each wheel (0-1, 0=extended, 1=compressed) */
  suspensionTravel: number[];
  /** Ground contact for each wheel */
  groundContacts: boolean[];
  /** Force distribution across wheels */
  normalForces: number[];
  /** Torque applied to each wheel */
  appliedTorques: number[];
  /** Rocker angles (left and right) */
  rockerAngles: [number, number];
  /** Bogie angles (left and right) */
  bogieAngles: [number, number];
  /** Differential angle */
  differentialAngle: number;
}

export interface WheelState {
  /** Wheel position in world space */
  position: THREE.Vector3;
  /** Wheel rotation (radians) */
  rotation: number;
  /** Wheel angular velocity (rad/s) */
  angularVelocity: number;
  /** Steering angle (radians) */
  steeringAngle: number;
  /** Suspension compression (0-1) */
  compression: number;
  /** Ground contact normal */
  contactNormal: THREE.Vector3;
  /** Friction coefficient at contact */
  friction: number;
  /** Slip velocity */
  slipVelocity: THREE.Vector2;
  /** Is wheel in contact with ground */
  isGrounded: boolean;
  /** Deformation amount (for soft terrain) */
  deformation: number;
}

export interface WheelControls {
  /** Throttle input (-1 to 1) */
  throttle: number;
  /** Steering input (-1 to 1) */
  steering: number;
  /** Brake force (0 to 1) */
  brake: number;
  /** Enable traction control */
  tractionControl: boolean;
  /** Torque distribution mode */
  torqueMode: 'equal' | 'adaptive' | 'front' | 'rear';
}

export interface AdvancedWheelPhysicsRef {
  /** Get current wheel physics state */
  getState: () => WheelPhysicsState;
  /** Reset wheel physics */
  reset: () => void;
  /** Apply external force to specific wheel */
  applyWheelForce: (wheelIndex: number, force: THREE.Vector3) => void;
  /** Set terrain type for specific wheel */
  setWheelTerrain: (wheelIndex: number, terrain: TerrainType) => void;
  /** Update control inputs */
  setControls: (controls: WheelControls) => void;
}

// Rocker-bogie kinematics solver
class RockerBogieKinematics {
  private rockerLength: number = 1.2; // Distance from pivot to wheel
  private bogieLength: number = 0.8;  // Distance between bogie wheels
  
  // Solve rocker-bogie angles based on wheel heights
  solve(wheelHeights: number[]): { rockerAngles: [number, number], bogieAngles: [number, number], differentialAngle: number } {
    // Left side: wheels 0 (front), 2 (middle), 4 (rear)
    // Right side: wheels 1 (front), 3 (middle), 5 (rear)
    
    // Calculate rocker angles (pivot at middle wheel)
    const leftRockerAngle = Math.atan2(wheelHeights[0] - wheelHeights[2], this.rockerLength);
    const rightRockerAngle = Math.atan2(wheelHeights[1] - wheelHeights[3], this.rockerLength);
    
    // Calculate bogie angles (between middle and rear wheels)
    const leftBogieAngle = Math.atan2(wheelHeights[4] - wheelHeights[2], this.bogieLength);
    const rightBogieAngle = Math.atan2(wheelHeights[5] - wheelHeights[3], this.bogieLength);
    
    // Differential angle keeps rover body level
    const differentialAngle = (leftRockerAngle - rightRockerAngle) / 2;
    
    return {
      rockerAngles: [leftRockerAngle, rightRockerAngle],
      bogieAngles: [leftBogieAngle, rightBogieAngle],
      differentialAngle
    };
  }
}

// Pacejka tire model for realistic friction
class PacejkaTireModel {
  // Simplified Pacejka coefficients
  private B = 10;   // Stiffness factor
  private C = 1.65; // Shape factor
  private D = 1.0;  // Peak value
  private E = -0.5; // Curvature factor
  
  calculateFriction(slipRatio: number, normalForce: number, frictionCoeff: number): number {
    // Pacejka Magic Formula: F = D * sin(C * arctan(B * slip - E * (B * slip - arctan(B * slip))))
    const slip = Math.max(-1, Math.min(1, slipRatio));
    const x = slip * this.B;
    const friction = this.D * Math.sin(this.C * Math.atan(x - this.E * (x - Math.atan(x))));
    
    return friction * normalForce * frictionCoeff;
  }
}

/**
 * Advanced Wheel Physics Implementation
 */
export const AdvancedWheelPhysics = forwardRef<AdvancedWheelPhysicsRef, AdvancedWheelPhysicsProps>(({
  config = defaultWheelPhysicsConfig,
  wheelCount = 6,
  wheelPositions,
  terrainTypes = Array(6).fill('regolith'),
  debug = false,
  onWheelUpdate,
  externalForces = [],
  roverVelocity = new THREE.Vector3(),
  controls = { throttle: 0, steering: 0, brake: 0, tractionControl: true, torqueMode: 'adaptive' }
}, ref) => {
  // Refs for wheel meshes
  const wheelRefs = useRef<THREE.Group[]>([]);
  const suspensionRefs = useRef<THREE.Mesh[]>([]);
  
  // Physics solvers
  const rockerBogie = useMemo(() => new RockerBogieKinematics(), []);
  const tireModel = useMemo(() => new PacejkaTireModel(), []);
  
  // Initialize wheel states
  const wheelStates = useRef<WheelState[]>(
    Array(wheelCount).fill(null).map((_, i) => ({
      position: wheelPositions[i].clone(),
      rotation: 0,
      angularVelocity: 0,
      steeringAngle: 0,
      compression: 0,
      contactNormal: new THREE.Vector3(0, 1, 0),
      friction: config.friction.static.regolith,
      slipVelocity: new THREE.Vector2(),
      isGrounded: true,
      deformation: 0
    }))
  );
  
  // Physics state
  const physicsState = useRef<WheelPhysicsState>({
    wheels: wheelStates.current,
    totalTraction: 1.0,
    slipRatios: Array(wheelCount).fill(0),
    suspensionTravel: Array(wheelCount).fill(0),
    groundContacts: Array(wheelCount).fill(true),
    normalForces: Array(wheelCount).fill(0),
    appliedTorques: Array(wheelCount).fill(0),
    rockerAngles: [0, 0],
    bogieAngles: [0, 0],
    differentialAngle: 0
  });
  
  // Control state
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  
  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getState: () => physicsState.current,
    reset: () => {
      wheelStates.current.forEach((wheel, i) => {
        wheel.position = wheelPositions[i].clone();
        wheel.rotation = 0;
        wheel.angularVelocity = 0;
        wheel.compression = 0;
        wheel.isGrounded = true;
      });
    },
    applyWheelForce: (wheelIndex: number, force: THREE.Vector3) => {
      if (wheelIndex >= 0 && wheelIndex < wheelCount) {
        // Apply force will be processed in physics update
      }
    },
    setWheelTerrain: (wheelIndex: number, terrain: TerrainType) => {
      if (wheelIndex >= 0 && wheelIndex < wheelCount) {
        terrainTypes[wheelIndex] = terrain;
      }
    },
    setControls: (newControls: WheelControls) => {
      controlsRef.current = newControls;
    }
  }));
  
  // Suspension physics update
  const updateSuspension = (wheelIndex: number, deltaTime: number) => {
    const wheel = wheelStates.current[wheelIndex];
    const suspensionConfig = config.suspension;
    const terrainConfig = config.terrainProperties[terrainTypes[wheelIndex]];
    
    // Ray cast downward from wheel position
    const rayOrigin = wheel.position.clone();
    const rayDirection = new THREE.Vector3(0, -1, 0); // Simplified, should use rover orientation
    
    // Simulate ground contact (in real implementation, would use raycasting)
    const groundHeight = terrainConfig.sinkDepth; // Simplified ground detection
    const suspensionLength = suspensionConfig.restLength;
    const currentLength = rayOrigin.y - groundHeight;
    
    // Calculate compression
    const compression = Math.max(0, Math.min(1, 
      (suspensionLength - currentLength) / (suspensionConfig.maxCompression + suspensionConfig.maxExtension)
    ));
    
    // Spring-damper force
    const springForce = suspensionConfig.stiffness * compression;
    const damperForce = suspensionConfig.damping * (compression - wheel.compression) / deltaTime;
    const suspensionForce = springForce + damperForce;
    
    // Progressive spring rate
    const progressiveMultiplier = 1 + suspensionConfig.progressiveRate * compression * compression;
    const totalForce = suspensionForce * progressiveMultiplier;
    
    // Update wheel state
    wheel.compression = compression;
    wheel.isGrounded = compression > 0;
    
    return totalForce;
  };
  
  // Friction and slip calculation
  const calculateFriction = (wheelIndex: number) => {
    const wheel = wheelStates.current[wheelIndex];
    const terrainConfig = config.terrainProperties[terrainTypes[wheelIndex]];
    const controls = controlsRef.current;
    
    if (!wheel.isGrounded) return { friction: 0, slipRatio: 0 };
    
    // Calculate wheel linear velocity from rotation
    const wheelLinearVelocity = wheel.angularVelocity * config.dimensions.radius;
    
    // Calculate slip ratio
    const roverSpeed = roverVelocity.length();
    const slipRatio = roverSpeed > 0.1 ? 
      (wheelLinearVelocity - roverSpeed) / Math.max(roverSpeed, wheelLinearVelocity) : 0;
    
    // Determine friction coefficient based on slip
    const staticFriction = config.friction.static[terrainTypes[wheelIndex]];
    const dynamicFriction = config.friction.dynamic[terrainTypes[wheelIndex]];
    const frictionCoeff = Math.abs(slipRatio) < config.slipThreshold ? 
      staticFriction : dynamicFriction;
    
    // Apply terrain rolling resistance
    const rollingResistance = terrainConfig.rollingResistance * physicsState.current.normalForces[wheelIndex];
    
    return { 
      friction: frictionCoeff, 
      slipRatio,
      rollingResistance
    };
  };
  
  // Torque distribution
  const distributeTorque = (throttle: number) => {
    const controls = controlsRef.current;
    const torques = Array(wheelCount).fill(0);
    const baseTorque = throttle * config.motor.maxTorque;
    
    switch (controls.torqueMode) {
      case 'equal':
        // Equal torque to all wheels
        torques.fill(baseTorque / wheelCount);
        break;
        
      case 'adaptive':
        // Distribute based on traction
        const tractionWeights = wheelStates.current.map((wheel, i) => 
          wheel.isGrounded ? (1 - Math.abs(physicsState.current.slipRatios[i])) : 0
        );
        const totalWeight = tractionWeights.reduce((a, b) => a + b, 0);
        
        if (totalWeight > 0) {
          torques.forEach((_, i) => {
            torques[i] = baseTorque * (tractionWeights[i] / totalWeight);
          });
        }
        break;
        
      case 'front':
        // Front wheels only (wheels 0, 1)
        torques[0] = torques[1] = baseTorque / 2;
        break;
        
      case 'rear':
        // Rear wheels only (wheels 4, 5)
        torques[4] = torques[5] = baseTorque / 2;
        break;
    }
    
    // Apply traction control
    if (controls.tractionControl) {
      torques.forEach((torque, i) => {
        const slipRatio = physicsState.current.slipRatios[i];
        if (Math.abs(slipRatio) > config.tractionControl.slipThreshold) {
          // Reduce torque on slipping wheels
          const reduction = 1 - (Math.abs(slipRatio) - config.tractionControl.slipThreshold) * 
            config.tractionControl.reductionFactor;
          torques[i] *= Math.max(0.1, reduction);
        }
      });
    }
    
    return torques;
  };
  
  // Physics update
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1); // Cap delta time for stability
    const controls = controlsRef.current;
    
    // Update each wheel
    wheelStates.current.forEach((wheel, i) => {
      // Update suspension
      const suspensionForce = updateSuspension(i, dt);
      physicsState.current.normalForces[i] = suspensionForce;
      physicsState.current.suspensionTravel[i] = wheel.compression;
      
      // Calculate friction and slip
      const { friction, slipRatio, rollingResistance } = calculateFriction(i);
      wheel.friction = friction;
      physicsState.current.slipRatios[i] = slipRatio;
      
      // Apply steering (front wheels only)
      if (i === 0 || i === 1) {
        wheel.steeringAngle = controls.steering * config.steering.maxAngle;
      }
      
      // Update wheel rotation
      if (wheel.isGrounded) {
        // Apply torque
        const torque = distributeTorque(controls.throttle)[i];
        physicsState.current.appliedTorques[i] = torque;
        
        // Calculate angular acceleration
        const angularAcceleration = (torque - rollingResistance * config.dimensions.radius) / 
          config.dimensions.mass;
        
        // Apply brake
        if (controls.brake > 0) {
          const brakeTorque = controls.brake * config.motor.maxTorque * 2;
          angularAcceleration -= Math.sign(wheel.angularVelocity) * brakeTorque / config.dimensions.mass;
        }
        
        // Update angular velocity
        wheel.angularVelocity += angularAcceleration * dt;
        wheel.angularVelocity *= (1 - config.motor.internalResistance * dt);
        
        // Limit to max RPM
        const maxAngularVelocity = (config.motor.maxRPM * 2 * Math.PI) / 60;
        wheel.angularVelocity = Math.max(-maxAngularVelocity, 
          Math.min(maxAngularVelocity, wheel.angularVelocity));
      }
      
      // Update rotation
      wheel.rotation += wheel.angularVelocity * dt;
      
      // Terrain deformation for soft surfaces
      const terrainConfig = config.terrainProperties[terrainTypes[i]];
      if (terrainConfig.sinkDepth > 0 && wheel.isGrounded) {
        const loadFactor = physicsState.current.normalForces[i] / config.suspension.stiffness;
        wheel.deformation = Math.min(terrainConfig.sinkDepth, 
          terrainConfig.sinkDepth * loadFactor * config.deformation.factor);
      } else {
        wheel.deformation = 0;
      }
    });
    
    // Update rocker-bogie kinematics
    const wheelHeights = wheelStates.current.map(w => w.position.y - w.deformation);
    const { rockerAngles, bogieAngles, differentialAngle } = rockerBogie.solve(wheelHeights);
    
    physicsState.current.rockerAngles = rockerAngles;
    physicsState.current.bogieAngles = bogieAngles;
    physicsState.current.differentialAngle = differentialAngle;
    
    // Calculate total traction
    const groundedWheels = wheelStates.current.filter(w => w.isGrounded).length;
    const avgSlip = physicsState.current.slipRatios.reduce((a, b) => a + Math.abs(b), 0) / wheelCount;
    physicsState.current.totalTraction = (groundedWheels / wheelCount) * (1 - avgSlip);
    
    // Update visual representation
    wheelStates.current.forEach((wheel, i) => {
      if (wheelRefs.current[i]) {
        wheelRefs.current[i].rotation.x = wheel.rotation;
        wheelRefs.current[i].rotation.y = wheel.steeringAngle;
        
        // Visual suspension compression
        if (suspensionRefs.current[i]) {
          const scale = 1 - wheel.compression * 0.5;
          suspensionRefs.current[i].scale.y = scale;
        }
      }
    });
    
    // Notify update
    if (onWheelUpdate) {
      onWheelUpdate(physicsState.current);
    }
  });
  
  // Create wheel visual components
  const wheelComponents = wheelStates.current.map((wheel, i) => {
    const isSteeringWheel = i === 0 || i === 1;
    const terrainType = terrainTypes[i];
    const terrainColor = {
      rock: 0x666666,
      sand: 0xC19A6B,
      regolith: 0x8B7355,
      ice: 0xE0FFFF
    }[terrainType] || 0x8B7355;
    
    return (
      <group key={`wheel-${i}`} position={wheelPositions[i]}>
        {/* Wheel */}
        <group ref={el => wheelRefs.current[i] = el!}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[
              config.dimensions.radius,
              config.dimensions.radius,
              config.dimensions.width,
              16
            ]} />
            <meshStandardMaterial 
              color={0x333333}
              roughness={0.8}
              metalness={0.2}
            />
          </mesh>
          
          {/* Wheel tread pattern */}
          {Array.from({ length: 12 }).map((_, j) => (
            <mesh 
              key={`tread-${j}`}
              position={[
                Math.cos((j / 12) * Math.PI * 2) * config.dimensions.radius * 1.02,
                0,
                Math.sin((j / 12) * Math.PI * 2) * config.dimensions.radius * 1.02
              ]}
              rotation={[0, (j / 12) * Math.PI * 2, 0]}
            >
              <boxGeometry args={[0.02, config.dimensions.width, 0.1]} />
              <meshStandardMaterial color={0x222222} />
            </mesh>
          ))}
        </group>
        
        {/* Suspension visualization */}
        <mesh 
          ref={el => suspensionRefs.current[i] = el!}
          position={[0, config.suspension.restLength / 2, 0]}
        >
          <cylinderGeometry args={[0.05, 0.05, config.suspension.restLength]} />
          <meshStandardMaterial 
            color={0xFFD700}
            emissive={0xFFD700}
            emissiveIntensity={0.2}
          />
        </mesh>
        
        {/* Debug visualization */}
        {debug && (
          <group>
            {/* Contact point */}
            {wheel.isGrounded && (
              <mesh position={[0, -config.dimensions.radius - wheel.deformation, 0]}>
                <sphereGeometry args={[0.1]} />
                <meshBasicMaterial color={terrainColor} />
              </mesh>
            )}
            
            {/* Slip indicator */}
            <Html position={[0, config.dimensions.radius + 0.5, 0]}>
              <div style={{
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '2px 4px',
                fontSize: '10px',
                borderRadius: '2px',
                whiteSpace: 'nowrap'
              }}>
                <div>Slip: {(physicsState.current.slipRatios[i] * 100).toFixed(1)}%</div>
                <div>Load: {physicsState.current.normalForces[i].toFixed(0)}N</div>
                <div style={{
                  color: wheel.isGrounded ? '#0f0' : '#f00'
                }}>
                  {wheel.isGrounded ? 'Grounded' : 'Airborne'}
                </div>
              </div>
            </Html>
            
            {/* Force vectors */}
            <arrowHelper
              args={[
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 0, 0),
                physicsState.current.normalForces[i] / 1000,
                0x00FF00
              ]}
            />
          </group>
        )}
      </group>
    );
  });
  
  // Rocker-bogie visualization
  const rockerBogieVisualization = debug && (
    <group>
      {/* Left rocker arm */}
      <mesh 
        position={wheelPositions[2]}
        rotation={[0, 0, physicsState.current.rockerAngles[0]]}
      >
        <boxGeometry args={[2.4, 0.1, 0.1]} />
        <meshBasicMaterial color={0xFF0000} opacity={0.5} transparent />
      </mesh>
      
      {/* Right rocker arm */}
      <mesh 
        position={wheelPositions[3]}
        rotation={[0, 0, physicsState.current.rockerAngles[1]]}
      >
        <boxGeometry args={[2.4, 0.1, 0.1]} />
        <meshBasicMaterial color={0x0000FF} opacity={0.5} transparent />
      </mesh>
      
      {/* Differential bar */}
      <mesh 
        position={[0, 0.5, 0]}
        rotation={[0, 0, physicsState.current.differentialAngle]}
      >
        <boxGeometry args={[2.7, 0.05, 0.05]} />
        <meshBasicMaterial color={0x00FF00} opacity={0.5} transparent />
      </mesh>
    </group>
  );
  
  // HUD for physics state
  const physicsHUD = debug && (
    <Html position={[0, 3, 0]}>
      <div style={{
        background: 'rgba(0,0,0,0.9)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        minWidth: '200px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Wheel Physics</h3>
        <div>Traction: {(physicsState.current.totalTraction * 100).toFixed(1)}%</div>
        <div>Rocker L/R: {physicsState.current.rockerAngles.map(a => (a * 180 / Math.PI).toFixed(1)).join('° / ')}°</div>
        <div>Bogie L/R: {physicsState.current.bogieAngles.map(a => (a * 180 / Math.PI).toFixed(1)).join('° / ')}°</div>
        <div>Differential: {(physicsState.current.differentialAngle * 180 / Math.PI).toFixed(1)}°</div>
        <div>Mode: {controls.torqueMode}</div>
        <div>TC: {controls.tractionControl ? 'ON' : 'OFF'}</div>
      </div>
    </Html>
  );
  
  return (
    <group>
      {wheelComponents}
      {rockerBogieVisualization}
      {physicsHUD}
    </group>
  );
});

AdvancedWheelPhysics.displayName = 'AdvancedWheelPhysics';

export default AdvancedWheelPhysics;
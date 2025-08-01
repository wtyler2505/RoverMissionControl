/**
 * Physics Configuration for Rover Simulation
 * 
 * Defines physics constants and parameters for the Mars rover simulation
 * using Rapier physics engine with React Three Fiber integration.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

export interface PhysicsConfig {
  /** Gravity configuration for different environments */
  gravity: {
    earth: [number, number, number];
    mars: [number, number, number];
    moon: [number, number, number];
    custom: [number, number, number];
  };
  
  /** Rover physics properties */
  rover: {
    /** Total mass of the rover in kg */
    mass: number;
    /** Center of mass offset from geometric center */
    centerOfMass: [number, number, number];
    /** Linear damping (air/dust resistance) */
    linearDamping: number;
    /** Angular damping (rotational resistance) */
    angularDamping: number;
    /** Friction coefficient for rover body */
    friction: number;
    /** Restitution (bounciness) of rover body */
    restitution: number;
  };
  
  /** Wheel physics properties */
  wheels: {
    /** Mass of each wheel in kg */
    mass: number;
    /** Wheel radius in meters */
    radius: number;
    /** Wheel width in meters */
    width: number;
    /** Friction coefficient for wheels */
    friction: number;
    /** Restitution (bounciness) of wheels */
    restitution: number;
    /** Rolling friction coefficient */
    rollingFriction: number;
    /** Maximum torque that can be applied to wheels */
    maxTorque: number;
    /** Maximum steering angle in radians */
    maxSteeringAngle: number;
  };
  
  /** Suspension system properties */
  suspension: {
    /** Spring stiffness (N/m) */
    stiffness: number;
    /** Spring damping coefficient */
    damping: number;
    /** Maximum compression distance (m) */
    maxCompression: number;
    /** Maximum extension distance (m) */
    maxExtension: number;
    /** Rest length of suspension (m) */
    restLength: number;
  };
  
  /** Terrain interaction properties */
  terrain: {
    /** Default terrain friction */
    defaultFriction: number;
    /** Terrain types with specific properties */
    types: {
      [key: string]: {
        friction: number;
        rollingResistance: number;
        sinkDepth: number; // How much wheels sink into terrain
      };
    };
  };
  
  /** Simulation parameters */
  simulation: {
    /** Physics timestep in seconds */
    timestep: number;
    /** Maximum number of solver iterations */
    maxVelocityIterations: number;
    /** Maximum number of position iterations */
    maxPositionIterations: number;
    /** Enable continuous collision detection */
    enableCCD: boolean;
    /** Threshold for sleep mode (low motion detection) */
    sleepThreshold: number;
  };
}

/** Default physics configuration for Mars rover */
export const defaultPhysicsConfig: PhysicsConfig = {
  gravity: {
    earth: [0, -9.81, 0],
    mars: [0, -3.72, 0], // Mars gravity is ~38% of Earth
    moon: [0, -1.62, 0],
    custom: [0, -3.72, 0]
  },
  
  rover: {
    mass: 899, // Perseverance rover mass in kg
    centerOfMass: [0, -0.2, 0], // Slightly lower center of mass for stability
    linearDamping: 0.1,
    angularDamping: 0.5,
    friction: 0.7,
    restitution: 0.1
  },
  
  wheels: {
    mass: 10, // Each wheel mass
    radius: 0.525, // Perseverance wheel radius in meters
    width: 0.4,
    friction: 1.2, // High friction for Mars terrain
    restitution: 0.2,
    rollingFriction: 0.05,
    maxTorque: 500, // N⋅m
    maxSteeringAngle: Math.PI / 6 // 30 degrees
  },
  
  suspension: {
    stiffness: 35000, // N/m - tuned for Mars gravity
    damping: 3500,
    maxCompression: 0.3,
    maxExtension: 0.3,
    restLength: 0.8
  },
  
  terrain: {
    defaultFriction: 0.8,
    types: {
      rock: {
        friction: 1.2,
        rollingResistance: 0.02,
        sinkDepth: 0
      },
      sand: {
        friction: 0.6,
        rollingResistance: 0.15,
        sinkDepth: 0.05
      },
      regolith: {
        friction: 0.8,
        rollingResistance: 0.08,
        sinkDepth: 0.02
      },
      ice: {
        friction: 0.3,
        rollingResistance: 0.01,
        sinkDepth: 0
      }
    }
  },
  
  simulation: {
    timestep: 1 / 60, // 60 FPS physics
    maxVelocityIterations: 8,
    maxPositionIterations: 3,
    enableCCD: true,
    sleepThreshold: 0.01
  }
};

/** Preset configurations for different rover models */
export const roverPresets = {
  perseverance: defaultPhysicsConfig,
  
  curiosity: {
    ...defaultPhysicsConfig,
    rover: {
      ...defaultPhysicsConfig.rover,
      mass: 899
    },
    wheels: {
      ...defaultPhysicsConfig.wheels,
      radius: 0.5,
      width: 0.4
    }
  },
  
  opportunity: {
    ...defaultPhysicsConfig,
    rover: {
      ...defaultPhysicsConfig.rover,
      mass: 185
    },
    wheels: {
      ...defaultPhysicsConfig.wheels,
      radius: 0.13,
      width: 0.16,
      maxTorque: 150
    }
  },
  
  sojourner: {
    ...defaultPhysicsConfig,
    rover: {
      ...defaultPhysicsConfig.rover,
      mass: 11.5
    },
    wheels: {
      ...defaultPhysicsConfig.wheels,
      radius: 0.065,
      width: 0.09,
      maxTorque: 20
    }
  }
};

/** Helper function to interpolate between physics configs */
export function interpolatePhysicsConfig(
  configA: PhysicsConfig,
  configB: PhysicsConfig,
  factor: number
): PhysicsConfig {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const lerpArray = (a: number[], b: number[], t: number) => 
    a.map((val, i) => lerp(val, b[i], t));
  
  return {
    gravity: {
      earth: configA.gravity.earth,
      mars: configA.gravity.mars,
      moon: configA.gravity.moon,
      custom: lerpArray(
        configA.gravity.custom as number[],
        configB.gravity.custom as number[],
        factor
      ) as [number, number, number]
    },
    rover: {
      mass: lerp(configA.rover.mass, configB.rover.mass, factor),
      centerOfMass: lerpArray(
        configA.rover.centerOfMass,
        configB.rover.centerOfMass,
        factor
      ) as [number, number, number],
      linearDamping: lerp(configA.rover.linearDamping, configB.rover.linearDamping, factor),
      angularDamping: lerp(configA.rover.angularDamping, configB.rover.angularDamping, factor),
      friction: lerp(configA.rover.friction, configB.rover.friction, factor),
      restitution: lerp(configA.rover.restitution, configB.rover.restitution, factor)
    },
    wheels: {
      mass: lerp(configA.wheels.mass, configB.wheels.mass, factor),
      radius: lerp(configA.wheels.radius, configB.wheels.radius, factor),
      width: lerp(configA.wheels.width, configB.wheels.width, factor),
      friction: lerp(configA.wheels.friction, configB.wheels.friction, factor),
      restitution: lerp(configA.wheels.restitution, configB.wheels.restitution, factor),
      rollingFriction: lerp(configA.wheels.rollingFriction, configB.wheels.rollingFriction, factor),
      maxTorque: lerp(configA.wheels.maxTorque, configB.wheels.maxTorque, factor),
      maxSteeringAngle: lerp(configA.wheels.maxSteeringAngle, configB.wheels.maxSteeringAngle, factor)
    },
    suspension: {
      stiffness: lerp(configA.suspension.stiffness, configB.suspension.stiffness, factor),
      damping: lerp(configA.suspension.damping, configB.suspension.damping, factor),
      maxCompression: lerp(configA.suspension.maxCompression, configB.suspension.maxCompression, factor),
      maxExtension: lerp(configA.suspension.maxExtension, configB.suspension.maxExtension, factor),
      restLength: lerp(configA.suspension.restLength, configB.suspension.restLength, factor)
    },
    terrain: {
      ...configA.terrain // Don't interpolate terrain types
    },
    simulation: {
      ...configA.simulation // Don't interpolate simulation parameters
    }
  };
}
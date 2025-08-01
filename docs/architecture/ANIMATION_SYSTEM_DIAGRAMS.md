# Animation System Diagrams and Data Flow

## Component Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Animation UI Controls]
        RH[React Hooks]
        RC[React Components]
    end
    
    subgraph "Animation Core"
        AM[Animation Manager]
        TL[Timeline System]
        AB[Animation Blender]
        SM[State Machine]
        ES[Event System]
        
        subgraph "Animation Types"
            SA[Skeletal Animation]
            PA[Procedural Animation]
            KA[Keyframe Animation]
            PD[Physics Animation]
        end
    end
    
    subgraph "Integration Layer"
        KB[Kinematics Bridge]
        PB[Physics Bridge]
        TB[Telemetry Bridge]
        RB[Render Bridge]
    end
    
    subgraph "External Systems"
        KS[Kinematics System]
        PS[Physics System]
        TS[Telemetry Stream]
        R3F[React Three Fiber]
    end
    
    subgraph "Optimization Layer"
        AI[Animation Instancing]
        LOD[LOD Manager]
        AC[Animation Cache]
        GPU[GPU Compute]
    end
    
    UI --> RH
    RH --> AM
    RC --> AM
    
    AM --> TL
    AM --> AB
    AM --> SM
    AM --> ES
    
    SA --> AB
    PA --> AB
    KA --> AB
    PD --> AB
    
    AB --> KB
    AB --> PB
    TB --> AM
    AM --> RB
    
    KB --> KS
    PB --> PS
    TS --> TB
    RB --> R3F
    
    AM --> AI
    AM --> LOD
    AI --> GPU
    LOD --> AC
```

## Data Flow Architecture

### 1. Animation Playback Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant AnimationManager
    participant Timeline
    participant Blender
    participant Renderer
    
    User->>UI: Click "Deploy Arm"
    UI->>AnimationManager: playAnimation("arm_deploy")
    AnimationManager->>Timeline: createTimeline(animation)
    Timeline->>AnimationManager: timelineHandle
    
    loop Animation Frame
        AnimationManager->>Timeline: update(deltaTime)
        Timeline->>Blender: evaluate(currentTime)
        Blender->>Blender: interpolateKeyframes()
        Blender->>AnimationManager: animationPose
        AnimationManager->>Renderer: updatePose(pose)
        Renderer->>Renderer: render()
    end
    
    Timeline->>AnimationManager: onComplete()
    AnimationManager->>UI: animationComplete
```

### 2. Telemetry-Driven Animation Flow

```mermaid
sequenceDiagram
    participant Telemetry
    participant TelemetryBridge
    participant EventSystem
    participant StateMachine
    participant AnimationManager
    participant Renderer
    
    Telemetry->>TelemetryBridge: telemetryData
    TelemetryBridge->>TelemetryBridge: processData()
    TelemetryBridge->>EventSystem: emit("wheelSpeed", value)
    
    EventSystem->>StateMachine: handleEvent("wheelSpeed")
    StateMachine->>StateMachine: evaluateTransitions()
    StateMachine->>AnimationManager: setState("moving")
    
    AnimationManager->>AnimationManager: playStateAnimation()
    AnimationManager->>Renderer: updateAnimation()
```

### 3. Physics Integration Flow

```mermaid
flowchart LR
    subgraph "Physics Simulation"
        PS[Physics Step]
        RB[Rigid Bodies]
        CS[Collision System]
    end
    
    subgraph "Animation System"
        PB[Physics Bridge]
        PA[Physics Animation]
        AB[Animation Blender]
    end
    
    subgraph "Output"
        RP[Render Pose]
        VU[Visual Update]
    end
    
    PS --> RB
    RB --> CS
    CS --> PB
    PB --> PA
    PA --> AB
    AB --> RP
    RP --> VU
```

## Animation State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> Moving: startMove
    Idle --> Deploying: deployArm
    Idle --> Scanning: startScan
    
    Moving --> Idle: stop
    Moving --> Turning: turn
    Moving --> Climbing: terrainChange
    
    Turning --> Moving: turnComplete
    Climbing --> Moving: climbComplete
    
    Deploying --> ArmDeployed: deployComplete
    ArmDeployed --> Operating: startOperation
    Operating --> ArmDeployed: operationComplete
    ArmDeployed --> Stowing: stowArm
    Stowing --> Idle: stowComplete
    
    Scanning --> Idle: scanComplete
    
    state Emergency {
        [*] --> EmergencyStop
        EmergencyStop --> SystemCheck
        SystemCheck --> Recovery
        Recovery --> [*]
    }
    
    Moving --> Emergency: emergencyDetected
    Operating --> Emergency: emergencyDetected
    Emergency --> Idle: recovered
```

## Animation Blending Tree

```mermaid
graph TD
    subgraph "Blend Tree Root"
        Root[Root Node]
    end
    
    subgraph "Movement Layer"
        ML[Movement Blend]
        Idle[Idle Animation]
        Walk[Walk Cycle]
        Turn[Turn Animation]
    end
    
    subgraph "Arm Layer"
        AL[Arm Blend]
        ArmIdle[Arm Idle]
        ArmDeploy[Arm Deploy]
        ArmOperate[Arm Operate]
    end
    
    subgraph "Camera Layer"
        CL[Camera Blend]
        CamIdle[Camera Idle]
        CamScan[Camera Scan]
        CamTrack[Camera Track]
    end
    
    subgraph "Physics Layer"
        PL[Physics Override]
        Suspension[Suspension Bounce]
        Collision[Collision Response]
    end
    
    Root --> ML
    Root --> AL
    Root --> CL
    Root --> PL
    
    ML --> Idle
    ML --> Walk
    ML --> Turn
    
    AL --> ArmIdle
    AL --> ArmDeploy
    AL --> ArmOperate
    
    CL --> CamIdle
    CL --> CamScan
    CL --> CamTrack
    
    PL --> Suspension
    PL --> Collision
```

## Performance Optimization Pipeline

```mermaid
flowchart TB
    subgraph "Input"
        Anim[Animation Request]
        Dist[Camera Distance]
        Perf[Performance Metrics]
    end
    
    subgraph "LOD Selection"
        LOD0[LOD 0 - Full Detail]
        LOD1[LOD 1 - Reduced]
        LOD2[LOD 2 - Simple]
        LOD3[LOD 3 - Static]
    end
    
    subgraph "Optimization"
        Inst[Instance Check]
        Cache[Cache Lookup]
        Cull[Frustum Culling]
    end
    
    subgraph "Processing"
        CPU[CPU Animation]
        GPU[GPU Animation]
        Batch[Batch Processing]
    end
    
    subgraph "Output"
        Render[Final Render]
    end
    
    Anim --> Dist
    Dist --> LOD0
    Dist --> LOD1
    Dist --> LOD2
    Dist --> LOD3
    
    LOD0 --> Inst
    LOD1 --> Inst
    LOD2 --> Cache
    LOD3 --> Cache
    
    Inst --> Cull
    Cache --> Cull
    
    Cull --> CPU
    Cull --> GPU
    
    CPU --> Batch
    GPU --> Batch
    
    Batch --> Render
    
    Perf --> LOD0
    Perf --> LOD1
    Perf --> LOD2
    Perf --> LOD3
```

## Memory Layout

```mermaid
graph LR
    subgraph "CPU Memory"
        AM[Animation Metadata]
        KF[Keyframe Data]
        BT[Blend Trees]
        ST[State Machines]
    end
    
    subgraph "GPU Memory"
        VB[Vertex Buffers]
        IB[Instance Buffers]
        TB[Texture Buffers]
        CB[Compute Buffers]
    end
    
    subgraph "Shared Memory"
        PC[Pose Cache]
        TC[Transform Cache]
        AC[Animation Cache]
    end
    
    AM --> PC
    KF --> TC
    BT --> AC
    
    PC --> VB
    TC --> IB
    AC --> CB
```

## Event Flow Diagram

```mermaid
flowchart TD
    subgraph "Event Sources"
        TE[Telemetry Events]
        UE[User Events]
        SE[System Events]
        PE[Physics Events]
    end
    
    subgraph "Event Processing"
        EQ[Event Queue]
        EP[Event Processor]
        EF[Event Filters]
    end
    
    subgraph "Animation Triggers"
        AT[Animation Triggers]
        ST[State Transitions]
        PT[Parameter Updates]
    end
    
    subgraph "Animation Response"
        AP[Animation Play]
        AS[Animation Stop]
        AB[Animation Blend]
    end
    
    TE --> EQ
    UE --> EQ
    SE --> EQ
    PE --> EQ
    
    EQ --> EP
    EP --> EF
    
    EF --> AT
    EF --> ST
    EF --> PT
    
    AT --> AP
    ST --> AB
    PT --> AB
    
    AP --> AS
```

## Integration Points

```mermaid
graph TB
    subgraph "Animation System"
        AS[Animation Service]
        API[Animation API]
        INT[Integration Layer]
    end
    
    subgraph "Kinematics"
        IK[IK Solver]
        FK[FK Solver]
        JC[Joint Controller]
    end
    
    subgraph "Physics"
        RB[Rigid Bodies]
        CC[Collision]
        DY[Dynamics]
    end
    
    subgraph "Rendering"
        TF[Three.js/Fiber]
        SH[Shaders]
        MT[Materials]
    end
    
    subgraph "Backend"
        WS[WebSocket]
        CMD[Commands]
        TLM[Telemetry]
    end
    
    AS --> API
    API --> INT
    
    INT <--> IK
    INT <--> FK
    INT <--> JC
    
    INT <--> RB
    INT <--> CC
    INT <--> DY
    
    INT --> TF
    INT --> SH
    INT --> MT
    
    WS --> AS
    CMD --> AS
    TLM --> AS
```

## Data Structures

### Animation Clip Structure
```typescript
interface AnimationClip {
  id: string;
  name: string;
  duration: number;
  tracks: {
    position: Track<Vector3>;
    rotation: Track<Quaternion>;
    scale: Track<Vector3>;
    morphTargets?: Track<number[]>;
    custom?: Map<string, Track<any>>;
  };
  metadata: {
    fps: number;
    loop: boolean;
    blendMode: 'override' | 'additive' | 'modulate';
    priority: number;
    tags: string[];
  };
}
```

### Animation State Structure
```typescript
interface AnimationState {
  id: string;
  name: string;
  clips: AnimationClip[];
  transitions: Transition[];
  parameters: Parameter[];
  events: StateEvent[];
  layers: {
    base: AnimationLayer;
    additive: AnimationLayer[];
    override: AnimationLayer[];
  };
  blendTree?: BlendTreeNode;
}
```

### Performance Metrics Structure
```typescript
interface AnimationMetrics {
  fps: number;
  frameTime: number;
  activeAnimations: number;
  blendOperations: number;
  cacheHits: number;
  cacheMisses: number;
  gpuTime: number;
  cpuTime: number;
  memoryUsage: {
    cpu: number;
    gpu: number;
    cached: number;
  };
}
```
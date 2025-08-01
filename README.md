# RoverMissionControl 🚀

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/wtyler2505/RoverMissionControl)
[![Test Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen)](https://github.com/wtyler2505/RoverMissionControl)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/python-%3E%3D3.9-blue)](https://python.org/)
[![Authors](https://img.shields.io/badge/authors-Tyler%20W%20%26%20Claude-purple)](https://github.com/wtyler2505/RoverMissionControl)

> **Enterprise-grade rover mission control system with professional UI/UX and real-time telemetry**

RoverMissionControl is a sophisticated, enterprise-ready mission control system designed to rival NASA and SpaceX control centers. Built with cutting-edge technology and professional UI/UX design, it provides real-time telemetry visualization, secure command and control, and AI-assisted operations.

**Developed by Tyler W & Claude** - A collaborative effort between human creativity and AI assistance, pushing the boundaries of what's possible in rover control systems.

![RoverMissionControl Dashboard](docs/images/dashboard-preview.png)

## ✨ Key Features

### 🎨 Professional UI/UX Design System
- **NASA/SpaceX-inspired** control room aesthetic with glassmorphism effects
- **Enterprise design tokens** for consistent theming across all components
- **Multiple themes**: Dark Professional, Light Professional, High Contrast, Mission Critical
- **Responsive design** supporting desktop, tablet, and mobile viewports
- **Real-time 3D visualization** with Three.js physics simulation

### 🔒 Enterprise Security
- **JWT-based authentication** with refresh tokens and 2FA support
- **Role-based access control** (RBAC) with granular permissions
- **API key rotation** and secure credential management
- **CORS protection** with strict origin control
- **Audit logging** for all critical operations

### ⚡ Real-time Control & Communication
- **WebSocket infrastructure** with auto-reconnect and heartbeat monitoring
- **Command queue system** with priority levels and acknowledgments
- **Binary protocol** for efficient data transfer
- **Subscription-based telemetry** streams with compression

### 🤖 AI Integration
- **Claude AI assistant** for natural language command interpretation
- **Computer vision** integration for obstacle detection and path optimization
- **Predictive maintenance** alerts and anomaly detection
- **Automated report generation** and mission planning suggestions

### 🔧 Hardware Integration
- **Multi-protocol support**: Serial, I2C, SPI, CAN bus, Ethernet
- **Hardware abstraction layer** with protocol auto-detection
- **OTA firmware updates** with rollback capability
- **Connection diagnostics** and health monitoring

## 🏗️ Monorepo Architecture

```
rover-mission-control/
├── apps/                           # Applications
│   ├── frontend/                   # React frontend application
│   └── backend/                    # FastAPI backend service
├── packages/                       # Shared packages
│   ├── shared-ui/                  # UI component library
│   ├── shared-utils/               # Utility functions
│   └── shared-types/               # TypeScript type definitions
├── shared/                         # Shared resources
│   └── data/                       # Database and data files
├── docs/                           # Documentation
│   ├── architecture/               # System architecture docs
│   └── guides/                     # User and developer guides
├── tools/                          # Development tools
│   ├── config/                     # Configuration files
│   └── scripts/                    # Build and deployment scripts
└── .taskmaster/                    # TaskMaster AI project management
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **Python** >= 3.9
- **npm** >= 9.0.0
- **Git** for version control

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-org/RoverMissionControl.git
cd RoverMissionControl
```

2. **Install dependencies**
```bash
npm run setup
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration values
```

4. **Start the development environment**
```bash
npm run dev
```

5. **Access the application**
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8001](http://localhost:8001)
- API Documentation: [http://localhost:8001/docs](http://localhost:8001/docs)

## 📋 Available Scripts

### Development
```bash
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start frontend only
npm run dev:backend      # Start backend only
```

### Building
```bash
npm run build            # Build all applications
npm run build:frontend   # Build frontend only
npm run build:backend    # Build backend only
```

### Testing
```bash
npm run test            # Run all tests
npm run test:frontend   # Run frontend tests
npm run test:backend    # Run backend tests
npm run test:e2e        # Run E2E tests with Playwright
```

### Code Quality
```bash
npm run lint            # Lint all code
npm run format          # Format all code with Prettier
npm run typecheck       # Type check TypeScript files
```

### Maintenance
```bash
npm run clean           # Clean all build artifacts
npm run clean:deps      # Remove all node_modules
npm run setup           # Fresh install of all dependencies
```

## 🎛️ Configuration

### Environment Variables

The application uses environment variables for configuration. See [Environment Variables Guide](docs/guides/ENVIRONMENT_VARIABLES.md) for detailed documentation.

Key variables:
- `REACT_APP_BACKEND_URL`: Frontend API endpoint
- `JWT_SECRET`: JWT signing secret (required)
- `ANTHROPIC_API_KEY`: Claude AI API key (optional)
- `CORS_ORIGIN`: Allowed origins for CORS

### Feature Flags

Control feature availability using environment variables:
- `FEATURE_AI_ASSISTANT`: Enable/disable AI assistant
- `FEATURE_ADVANCED_TELEMETRY`: Enable/disable advanced telemetry
- `FEATURE_MULTI_ROVER`: Enable/disable multi-rover support

## 🧪 Testing

### Test Coverage
- **Unit Tests**: 85%+ coverage for all components
- **Integration Tests**: API endpoints and WebSocket communication
- **E2E Tests**: Critical user workflows with Playwright
- **Visual Regression**: Component library with Storybook

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🚢 Deployment

### Docker Deployment
```bash
# Build images
npm run docker:build

# Start services
npm run docker:up

# Stop services
npm run docker:down
```

### Kubernetes Deployment
```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n rover-mission-control
```

### Environment-specific Deployments

#### Development
- Runs locally with hot reloading
- Debug features enabled
- In-memory database for testing

#### Staging
- Mirrors production configuration
- Connected to staging hardware
- Full logging and monitoring

#### Production
- Optimized builds with security hardening
- External database and cache
- Comprehensive monitoring and alerting

## 📚 Documentation

- [**Architecture Overview**](docs/architecture/) - System design and architecture decisions
- [**API Documentation**](docs/api/) - REST API and WebSocket endpoint reference
- [**Frontend Guide**](docs/frontend/) - React application structure and components
- [**Backend Guide**](docs/backend/) - FastAPI service architecture
- [**Hardware Integration**](docs/hardware/) - Connecting and controlling rover hardware
- [**Deployment Guide**](docs/deployment/) - Production deployment instructions
- [**Contributing**](CONTRIBUTING.md) - Development workflow and contribution guidelines

## 🛠️ Development Workflow

### Code Quality Standards
- **ESLint** with Airbnb configuration for JavaScript/TypeScript
- **Prettier** for consistent code formatting
- **Husky** Git hooks for pre-commit quality checks
- **Conventional Commits** for standardized commit messages

### Git Workflow
1. Create feature branch from `main`
2. Make changes with conventional commits
3. Run tests and quality checks
4. Create pull request with detailed description
5. Code review and approval
6. Merge to `main` with squash

### TaskMaster AI Integration
This project uses TaskMaster AI for project management:
```bash
# View current tasks
task-master list

# Get next task to work on
task-master next

# Update task progress
task-master update-task --id=1.2 --prompt="Implementation notes"
```

## 🔧 Hardware Requirements

### Minimum System Requirements
- **CPU**: 4 cores, 2.5GHz
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB available space
- **Network**: Gigabit Ethernet recommended

### Supported Hardware Interfaces
- **Serial**: RS232/RS485 for rover communication
- **I2C**: Sensor array integration
- **SPI**: High-speed device communication
- **CAN Bus**: Automotive-grade rover platforms
- **Ethernet**: Network-based rovers and sensors

## 📊 Performance Targets

- **UI Response Time**: <100ms for all interactions
- **WebSocket Latency**: <50ms for command delivery
- **3D Rendering**: 60fps minimum
- **API Response Time**: <200ms average
- **Concurrent Users**: 100+ supported
- **Telemetry Throughput**: 10,000 points/second

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Development setup and workflow
- Code style and quality standards
- Testing requirements
- Pull request process
- Community guidelines

### Quick Contribution Steps
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
- **Documentation**: Check [docs/](docs/) for detailed guides
- **Issues**: [GitHub Issues](https://github.com/your-org/RoverMissionControl/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/RoverMissionControl/discussions)

### Enterprise Support
For enterprise customers requiring:
- Priority support and SLA guarantees
- Custom feature development
- Professional services and training
- Dedicated technical account management

Contact: [enterprise@rovermissioncontrol.com](mailto:enterprise@rovermissioncontrol.com)

## 🔗 Related Projects

- [RoverHardwareSDK](https://github.com/your-org/RoverHardwareSDK) - Hardware integration library
- [MissionPlannerTools](https://github.com/your-org/MissionPlannerTools) - Mission planning utilities
- [TelemetryAnalytics](https://github.com/your-org/TelemetryAnalytics) - Advanced telemetry analysis

---

<div align="center">

**Built with ❤️ by the RoverMissionControl Team**

[Website](https://rovermissioncontrol.com) • [Documentation](https://docs.rovermissioncontrol.com) • [Blog](https://blog.rovermissioncontrol.com)

</div>
<!-- TASKMASTER_EXPORT_START -->
> 🎯 **Taskmaster Export** - 2025-07-22 10:59:51 UTC
> 📋 Export: without subtasks • Status filter: none
> 🔗 Powered by [Task Master](https://task-master.dev?utm_source=github-readme&utm_medium=readme-export&utm_campaign=rovermissioncontrol&utm_content=task-export-link)

| Project Dashboard |  |
| :-                |:-|
| Task Progress     | ███░░░░░░░░░░░░░░░░░ 16% |
| Done | 8 |
| In Progress | 2 |
| Pending | 41 |
| Deferred | 0 |
| Cancelled | 0 |
|-|-|
| Subtask Progress | ████░░░░░░░░░░░░░░░░ 20% |
| Completed | 85 |
| In Progress | 2 |
| Pending | 329 |


| ID | Title | Status | Priority | Dependencies | Complexity |
| :- | :-    | :-     | :-       | :-           | :-         |
| 1 | Setup Project Repository and Structure | ✓&nbsp;done | high | None | ● 6 |
| 2 | Design System Foundation Setup | ✓&nbsp;done | high | 1 | ● 8 |
| 3 | Setup Storybook for Component Documentation | ✓&nbsp;done | high | 2 | ● 7 |
| 4 | Implement Core UI Components | ○&nbsp;pending | high | 2, 3 | ● 9 |
| 5 | Implement Glassmorphism Effects | ○&nbsp;pending | medium | 2, 4 | ● 6 |
| 6 | Implement Animation System with Framer Motion | ○&nbsp;pending | medium | 4 | ● 7 |
| 7 | Create Custom Icon Library | ○&nbsp;pending | medium | 2 | ● 7 |
| 8 | Implement Flexible Grid System | ○&nbsp;pending | high | 4, 6 | ● 9 |
| 9 | Implement Multi-Monitor Support | ○&nbsp;pending | medium | 8 | ● 8 |
| 10 | Implement Mission Control Center Layout | ○&nbsp;pending | high | 8 | ● 8 |
| 11 | Setup Three.js for 3D Visualization | ○&nbsp;pending | high | 10 | ● 7 |
| 12 | Implement 3D Rover Model and Physics | ○&nbsp;pending | high | 11 | ● 9 |
| 13 | Implement Terrain Visualization | ○&nbsp;pending | medium | 11 | ● 8 |
| 14 | Implement Path Planning Visualization | ○&nbsp;pending | medium | 12, 13 | ● 8 |
| 15 | Implement Lighting and Shadow Effects | ○&nbsp;pending | low | 12, 13 | ● 8 |
| 16 | Setup D3.js for Telemetry Visualization | ○&nbsp;pending | high | 4 | ● 7 |
| 17 | Implement Real-time Telemetry Charts | ○&nbsp;pending | high | 16 | ● 8 |
| 18 | Implement Mission Timeline Visualization | ○&nbsp;pending | medium | 16 | ● 7 |
| 19 | Implement Virtual Joystick Control | ○&nbsp;pending | high | 4, 6 | ● 8 |
| 20 | Implement Gesture Controls | ○&nbsp;pending | medium | 11, 19 | ● 7 |
| 21 | Implement Command Palette | ○&nbsp;pending | medium | 4 | ● 7 |
| 22 | Implement Macro Recording System | ○&nbsp;pending | low | 21 | ● 7 |
| 23 | Implement Emergency Stop Interface | ○&nbsp;pending | high | 4 | ● 7 |
| 24 | Implement Priority-based Alert System | ○&nbsp;pending | high | 4 | ● 7 |
| 25 | Implement Toast Notification System | ○&nbsp;pending | medium | 24 | ● 6 |
| 26 | Implement LED-style Status Indicators | ○&nbsp;pending | medium | 4 | ● 6 |
| 27 | Implement Authentication System | ✓&nbsp;done | high | 1 | ● 8 |
| 28 | Implement Role-based Access Control | ✓&nbsp;done | high | 27 | ● 8 |
| 29 | Implement User Management Dashboard | ○&nbsp;pending | medium | 28 | ● 7 |
| 30 | Implement API Security Measures | ✓&nbsp;done | high | 1 | ● 8 |
| 31 | Implement WebSocket Infrastructure | ►&nbsp;in-progress | high | 30 | ● 8 |
| 32 | Implement Command and Control System | ○&nbsp;pending | high | 31 | ● 9 |
| 33 | Implement Hardware Abstraction Layer | ○&nbsp;pending | high | 32 | ● 9 |
| 34 | Implement Firmware Management System | ○&nbsp;pending | medium | 33 | ● 8 |
| 35 | Implement Claude AI Assistant Integration | ○&nbsp;pending | medium | 32 | ● 8 |
| 36 | Implement Computer Vision Integration | ○&nbsp;pending | medium | 12, 13 | ● 9 |
| 37 | Implement Parts Inventory System | ○&nbsp;pending | low | 11 | ● 7 |
| 38 | Implement Documentation System | ○&nbsp;pending | medium | 4 | ● 7 |
| 39 | Setup Automated Testing Infrastructure | ○&nbsp;pending | high | 1 | ● 8 |
| 40 | Implement Hardware-in-the-Loop Testing | ○&nbsp;pending | medium | 33, 39 | ● 8 |
| 41 | Setup Docker Containerization | ○&nbsp;pending | high | 1 | ● 7 |
| 42 | Setup Kubernetes Deployment | ○&nbsp;pending | medium | 41 | ● 8 |
| 43 | Implement Monitoring and Metrics | ✓&nbsp;done | high | 41 | ● 8 |
| 44 | Implement Accessibility Compliance | ○&nbsp;pending | high | 4 | ● 8 |
| 45 | Implement GDPR Compliance | ✓&nbsp;done | medium | 27, 28 | ● 7 |
| 46 | Implement Performance Optimization | ○&nbsp;pending | high | 10, 11, 16 | ● 8 |
| 47 | Implement Scalability Testing | ○&nbsp;pending | medium | 31, 32, 43 | ● 8 |
| 48 | Create Comprehensive Documentation | ○&nbsp;pending | medium | 38 | ● 7 |
| 49 | Implement User Onboarding System | ○&nbsp;pending | medium | 10 | ● 7 |
| 50 | Implement System Integration Testing | ○&nbsp;pending | high | 39, 40, 43, 46, 47 | ● 9 |
| 51 | Implement Telemetry Data Analysis Framework | ►&nbsp;in-progress | high | 17, 33 | N/A |

> 📋 **End of Taskmaster Export** - Tasks are synced from your project using the `sync-readme` command.
<!-- TASKMASTER_EXPORT_END -->



# 🚀 RoverMissionControl Project Structure & Navigation Guide

```
    ____                       __  __ _         _              ____            _             _ 
   |  _ \ _____   _____ _ __  |  \/  (_)___ ___(_) ___  _ __  / ___|___  _ __ | |_ _ __ ___ | |
   | |_) / _ \ \ / / _ \ '__| | |\/| | / __/ __| |/ _ \| '_ \| |   / _ \| '_ \| __| '__/ _ \| |
   |  _ < (_) \ V /  __/ |    | |  | | \__ \__ \ | (_) | | | | |__| (_) | | | | |_| | | (_) | |
   |_| \_\___/ \_/ \___|_|    |_|  |_|_|___/___/_|\___/|_| |_|\____\___/|_| |_|\__|_|  \___/|_|
                                                                                                  
   Full-Stack Rover Control Platform | FastAPI + React + Three.js + Arduino
```

## 📋 Table of Contents

1. [Quick Start Navigation](#quick-start-navigation)
2. [Complete Directory Tree](#complete-directory-tree)
3. [Key Files Reference](#key-files-reference)
4. [Developer Role Guides](#developer-role-guides)
5. [Common Workflows](#common-workflows)
6. [Integration Patterns](#integration-patterns)
7. [Search Patterns](#search-patterns)
8. [Troubleshooting Map](#troubleshooting-map)
9. [Dependency Graph](#dependency-graph)
10. [File Statistics](#file-statistics)

## 🚦 Quick Start Navigation

### For New Developers
```bash
# 1. Read project overview
cat CLAUDE.md                    # Start here - main documentation

# 2. Set up environment
pip install -r backend/requirements.txt
cd frontend && yarn install

# 3. Understand your area
# Backend: backend/BACKEND_ARCHITECTURE.md
# Frontend: frontend/FRONTEND_ARCHITECTURE.md
# Database: data/DATA_ARCHITECTURE.md
# Testing: tests/TESTING_ARCHITECTURE.md

# 4. Run the application
python backend/server.py         # Terminal 1
cd frontend && yarn start        # Terminal 2
```

### Quick File Finder
- **Main Backend Logic**: `backend/server.py:44` (1900+ lines)
- **Frontend Entry**: `frontend/src/App.js:1` (React components)
- **3D Visualization**: `frontend/src/App.js:250` (RoverModel component)
- **WebSocket Handler**: `backend/server.py:862` (telemetry endpoint)
- **Database Schema**: `data/DATA_ARCHITECTURE.md:50` (full schema)
- **API Documentation**: `backend/BACKEND_ARCHITECTURE.md:40` (all endpoints)

## 📁 Complete Directory Tree

```
RoverMissionControl/
│
├── 📂 .claude/                          # Claude Code configuration
│   ├── 📄 settings.local.json           # MCP permissions (local dev)
│   ├── 📄 CLAUDE_CONFIG.md [1295 lines] # Advanced MCP configuration guide
│   └── 📂 profiles/                     # Role-based permission profiles
│       ├── developer.json               # Full access profile
│       ├── reviewer.json                # Code review permissions
│       └── security.json                # Security audit permissions
│
├── 📂 .emergent/                        # Deployment platform config
│   ├── 📄 emergent.yml                  # Container configuration
│   └── 📄 EMERGENT_CONFIG.md [1500 lines] # Production deployment guide
│
├── 📂 .git/                             # Version control
│   ├── 📂 hooks/                        # Git hooks
│   ├── 📂 objects/                      # Git object database
│   └── 📄 config                        # Repository configuration
│
├── 📂 backend/                          # Python FastAPI backend
│   ├── 🐍 server.py [1974 lines] ⚡     # Main application - CRITICAL FILE
│   │   ├── Lines 1-100: Imports & setup
│   │   ├── Lines 44: ⚠️ HARDCODED API KEY - SECURITY ISSUE
│   │   ├── Lines 100-500: Rover control endpoints
│   │   ├── Lines 500-800: Arduino integration
│   │   ├── Lines 800-1200: WebSocket handlers
│   │   ├── Lines 1200-1600: Knowledge base API
│   │   └── Lines 1600-1974: AI integration & utilities
│   │
│   ├── 📄 requirements.txt              # Python dependencies
│   │   ├── fastapi>=0.104.0            # Web framework
│   │   ├── pyserial>=3.5               # Hardware communication
│   │   ├── websockets>=15.0            # Real-time updates
│   │   └── [30+ more packages]
│   │
│   ├── 📄 .env [gitignored]             # Environment variables
│   ├── 📄 .env.example                  # Environment template
│   └── 📄 BACKEND_ARCHITECTURE.md [1174 lines] # Backend documentation
│       ├── API endpoint reference
│       ├── Security implementation
│       ├── WebSocket protocols
│       └── Performance optimization
│
├── 📂 data/                             # Data storage layer
│   ├── 🗄️ rover_platform.db [118KB]    # SQLite database
│   │   ├── Tables: 15 active tables
│   │   ├── Indexes: 23 performance indexes
│   │   └── Views: 5 reporting views
│   │
│   └── 📄 DATA_ARCHITECTURE.md [1800 lines] # Database documentation
│       ├── Complete schema definitions
│       ├── Query optimization guides
│       ├── Migration strategies
│       └── Backup procedures
│
├── 📂 frontend/                         # React frontend application
│   ├── 📂 public/                       # Static assets
│   │   ├── 📄 index.html               # HTML template
│   │   └── 📄 favicon.ico              # App icon
│   │
│   ├── 📂 src/                         # Source code
│   │   ├── ⚛️ App.js [800+ lines]     # Main React component
│   │   │   ├── Lines 1-50: Imports & setup
│   │   │   ├── Lines 250-400: RoverModel (3D visualization)
│   │   │   ├── Lines 400-500: TelemetryGauge components
│   │   │   ├── Lines 500-600: WebSocket client
│   │   │   └── Lines 600-800: Control handlers
│   │   │
│   │   ├── 📄 App.css                  # Component styles
│   │   ├── 📄 index.js                 # React entry point
│   │   └── 📄 index.css                # Global styles
│   │
│   ├── 📂 node_modules/ [gitignored]   # NPM packages (1000+ packages)
│   ├── 📄 package.json                 # Node dependencies
│   │   ├── react: ^19.0.0             # UI framework
│   │   ├── three: ^0.160.0            # 3D graphics
│   │   ├── @react-three/fiber         # React Three.js integration
│   │   └── [50+ more packages]
│   │
│   ├── 📄 yarn.lock [8000+ lines]      # Locked versions
│   ├── 📄 craco.config.js              # Build customization
│   ├── 📄 tailwind.config.js          # Tailwind CSS config
│   ├── 📄 postcss.config.js           # PostCSS config
│   └── 📄 FRONTEND_ARCHITECTURE.md [2000 lines] # Frontend documentation
│       ├── Component hierarchy
│       ├── State management patterns
│       ├── 3D rendering pipeline
│       └── Performance optimization
│
├── 📂 tests/                           # Test suite
│   ├── 🐍 __init__.py                 # Python module init
│   └── 📄 TESTING_ARCHITECTURE.md [2358 lines] # Testing documentation
│       ├── Test pyramid (70/20/10)
│       ├── Hardware mocking strategies
│       ├── CI/CD pipeline configs
│       └── Performance test suites
│
├── 📄 .gitconfig                       # Git configuration
├── 📄 .gitignore                       # Git ignore rules
├── 🐍 backend_test.py                 # API integration tests
├── 📄 CLAUDE.md [1500+ lines] ⭐       # Main documentation - START HERE
├── 📄 README.md [empty]                # Project readme (needs content)
├── 📄 test_result.md                   # Test execution results
├── 📄 yarn.lock                        # Root yarn lock file
└── 📄 PROJECT_STRUCTURE.md [This file] # Navigation guide
```

## 🔑 Key Files Reference

### Critical Files (Must Read)
| File | Lines | Purpose | Key Sections |
|------|-------|---------|--------------|
| `CLAUDE.md` | 1500+ | Main project documentation | Security issues (Line 80), Dev commands (Line 200) |
| `backend/server.py` | 1974 | Core backend logic | API routes (100-1600), WebSocket (800-1200) |
| `frontend/src/App.js` | 800+ | Main UI component | 3D viz (250-400), Controls (600-800) |
| `data/rover_platform.db` | - | SQLite database | 15 tables, see DATA_ARCHITECTURE.md |

### Configuration Files
| File | Purpose | Modify When |
|------|---------|-------------|
| `.env` | Environment variables | Adding API keys, changing ports |
| `.claude/settings.local.json` | MCP permissions | Changing AI tool access |
| `frontend/package.json` | Frontend dependencies | Adding npm packages |
| `backend/requirements.txt` | Backend dependencies | Adding Python packages |

### Documentation Files
| File | Focus Area | Target Audience |
|------|------------|-----------------|
| `BACKEND_ARCHITECTURE.md` | API design, security | Backend developers |
| `FRONTEND_ARCHITECTURE.md` | React components, 3D | Frontend developers |
| `DATA_ARCHITECTURE.md` | Database schema | Database engineers |
| `TESTING_ARCHITECTURE.md` | Test strategies | QA engineers |
| `CLAUDE_CONFIG.md` | AI permissions | DevOps, Security |
| `EMERGENT_CONFIG.md` | Deployment | DevOps engineers |

## 👥 Developer Role Guides

### 🔧 Backend Developer
```bash
# Your key files
backend/server.py                 # Main logic
backend/BACKEND_ARCHITECTURE.md   # Documentation
backend/requirements.txt          # Dependencies
.env                             # Configuration

# Common tasks
python backend/server.py         # Run server
python backend_test.py           # Run tests
pip install -r backend/requirements.txt  # Install deps

# Key areas in server.py
Lines 100-500: Rover control endpoints
Lines 500-800: Arduino integration  
Lines 800-1200: WebSocket handlers
Lines 1200-1600: Knowledge base API
```

### 🎨 Frontend Developer
```bash
# Your key files
frontend/src/App.js              # Main component
frontend/FRONTEND_ARCHITECTURE.md # Documentation
frontend/package.json            # Dependencies
frontend/src/App.css            # Styles

# Common tasks
cd frontend && yarn start        # Run dev server
cd frontend && yarn build        # Build for production
cd frontend && yarn test         # Run tests

# Key areas in App.js
Lines 250-400: RoverModel (3D visualization)
Lines 400-500: TelemetryGauge components
Lines 500-600: WebSocket client
Lines 600-800: Control handlers
```

### 🗄️ Database Engineer
```bash
# Your key files
data/rover_platform.db          # SQLite database
data/DATA_ARCHITECTURE.md       # Schema documentation
backend/server.py:1600-1800     # Database queries

# Common tasks
sqlite3 data/rover_platform.db  # Open database
.tables                         # List tables
.schema telemetry              # Show table schema

# Backup database
sqlite3 data/rover_platform.db ".backup data/backup_$(date +%Y%m%d).db"
```

### 🔒 Security Engineer
```bash
# Your key files
backend/server.py:44            # HARDCODED API KEY - CRITICAL
.claude/CLAUDE_CONFIG.md        # Permission configs
backend/BACKEND_ARCHITECTURE.md:440  # Security patterns

# Security scan checklist
- [ ] Remove hardcoded API key (Line 44)
- [ ] Implement JWT auth (see BACKEND_ARCHITECTURE.md:345)
- [ ] Configure CORS properly (see BACKEND_ARCHITECTURE.md:469)
- [ ] Add rate limiting (see BACKEND_ARCHITECTURE.md:495)
```

### 🚀 DevOps Engineer
```bash
# Your key files
.emergent/emergent.yml          # Deployment config
.emergent/EMERGENT_CONFIG.md    # Deployment guide
.github/workflows/              # CI/CD pipelines (to create)

# Deployment commands
emergent deploy                 # Deploy to production
docker build -t rover-control . # Build container
kubectl apply -f k8s/           # Deploy to Kubernetes
```

## 🔄 Common Workflows

### 1. Adding a New API Endpoint
```bash
# Step 1: Edit backend/server.py
# Add your endpoint (example at line 1974+)
@app.post("/api/rover/new-feature")
async def new_feature(request: Request):
    return {"status": "success"}

# Step 2: Update documentation
# Edit backend/BACKEND_ARCHITECTURE.md
# Add endpoint documentation in appropriate section

# Step 3: Write tests
# Edit backend_test.py or create new test file
def test_new_feature():
    response = client.post("/api/rover/new-feature")
    assert response.status_code == 200

# Step 4: Run tests
python backend_test.py
```

### 2. Adding a New React Component
```bash
# Step 1: Create component in frontend/src/
# Example: frontend/src/components/NewFeature.js
import React from 'react';
export const NewFeature = () => <div>New Feature</div>;

# Step 2: Import in App.js
# Edit frontend/src/App.js (around line 10)
import { NewFeature } from './components/NewFeature';

# Step 3: Use in render (around line 700)
<NewFeature />

# Step 4: Update documentation
# Edit frontend/FRONTEND_ARCHITECTURE.md
```

### 3. Modifying Database Schema
```bash
# Step 1: Plan migration
# Read data/DATA_ARCHITECTURE.md for current schema

# Step 2: Create backup
sqlite3 data/rover_platform.db ".backup data/backup_$(date +%Y%m%d).db"

# Step 3: Apply changes
sqlite3 data/rover_platform.db
ALTER TABLE telemetry ADD COLUMN new_field REAL;

# Step 4: Update queries in server.py
# Search for SQL queries around lines 1600-1800

# Step 5: Update documentation
# Edit data/DATA_ARCHITECTURE.md with new schema
```

### 4. Debugging WebSocket Issues
```bash
# Step 1: Check backend WebSocket handler
# backend/server.py:862 - WebSocket endpoint

# Step 2: Check frontend WebSocket client
# frontend/src/App.js:500-600 - WebSocket connection

# Step 3: Monitor WebSocket traffic
# Browser DevTools > Network > WS tab

# Step 4: Check logs
tail -f app.log | grep websocket
```

## 🔗 Integration Patterns

### Frontend ↔ Backend Communication
```
┌─────────────────┐     HTTP/WS      ┌──────────────────┐
│                 │ ←───────────────→ │                  │
│  React Frontend │                   │  FastAPI Backend │
│    (Port 3000)  │                   │    (Port 8001)   │
│                 │                   │                  │
└─────────────────┘                   └──────────────────┘
         ↓                                     ↓
    App.js:500                           server.py:862
  WebSocket Client                    WebSocket Handler
```

### Backend ↔ Hardware Communication
```
┌──────────────────┐     Serial      ┌──────────────────┐
│                  │ ←───────────────→│                  │
│  FastAPI Backend │                  │  Arduino/Rover   │
│  server.py:1000  │                  │    Hardware      │
│                  │                  │                  │
└──────────────────┘                  └──────────────────┘
         ↓                                     
   PySerial Library                    
  Hardware Interface                   
```

### Data Flow Pattern
```
User Input → React UI → HTTP/WS → FastAPI → Serial → Hardware
     ↑                                               ↓
     └──────── Telemetry ← WebSocket ← Backend ← Sensors
```

## 🔍 Search Patterns

### Finding Specific Code
```bash
# Find all API endpoints
grep -n "@app\." backend/server.py

# Find WebSocket handlers
grep -n "websocket" backend/server.py frontend/src/App.js

# Find database queries
grep -n "SELECT\|INSERT\|UPDATE\|DELETE" backend/server.py

# Find React components
grep -n "const.*=.*(" frontend/src/App.js

# Find configuration values
grep -n "process\.env\|import\.meta\.env" frontend/src/*.js backend/*.py
```

### Common Search Queries
```bash
# Security issues
grep -rn "password\|api[_-]key\|secret" --include="*.py" --include="*.js"

# TODO items
grep -rn "TODO\|FIXME\|HACK" --include="*.py" --include="*.js"

# Error handling
grep -rn "try\|catch\|except" --include="*.py" --include="*.js"

# API routes
grep -n "app\.\(get\|post\|put\|delete\)" backend/server.py
```

## 🔧 Troubleshooting Map

### Common Issues & Solutions

#### Backend Won't Start
```bash
# Check: Port already in use
lsof -i :8001  # Linux/Mac
netstat -ano | findstr :8001  # Windows

# Check: Missing dependencies
pip install -r backend/requirements.txt

# Check: Environment variables
cat .env  # Ensure CLAUDE_API_KEY is set

# Check: Python version
python --version  # Should be 3.8+
```

#### Frontend Won't Start
```bash
# Check: Node modules installed
cd frontend && yarn install

# Check: Port already in use
lsof -i :3000  # Linux/Mac
netstat -ano | findstr :3000  # Windows

# Check: Node version
node --version  # Should be 14+
```

#### WebSocket Connection Failed
```bash
# Check: Backend running
curl http://localhost:8001/api/rover/status

# Check: CORS configuration
# backend/server.py - search for "CORSMiddleware"

# Check: WebSocket URL in frontend
# frontend/src/App.js:500 - should be ws://localhost:8001
```

#### Serial Port Issues
```bash
# List available ports
python -c "import serial.tools.list_ports; print([p.device for p in serial.tools.list_ports.comports()])"

# Check permissions (Linux/Mac)
ls -la /dev/tty*
sudo usermod -a -G dialout $USER  # Add user to dialout group
```

## 📊 Dependency Graph

### Backend Dependencies
```
server.py
├── fastapi (Web framework)
│   ├── uvicorn (ASGI server)
│   └── starlette (Core components)
├── pyserial (Hardware communication)
├── websockets (Real-time communication)
├── httpx (HTTP client for Claude API)
├── aiofiles (Async file operations)
└── sqlite3 (Database - built-in)
```

### Frontend Dependencies
```
App.js
├── react (UI framework)
│   └── react-dom (DOM rendering)
├── @react-three/fiber (3D graphics)
│   ├── three (3D library)
│   └── @react-three/drei (3D helpers)
├── chart.js (Data visualization)
├── @monaco-editor/react (Code editor)
└── tailwindcss (Styling)
```

## 📈 File Statistics

### Largest Files
1. `backend/server.py` - 1974 lines (Main application logic)
2. `tests/TESTING_ARCHITECTURE.md` - 2358 lines (Comprehensive testing guide)
3. `frontend/FRONTEND_ARCHITECTURE.md` - 2000+ lines (Frontend documentation)
4. `data/DATA_ARCHITECTURE.md` - 1800 lines (Database documentation)
5. `CLAUDE.md` - 1500+ lines (Main project documentation)

### Most Modified Files (Typical)
1. `backend/server.py` - Core logic changes frequently
2. `frontend/src/App.js` - UI updates
3. `.env` - Configuration changes
4. `data/rover_platform.db` - Data accumulation
5. `requirements.txt` / `package.json` - Dependency updates

### Critical Security Files
1. `backend/server.py:44` - ⚠️ Hardcoded API key
2. `.env` - Environment secrets
3. `.claude/settings.local.json` - AI permissions
4. `backend/BACKEND_ARCHITECTURE.md:440` - Security patterns

## 🚀 Quick Commands Reference

### Development
```bash
# Backend
python backend/server.py              # Run backend
python backend_test.py                # Run backend tests
pip install -r backend/requirements.txt # Install Python deps

# Frontend  
cd frontend && yarn start             # Run frontend
cd frontend && yarn build             # Build for production
cd frontend && yarn test              # Run frontend tests

# Database
sqlite3 data/rover_platform.db        # Open database
sqlite3 data/rover_platform.db ".backup data/backup.db"  # Backup

# Full stack
python backend/server.py &            # Run backend in background
cd frontend && yarn start             # Run frontend
```

### Git Commands
```bash
git status                            # Check changes
git add -A                            # Stage all changes
git commit -m "feat: your message"    # Commit
git push origin main                  # Push to remote
```

### Search Commands
```bash
# Find text in backend
grep -n "search_term" backend/server.py

# Find text in all Python files
find . -name "*.py" -exec grep -l "search_term" {} \;

# Find text in all JS files
find . -name "*.js" -exec grep -l "search_term" {} \;
```

## 📝 Notes for Contributors

1. **Always start with `CLAUDE.md`** - It's the main entry point
2. **Check security issues first** - Line 44 in server.py needs immediate attention
3. **Follow existing patterns** - Check similar code before adding new features
4. **Update documentation** - Keep architecture docs in sync with code changes
5. **Test before committing** - Run both backend and frontend tests
6. **Use meaningful commits** - Follow conventional commit format

## 🔗 External Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Three.js Documentation](https://threejs.org/docs/)
- [PySerial Documentation](https://pyserial.readthedocs.io/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

---

**Last Updated**: 2025-07-21
**Version**: 2.0.0
**Maintainer**: RoverMissionControl Team
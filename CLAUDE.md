# CLAUDE.md - Critical Instructions for Claude

## 🚀 Quick Start - Common Tasks

### Starting Work on a Task
```bash
# 1. Check what to work on
mcp__taskmaster-ai__next_task

# 2. Create worktree for the task
scripts\create-task-worktree.bat

# 3. Start work (Taskmaster auto-updates)
mcp__taskmaster-ai__set_task_status --id=<ID> --status=in-progress
```

### Continuing Previous Work
```bash
# In the worktree directory
claude --resume
# or check task status
mcp__taskmaster-ai__get_task --id=<YOUR_TASK_ID>
```

### Quick Commands Reference
- **Next task**: `next_task` 
- **Update status**: `set_status <id> <status>`
- **Update progress**: `update_task <id> "<what you did>"`
- **Check worktrees**: `scripts\worktree-status.bat`

---

## 🔧 Problem-Solving Protocol - Fix Issues Before Continuing

### Handling Issues Effectively with Cognitive Tools

**Core Principle: Address problems systematically using clear-thought tools**

When you encounter ANY issue, IMMEDIATELY invoke:
```bash
mcp__clear-thought__debuggingapproach --approachName='[best_approach]' --issue='[describe_issue]'
```

**Enhanced Problem-Solving Steps:**

1. **PAUSE & ANALYZE** 
   - Stop current work immediately
   - Invoke: `mcp__clear-thought__debuggingapproach --approachName='cause_elimination' --issue='[issue]'`
   
2. **DIAGNOSE SYSTEMATICALLY**
   - Use the debugging approach suggested by the tool
   - For complex issues: `mcp__clear-thought__sequentialthinking --thought='Breaking down the problem' --thoughtNumber=1 --totalThoughts=5`
   
3. **RESOLVE WITH CONFIDENCE**
   - Implement the fix following the systematic approach
   - Track confidence: `mcp__clear-thought__metacognitivemonitoring --task='Fixing [issue]' --stage='execution'`
   
4. **VERIFY THOROUGHLY**
   - Test the solution completely
   - Use: `mcp__clear-thought__scientificmethod --stage='experiment' --question='Does fix resolve issue?'`
   
5. **DOCUMENT INSIGHTS**
   - Record what was learned
   - Update relevant documentation
   
6. **RESUME WITH CONTEXT**
   - Return to original task with clear understanding

### 🧠 Automatic Debugging Approaches

Based on issue type, use these approaches:

| Issue Type | Debugging Approach | When to Use |
|------------|-------------------|-------------|
| **Import/Module Errors** | `cause_elimination` | Missing dependencies, path issues |
| **Intermittent Failures** | `binary_search` | Isolate when/where it occurs |
| **Performance Issues** | `program_slicing` | Identify bottlenecks |
| **Logic Errors** | `backtracking` | Trace execution path |
| **Integration Issues** | `divide_conquer` | Test components separately |
| **Unknown Errors** | `reverse_engineering` | Work from error backwards |

This ensures systematic, reliable problem resolution that builds knowledge.

---

## 🧠 Cognitive Enhancement Protocol

See `docs/COGNITIVE_TOOLS.md` for detailed clear-thought tool usage, triggers, and examples.

**Quick Reference:**
- **Debugging**: `mcp__clear-thought__debuggingapproach`
- **Planning**: `mcp__clear-thought__sequentialthinking`
- **Decisions**: `mcp__clear-thought__decisionframework`
- **Confidence**: `mcp__clear-thought__metacognitivemonitoring`


### 📋 COMMON ISSUES THAT MUST BE FIXED IMMEDIATELY:

#### 🐍 Python Version Mismatch
- **Symptom**: `RuntimeError: failed to find interpreter for Builtin discover of python_spec='python3.11'`
- **Action**: 
  1. Check installed Python: `python --version`
  2. Update `.pre-commit-config.yaml` to match your version
  3. Or install required version
- **Verification**: Run `pre-commit run --all-files`

#### 🔑 GitHub API Permission Denied
- **Symptom**: `Permission Denied: Resource not accessible by personal access token`
- **Action**:
  1. Check token permissions in GitHub settings
  2. Ensure token has required scopes (repo, workflow)
  3. Update MCP configuration if needed
- **Verification**: `mcp__github__search_repositories --query="user:yourusername"`

#### 🌳 Worktree Already Checked Out
- **Symptom**: `fatal: branch already checked out`
- **Action**:
  1. Find existing worktree: `git worktree list | grep <branch>`
  2. Remove if needed: `git worktree remove <path>`
  3. Or use different branch name
- **Verification**: `git worktree list`

#### 📦 Module Not Found in Worktree
- **Symptom**: Import errors after creating worktree
- **Action**: Run setup immediately:
  ```bash
  scripts\worktree-setup-secure.bat "." <task-id>
  ```
- **Verification**: Test imports in both frontend and backend

### ❌ WHAT NOT TO DO - FORBIDDEN BEHAVIORS:

1. **NEVER** continue with other work when an issue is present
2. **NEVER** say "let's address that later" or "moving on for now"
3. **NEVER** work around an issue without fixing the root cause
4. **NEVER** assume the user will fix it themselves
5. **NEVER** ignore error messages or warnings

### ✅ WHAT TO DO - REQUIRED BEHAVIORS:

1. **ALWAYS** acknowledge the issue immediately: "I need to fix this issue first"
2. **ALWAYS** explain what you're doing to fix it
3. **ALWAYS** complete the fix before continuing
4. **ALWAYS** verify the fix works
5. **ALWAYS** update any documentation if the fix reveals process gaps

### 🎯 SUCCESS METRICS:

- **Zero tolerance** for leaving issues unresolved
- **Immediate response** to any technical problems
- **Complete solutions** not partial workarounds
- **Prevention focus** to avoid similar issues in the future

**Remember: User trust depends on reliable, immediate problem-solving. A half-working system is worse than no system at all.**

---

## 🌳 Git Worktrees - CRITICAL PARALLEL DEVELOPMENT

See `docs/WORKTREE_GUIDE.md` for complete worktree documentation.

**Quick Setup:**
```bash
# Automated (best for new features)
scripts\create-task-worktree.bat

# Manual with secure setup
git worktree add ../rover-<name> -b feature/<name>
scripts\worktree-setup-secure.bat "C:\Users\wtyle\rover-<name>" <task-id>
```

### 📍 Current Active Worktrees
| Worktree | Location | Branch | Purpose | Taskmaster Task |
|----------|----------|--------|---------|-----------------|
| **Main** | `C:/Users/wtyle/RoverMissionControl` | `main` | Primary development | Various |
| **Auth** | `C:/Users/wtyle/rover-auth` | `feature/authentication` | Authentication system | Task 27 |
| **Telemetry** | `C:/Users/wtyle/rover-telemetry` | `feature/telemetry-improvements` | Real-time data viz | Task 23 |
| **Hotfix** | `C:/Users/wtyle/rover-hotfix` | `hotfix/urgent-fixes` | Critical bug fixes | As needed |

### 🎯 CRITICAL WORKFLOW: Using Worktrees with Claude

#### 1. Starting a New Feature in a Worktree - With Intelligent Planning

**FIRST: Use decision framework to plan approach:**
```bash
# Analyze if worktree is needed
mcp__clear-thought__decisionframework \
  --decisionStatement='Create worktree vs work in main for Task [ID]' \
  --options='[{"name": "New Worktree", "description": "Isolated environment"}, {"name": "Main Branch", "description": "Quick changes"}]'

# If complex feature, break down the work
mcp__clear-thought__sequentialthinking \
  --thought='Planning worktree setup for [feature]' \
  --totalThoughts=4
```

**THEN: Create worktree with clarity:**
```bash
# PREFERRED METHOD: Use automated task-based creation
scripts\create-task-worktree.bat
# This will:
# - Ask for task ID
# - Create worktree with proper naming
# - Run secure setup automatically
# - Update Taskmaster

# MANUAL METHOD: If you need specific control
# STEP 1: Create worktree for your task
git worktree add ../rover-gamepad -b feature/gamepad-control

# STEP 2: Setup environment (MANDATORY!)
scripts\worktree-setup-secure.bat "C:\Users\wtyle\rover-gamepad" 15

# STEP 3: Navigate and start Claude
cd ../rover-gamepad
claude
```

#### 2. Switching Between Active Worktrees
```bash
# List all worktrees with their status
git worktree list

# Switch to authentication work
cd ../rover-auth
claude --resume  # Resume previous session if available

# Check what changed in other worktrees
cd ../rover-telemetry
git status
```

#### 3. Environment Setup (CRITICAL!)
Each worktree needs its own:
- `node_modules/` (Frontend dependencies)
- `venv/` (Python virtual environment)
- `.env` files (Environment variables)

**ALWAYS use the secure setup script:**
```bash
# Windows - Secure setup with task integration
scripts\worktree-setup-secure.bat "C:\Users\wtyle\rover-<name>" <task-id>

# Unix/Mac
./scripts/worktree-setup-secure.sh /path/to/rover-<name> <task-id>
```

### 🛠️ Worktree Setup - USE ONLY THESE COMMANDS

```bash
# AUTOMATED: Best for new features (integrates with Taskmaster)
scripts\create-task-worktree.bat

# MANUAL: For specific setup needs
scripts\worktree-setup-secure.bat "C:\Users\wtyle\rover-<name>" <task-id>

# STATUS: Check all worktrees
scripts\worktree-status.bat

# CLEANUP: Remove old worktrees
scripts\cleanup-worktrees.bat

# ⚠️ NEVER USE: worktree-setup.bat (deprecated, has security issues)
```

### Quick Worktree Creation:
1. **For new task**: `scripts\create-task-worktree.bat` (interactive, integrates with Taskmaster)
2. **For existing branch**: `git worktree add ../rover-<name> <branch-name>` then run secure setup

### 📋 Task-Specific Worktree Examples

#### Example 1: Working on Authentication (Task 27)
```bash
# You're in main worktree, need to work on auth
cd ../rover-auth
claude

# In Claude:
# "Check Task 27 status and work on remaining subtasks"
# Claude will use Taskmaster to sync progress
```

#### Example 2: Emergency Hotfix While Working on Feature
```bash
# Terminal 1: Working on telemetry
cd ../rover-telemetry
# Keep Claude session running

# Terminal 2: Critical bug reported!
cd ../rover-hotfix
git pull origin main  # Get latest
claude
# "Fix WebSocket memory leak in backend/websocket/manager.py"

# After fix, push hotfix
git add -A
git commit -m "fix: memory leak in WebSocket manager"
git push origin hotfix/urgent-fixes
```

#### Example 3: Parallel Frontend/Backend Development
```bash
# Terminal 1: Backend API work
cd ../rover-backend-api
claude
# "Implement new telemetry endpoints in Task 23.2"

# Terminal 2: Frontend UI work
cd ../rover-frontend-ui  
claude
# "Build telemetry dashboard components for Task 23.4"
```

### ⚠️ CRITICAL WARNINGS AND BEST PRACTICES

#### 1. **NEVER SKIP ENVIRONMENT SETUP**
```bash
# ❌ WRONG - Will cause import errors
git worktree add ../rover-feature -b feature/new
cd ../rover-feature
claude  # WILL FAIL - No dependencies!

# ✅ CORRECT - Use automated creation
scripts\create-task-worktree.bat

# ✅ CORRECT - Manual with secure setup
git worktree add ../rover-feature -b feature/new
scripts\worktree-setup-secure.bat "C:\Users\wtyle\rover-feature" <task-id>
cd ../rover-feature
claude
```

#### 2. **DATABASE SYNCHRONIZATION**
- Database file is SHARED across all worktrees
- Location: `C:/Users/wtyle/RoverMissionControl/shared/data/rover_platform.db`
- Migrations in one worktree affect ALL worktrees

#### 3. **BRANCH PROTECTION**
```bash
# Cannot checkout same branch in multiple worktrees
git worktree add ../rover-test main  # ERROR: branch 'main' already checked out

# Must use different branches
git worktree add ../rover-test -b feature/testing
```

#### 4. **TASKMASTER SYNCHRONIZATION**
Each Claude session in a worktree MUST:
1. Know which task it's working on
2. Update Taskmaster independently
3. Not interfere with other worktree progress

### 🔧 Troubleshooting Common Issues

#### "fatal: branch already checked out"
```bash
# Find where branch is checked out
git worktree list | grep <branch-name>

# Remove old worktree if needed
git worktree remove <path>
```

#### "Module not found" errors
```bash
# Worktree missing dependencies
cd <worktree-path>
scripts\worktree-setup-secure.bat "." <task-id>
```

#### Worktree directory still exists after removal
```bash
# Force cleanup
git worktree remove --force <path>
# or manually
rm -rf <worktree-path>
git worktree prune
```

#### Environment variables not working
```bash
# Ensure .env files were copied
cp ../RoverMissionControl/.env .
cp ../RoverMissionControl/frontend/.env frontend/
cp ../RoverMissionControl/backend/.env backend/
```

### ⚠️ CRITICAL: Security and Limitations

**MANDATORY READING**: See `docs/WORKTREE_LIMITATIONS.md` for:
- Security vulnerabilities and mitigations
- Known bugs and workarounds  
- Platform compatibility issues
- Planned improvements

**ALWAYS USE SECURE SETUP**:
```bash
# ✅ AUTOMATED - Best for new features (recommended)
scripts\create-task-worktree.bat

# ✅ MANUAL - For specific setup needs  
scripts\worktree-setup-secure.bat "C:\Users\wtyle\rover-<name>" <task-id>

# ⚠️ NEVER USE: worktree-setup.bat (deprecated, has security issues)
```

**Active Worktrees:** Main, Auth, Telemetry, Hotfix (see `docs/WORKTREE_GUIDE.md` for details)

## 🚨 MANDATORY TASKMASTER SYNCHRONIZATION 🚨

### RULE #1: TASKMASTER IS THE SINGLE SOURCE OF TRUTH
**EVERY SINGLE ACTION** you take on a task MUST be reflected in Taskmaster IMMEDIATELY.

### 🧠 Intelligent Task Confidence Tracking

**Monitor your confidence and knowledge boundaries:**
```bash
# When starting any task, assess your knowledge
mcp__clear-thought__metacognitivemonitoring \
  --task='[Current Task Description]' \
  --stage='knowledge-assessment' \
  --monitoringId='task-[ID]'

# If confidence < 70%, seek clarification or research
# If confidence > 90%, proceed with implementation
```

### CRITICAL WORKFLOW - FOLLOW THIS OR FAIL:

1. **BEFORE STARTING ANY WORK:**
   ```bash
   # ALWAYS check current task status first
   mcp__taskmaster-ai__get_task --id=<TASK_ID>
   mcp__taskmaster-ai__next_task  # Get what to work on
   ```

2. **WHEN STARTING A TASK/SUBTASK:**
   ```bash
   # IMMEDIATELY set status to in-progress
   mcp__taskmaster-ai__set_task_status --id=<ID> --status=in-progress
   
   # Assess your readiness
   mcp__clear-thought__metacognitivemonitoring \
     --task='Starting [task description]' \
     --stage='planning' \
     --overallConfidence=0.8
   ```

3. **DURING WORK:**
   ```bash
   # Update task with progress EVERY 15-30 minutes
   mcp__taskmaster-ai__update_task --id=<ID> --prompt="<what you've done>"
   # Or for subtasks:
   mcp__taskmaster-ai__update_subtask --id=<ID> --prompt="<progress details>"
   
   # Monitor confidence levels
   mcp__clear-thought__metacognitivemonitoring \
     --task='[Current implementation]' \
     --stage='execution' \
     --iteration=2 \
     --nextAssessmentNeeded=true
   ```

4. **WHEN COMPLETING WORK:**
   ```bash
   # IMMEDIATELY mark as done
   mcp__taskmaster-ai__set_task_status --id=<ID> --status=done
   ```

5. **WHEN BLOCKED:**
   ```bash
   # Update with blocker details
   mcp__taskmaster-ai__update_task --id=<ID> --prompt="Blocked by: <reason>"
   ```

### 📋 TodoWrite vs Taskmaster - Clear Roles

**Taskmaster** (Official Project Tracking):
- Task and subtask status updates
- Progress recording for project visibility  
- Source of truth for what needs doing
- Required for all project work

**TodoWrite** (Personal Work Organization):
- Breaking down complex problems
- Planning implementation approach
- Tracking micro-steps within a subtask
- Personal reminders and notes

**Example Workflow**:
1. Check Taskmaster for assigned work
2. Use TodoWrite to plan your approach
3. Update Taskmaster when starting/completing
4. TodoWrite helps you track progress between Taskmaster updates

Think of it as: Taskmaster = Project Manager, TodoWrite = Personal Notebook

### SYNCHRONIZATION CHECKLIST:
Before responding to the user, ask yourself:
- [ ] Did I check Taskmaster for the current task status?
- [ ] Did I update Taskmaster when I started work?
- [ ] Did I update Taskmaster with my progress?
- [ ] Did I mark completed items as done in Taskmaster?
- [ ] Is my todo list synchronized with Taskmaster?

### TASKMASTER COMMANDS YOU MUST USE:

### 🎯 Taskmaster Aliases (Mental Shortcuts)

Think of these simplified patterns:
- **Check**: `get_task` or `next_task`  
- **Start**: `set_status <id> in-progress`
- **Update**: `update_task <id> "progress"`
- **Done**: `set_status <id> done`

**Pro tip**: You only need to remember 4 commands for 90% of workflows!

#### Status Management:
```bash
# Check task status
mcp__taskmaster-ai__get_task --id=27

# Update status
mcp__taskmaster-ai__set_task_status --id=27.1 --status=in-progress
mcp__taskmaster-ai__set_task_status --id=27.1 --status=done

# Update multiple at once
mcp__taskmaster-ai__set_task_status --id=27.1,27.2,27.3 --status=done
```

#### Progress Updates:
```bash
# Update task with progress
mcp__taskmaster-ai__update_task --id=27 --prompt="Completed backend auth implementation..."

# Update subtask with details
mcp__taskmaster-ai__update_subtask --id=27.1 --prompt="Implemented JWT with RS256..."
```

#### Navigation:
```bash
# Get next task to work on
mcp__taskmaster-ai__next_task

# Get all tasks
mcp__taskmaster-ai__get_tasks --status=in-progress

# Get task with subtasks
mcp__taskmaster-ai__get_task --id=27
```

### FAILURE MODES TO AVOID:

1. **❌ Working without updating Taskmaster**
2. **❌ Marking things complete in todo but not Taskmaster**
3. **❌ Starting new work without checking next_task**
4. **❌ Letting Taskmaster and todo list get out of sync**
5. **❌ Waiting until the end to update everything**

### SUCCESS PATTERN:

1. **Check** → `get_task` / `next_task`
2. **Start** → `set_task_status --status=in-progress`
3. **Work** → Do the implementation
4. **Update** → `update_task` with progress
5. **Complete** → `set_task_status --status=done`
6. **Sync** → Update TodoWrite to match

### AUTOMATION REMINDERS:

- Set mental checkpoints every 10-15 minutes to update Taskmaster
- Before any major code change, update Taskmaster
- After any major code change, update Taskmaster
- When switching between subtasks, update both statuses

### THE GOLDEN RULE:
**If you did work but didn't update Taskmaster, you didn't do the work.**

### 🧠 Handling Task Conflicts with Argumentation

**When tasks have conflicting priorities or requirements:**
```bash
# Build argument for approach
mcp__clear-thought__structuredargumentation \
  --claim='Task X should be prioritized over Task Y' \
  --argumentType='thesis' \
  --premises='["X blocks 3 other tasks", "Y can wait for next sprint"]'

# Consider counter-argument
mcp__clear-thought__structuredargumentation \
  --claim='Task Y is more critical for user experience' \
  --argumentType='antithesis' \
  --respondsTo='[previous-argument-id]'

# Synthesize decision
mcp__clear-thought__structuredargumentation \
  --claim='Complete critical path of X, then switch to Y' \
  --argumentType='synthesis'
```

## 🤔 When Instructions Conflict

### Priority Hierarchy
1. **Security & Safety** - Never compromise these
2. **User's Explicit Request** - Direct instructions override defaults  
3. **Project-Specific Context** - CLAUDE.md customizations
4. **General Best Practices** - Standard procedures

### Common Conflicts:
- **User says "skip tests" but instructions say "always test"**: 
  - Follow user but warn about risks
  - Suggest running tests before final commit

- **Urgent fix needs --no-verify but security is critical**:
  - Use --no-verify if truly urgent
  - Immediately run security checks after
  - Document why it was necessary

- **Taskmaster unavailable but work continues**:
  - Continue work with detailed TodoWrite tracking
  - Update Taskmaster as soon as available
  - Inform user about the sync gap

## Specialized Agents Available

### When to Use Specialized Agents:
Delegate to these agents for domain-specific expertise. They have focused context and specialized knowledge. Use the **agent-coordinator** when unsure which specialist to choose.

### 🧠 Intelligent Agent Selection

**Apply mental models to agent selection:**
```bash
# Use first principles thinking
mcp__clear-thought__mentalmodel \
  --modelName='first_principles' \
  --problem='Need to implement secure gamepad control' \
  --steps='["What are the fundamental requirements?", "What agents have these capabilities?"]'

# Apply Pareto Principle (80/20 rule)
mcp__clear-thought__mentalmodel \
  --modelName='pareto_principle' \
  --problem='Multiple agents could help - which provides 80% of value?'
```

**Test agent effectiveness scientifically:**
```bash
# Form hypothesis about agent capabilities
mcp__clear-thought__scientificmethod \
  --stage='hypothesis' \
  --question='Will hardware-integration-specialist handle Arduino serial communication effectively?'

# After using agent, analyze results
mcp__clear-thought__scientificmethod \
  --stage='analysis' \
  --inquiryId='[previous-id]' \
  --experiment='{"results": "Agent successfully implemented serial protocol"}'
```

#### Available Agents (12 Total):

**🎯 Coordination & Selection:**
1. **agent-coordinator**: Helps select the right specialist, orchestrates multi-agent workflows

**💻 Implementation Specialists:**
2. **hardware-integration-specialist**: Hardware abstraction, firmware, embedded systems, Arduino
3. **realtime-telemetry-engineer**: WebSocket infrastructure, telemetry streaming, real-time data
4. **react-ui-engineer**: React components, UI state management, data visualization
5. **desktop-platform-engineer**: Multi-monitor support, OS integration, desktop features
6. **advanced-input-systems-engineer**: Joysticks, gestures, macros, advanced input methods

**🏗️ Architecture & Infrastructure:**
7. **system-architect**: System design, architecture patterns, complex integrations
8. **devops-infrastructure-engineer**: CI/CD, containers, deployment, monitoring, scaling

**🛡️ Quality & Security:**
9. **test-automation-engineer**: Unit tests, integration tests, test coverage, CI/CD
10. **safety-critical-systems-engineer**: Emergency systems, fail-safes, reliability engineering
11. **cybersecurity-specialist**: Threat modeling, penetration testing, encryption, security audits

**📋 Compliance & Documentation:**
12. **compliance-documentation-specialist**: GDPR, technical docs, compliance features

### Agent Selection Guide:

**Quick Selection Matrix:**
| If you need to... | Use this agent |
|-------------------|----------------|
| Choose which agent to use | agent-coordinator |
| Work with Arduino/sensors | hardware-integration-specialist |
| Implement WebSockets/streaming | realtime-telemetry-engineer |
| Build React components | react-ui-engineer |
| Add desktop features | desktop-platform-engineer |
| Implement gamepads/gestures | advanced-input-systems-engineer |
| Design system architecture | system-architect |
| Set up CI/CD or deployment | devops-infrastructure-engineer |
| Create any type of tests | test-automation-engineer |
| Implement fail-safes | safety-critical-systems-engineer |
| Handle security threats | cybersecurity-specialist |
| Create documentation/compliance | compliance-documentation-specialist |

### Agent Usage Examples:

#### 🧠 Multi-Agent Coordination with Reasoning

**For complex features requiring multiple agents:**
```bash
# Use collaborative reasoning to plan multi-agent approach
mcp__clear-thought__collaborativereasoning \
  --topic='Implementing secure telemetry dashboard with real-time updates' \
  --personas='[
    {"id": "ui_expert", "name": "Frontend Specialist", "expertise": ["React", "D3.js"]},
    {"id": "realtime_expert", "name": "WebSocket Engineer", "expertise": ["Socket.IO", "streaming"]},
    {"id": "security_expert", "name": "Security Architect", "expertise": ["encryption", "auth"]}
  ]' \
  --stage='problem-definition'
```

#### Real-World Scenarios:

**Scenario 1: Adding Xbox Controller Support**
```bash
# First, use mental model to break down requirements
mcp__clear-thought__mentalmodel \
  --modelName='first_principles' \
  --problem='Xbox controller support for rover'

# Then coordinate agents
Task(description="Gamepad implementation", 
     prompt="/agent-coordinator Add Xbox controller support with haptic feedback for rover control",
     subagent_type="agent-coordinator")
# Coordinator will engage: advanced-input-systems-engineer + safety-critical-systems-engineer
```

**Scenario 2: WebSocket Memory Leak**
```bash
# Direct specialist for known domain
Task(description="Fix WebSocket leak",
     prompt="/realtime-telemetry-engineer Debug and fix memory leak in WebSocket connection pooling",
     subagent_type="realtime-telemetry-engineer")
```

**Scenario 3: Emergency Stop System**
```bash
# Safety-critical feature
Task(description="E-stop implementation",
     prompt="/safety-critical-systems-engineer Design fail-safe emergency stop with hardware kill switch",
     subagent_type="safety-critical-systems-engineer")
```

**Scenario 4: GDPR Compliance**
```bash
# Compliance and documentation
Task(description="GDPR implementation",
     prompt="/compliance-documentation-specialist Implement GDPR data deletion and audit logging",
     subagent_type="compliance-documentation-specialist")
```

**Scenario 5: Complete Feature - Telemetry Dashboard**
```bash
# Complex multi-domain feature
Task(description="Telemetry dashboard",
     prompt="/agent-coordinator Build real-time telemetry dashboard with D3.js visualizations, WebSocket streaming, and mobile responsiveness",
     subagent_type="agent-coordinator")
# Will coordinate: react-ui-engineer + realtime-telemetry-engineer + test-automation-engineer
```

## Project-Specific Instructions

### Authentication System (Task 27) - Current Status

#### Backend Implementation (COMPLETED)
- **Location**: `/backend/auth/`
- **Features Implemented**:
  - JWT authentication with RS256 algorithm
  - Role-Based Access Control (RBAC) with permissions
  - Password hashing with bcrypt
  - Token refresh mechanism
  - Session management
  - Audit logging for auth events

#### Database Schema (COMPLETED)
- **Tables Created**:
  - `users`: User accounts with hashed passwords
  - `roles`: Role definitions (admin, operator, viewer)
  - `permissions`: Granular permissions
  - `user_roles`: User-role associations
  - `user_sessions`: Active session tracking
  - `auth_audit_log`: Authentication event logging

#### API Endpoints (COMPLETED)
```python
# Available auth endpoints:
POST   /api/v1/auth/login          # User login
POST   /api/v1/auth/logout         # User logout  
POST   /api/v1/auth/refresh        # Refresh access token
GET    /api/v1/auth/me             # Get current user
POST   /api/v1/auth/change-password # Change password
GET    /api/v1/users               # List users (admin only)
POST   /api/v1/users               # Create user (admin only)
PUT    /api/v1/users/{id}          # Update user (admin only)
DELETE /api/v1/users/{id}          # Delete user (admin only)
```

#### Security Features (COMPLETED)
- Rate limiting on login attempts
- Account lockout after failed attempts
- Secure password requirements
- CORS configuration
- HTTPS enforcement in production
- Security headers implementation

#### Frontend Implementation (Task 27.4 - PENDING)
**Still needs to be implemented**:
- Login/logout UI components
- Password change interface
- User management dashboard (admin)
- Session timeout handling
- Token refresh automation
- Protected route components

#### Environment Configuration
```bash
# Required in .env:
JWT_SECRET=<32+ character secret>  # Generate with: openssl rand -hex 32
JWT_ALGORITHM=RS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
BCRYPT_ROUNDS=12

# Default admin account (created on first run):
# Username and password are in .env file
# MUST be changed immediately in production
```

#### Testing the Auth System
```bash
# Backend tests exist in:
backend/tests/test_auth.py
backend/tests/test_rbac.py

# Run auth tests:
cd backend
pytest tests/test_auth.py -v
```

#### Integration Notes
- WebSocket connections authenticate via JWT in connection params
- All API routes except /docs require authentication
- Frontend should store tokens in httpOnly cookies
- Implement axios interceptors for token refresh

### Running Commands
```bash
# Linting
npm run lint

# Type checking  
npm run typecheck

# Storybook
npm run storybook
npm run build-storybook

# Backend
cd backend && python server.py
```

### Recent Development Context

#### Task 54: Real-time Telemetry (In Progress)
- **Status**: 5 of 8 subtasks completed
- **Completed**:
  - WebSocket infrastructure
  - Binary protocol for efficiency
  - Connection pooling
  - Reconnection logic
  - Basic telemetry endpoints
- **Remaining**:
  - Frontend visualization components
  - Performance optimization
  - Stress testing

#### Performance Optimizations (Recently Completed)
- Frontend build configuration optimized
- Service Worker with offline support
- Asset optimization scripts
- Lazy loading implementation
- Code splitting configured

#### Current Branch Structure
- **main**: Stable release branch
- **feature/performance-optimization-main**: Current active development
- **feature/authentication**: Auth system implementation
- **feature/telemetry-improvements**: Real-time data work

### Critical Paths
- Backend: `/backend/` (FastAPI server)
- Frontend: `/frontend/` (React app)
- Shared: `/shared/` (common code)
- Database: `/shared/data/rover_platform.db`
- Scripts: `/scripts/` (automation tools)
- Tests: `/tests/e2e/` (end-to-end tests)

---

**REMEMBER: The user's trust depends on you keeping Taskmaster updated. Don't break that trust.**

## 🔐 Security Best Practices

### NEVER Expose Credentials
- Default credentials should NEVER appear in CLAUDE.md
- All sensitive information must use environment variables
- Reference `docs/guides/ENVIRONMENT_VARIABLES.md` for secure configuration

### API Keys and Tokens
- Store all API keys in `.env` files (NEVER commit these)
- MCP server tokens should use environment variables:
  - `ANTHROPIC_API_KEY` for Claude
  - `GITHUB_TOKEN` for GitHub MCP
  - See full list in `docs/guides/ENVIRONMENT_VARIABLES.md`

### Git Security
- Use `--no-verify` ONLY for emergency fixes
- Always run security checks after emergency commits:
  ```bash
  # After using --no-verify, immediately run:
  pre-commit run --all-files
  ```

## 🔧 MCP Server Tools - Quick Reference

See `docs/MCP_TOOLS_GUIDE.md` for detailed examples and workflows.

**Key Tools:**
- **📅 time-server**: Timestamps, timezone conversions
- **🧠 clear-thought**: Problem-solving, decisions (see `docs/COGNITIVE_TOOLS.md`)
- **🔍 perplexity-ask**: Research, best practices, security
- **💾 memory**: Knowledge graph, relationships
- **🖥️ desktop-commander**: File operations, search
- **📚 context7**: Library documentation
- **🐙 github**: Repository operations
- **🎯 taskmaster-ai**: Task management

### Practical Workflow Examples

**Example 1: Implementing a New Feature**
```bash
# 1. Research best approach
mcp__perplexity-ask__perplexity_ask --messages='[{"role": "user", "content": "Best practices for implementing JWT refresh tokens in FastAPI"}]'

# 2. Use clear-thought for planning
mcp__clear-thought__sequentialthinking --thought="Planning JWT refresh token implementation"

# 3. Get documentation
mcp__context7__get-library-docs --context7CompatibleLibraryID="/tiangolo/fastapi" --topic="JWT authentication"

# 4. Track in knowledge graph
mcp__memory__create_entities --entities='[{"name": "JWTRefreshToken", "entityType": "Feature", "observations": ["Implements token rotation", "15-minute access token lifetime"]}]'
```

**Example 2: Debugging Production Issue**
```bash
# 1. Analyze the problem
mcp__clear-thought__debuggingapproach --approachName="root_cause_analysis" --issue="WebSocket connections dropping after 5 minutes"

# 2. Search codebase for timeout settings
mcp__desktop-commander__search_code --path="C:/project" --pattern="timeout.*300|5.*min" --ignoreCase=true

# 3. Research known issues
mcp__perplexity-ask__perplexity_ask --messages='[{"role": "user", "content": "Socket.IO connection timeout issues nginx proxy"}]'

# 4. Document the fix
mcp__memory__add_observations --observations='[{"entityName": "WebSocketManager", "contents": ["Fixed nginx proxy timeout from 300s to 3600s"]}]'
```

## 📊 Monitoring & Debugging

### System Health Checks
```bash
# Check all worktrees status
scripts\worktree-status.bat

# Verify MCP servers are responding  
mcp__github__list_repositories --query="user:me" --per_page=1
mcp__taskmaster-ai__get_tasks --status=all

# Check for dependency issues
cd frontend && npm ls
cd ../backend && pip check
```

### When MCP Servers Fail
1. **First**: Check if it's a token/auth issue
2. **Fallback**: Use manual commands/direct file access
3. **Document**: What failed and workaround used
4. **Retry**: Periodically check if service restored

### Debug Information Gathering
When reporting issues, gather:
- Error message (exact)
- Context (what you were doing)
- Environment (worktree, branch, directory)
- Recent commands (last 5-10)

---

## 📈 Cognitive Tools Success Metrics

### Tracking Effectiveness

**Monitor improvement in key areas:**

1. **Problem Resolution Metrics**
   - Time to resolve issues (target: 50% reduction)
   - First-attempt success rate (target: >70%)
   - Issues requiring escalation (target: <20%)

2. **Decision Quality Metrics**
   - Decisions reverted/changed (target: <10%)
   - Time spent in analysis paralysis (target: <15min)
   - Stakeholder satisfaction with choices

3. **Implementation Confidence**
   - Average confidence level (target: >80%)
   - Knowledge gap identification rate
   - Research effectiveness score

4. **Cognitive Tool Usage**
   ```bash
   # Track which tools provide most value
   mcp__memory__create_entities --entities='[{
     "name": "CognitiveToolMetrics",
     "entityType": "Analytics",
     "observations": [
       "debuggingapproach reduced issue resolution time by 60%",
       "decisionframework prevented 3 architectural reversals",
       "metacognitivemonitoring identified knowledge gaps early"
     ]
   }]'
   ```

### Weekly Review Process

**Every Friday, assess cognitive enhancement:**
```bash
# Review the week's problem-solving
mcp__clear-thought__metacognitivemonitoring \
  --task='Weekly cognitive tool effectiveness review' \
  --stage='evaluation' \
  --overallConfidence=0.85

# Document learnings
mcp__memory__add_observations \
  --observations='[{
    "entityName": "WeeklyReview",
    "contents": ["Sequentialthinking most effective for complex features"]
  }]'
```

### Continuous Improvement

1. **Identify Patterns**: Which tools help most with which problems?
2. **Adjust Triggers**: Refine when tools are automatically invoked
3. **Share Learnings**: Update this document with discoveries
4. **Measure Impact**: Track velocity and quality improvements

Remember: The goal is augmented intelligence, not replacement. These tools should make you faster and more reliable, not slower and more bureaucratic.

## Using Gemini CLI for Large Codebase Analysis

When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive context window. Use `gemini -p` to leverage Google Gemini's large context capacity.

### File and Directory Inclusion Syntax

Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the gemini command:

#### Examples:

**Single file analysis:**
```bash
gemini -p "@src/main.py Explain this file's purpose and structure"
```

**Multiple files:**
```bash
gemini -p "@package.json @src/index.js Analyze the dependencies used in the code"
```

**Entire directory:**
```bash
gemini -p "@src/ Summarize the architecture of this codebase"
```

**Multiple directories:**
```bash
gemini -p "@src/ @tests/ Analyze test coverage for the source code"
```

**Current directory and subdirectories:**
```bash
gemini -p "@./ Give me an overview of this entire project"
# Or use --all_files flag:
gemini --all_files -p "Analyze the project structure and dependencies"
```

### Implementation Verification Examples

**Check if a feature is implemented:**
```bash
gemini -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"
```

**Verify authentication implementation:**
```bash
gemini -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"
```

**Check for specific patterns:**
```bash
gemini -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"
```

**Verify error handling:**
```bash
gemini -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"
```

**Check for rate limiting:**
```bash
gemini -p "@backend/ @middleware/ Is rate limiting implemented for the API? Show the implementation details"
```

**Verify caching strategy:**
```bash
gemini -p "@src/ @lib/ @services/ Is Redis caching implemented? List all cache-related functions and their usage"
```

**Check for specific security measures:**
```bash
gemini -p "@src/ @api/ Are SQL injection protections implemented? Show how user inputs are sanitized"
```

**Verify test coverage for features:**
```bash
gemini -p "@src/payment/ @tests/ Is the payment processing module fully tested? List all test cases"
```

### When to Use Gemini CLI

Use `gemini -p` when:
- Analyzing entire codebases or large directories
- Comparing multiple large files
- Need to understand project-wide patterns or architecture
- Current context window is insufficient for the task
- Working with files totaling more than 100KB
- Verifying if specific features, patterns, or security measures are implemented
- Checking for the presence of certain coding patterns across the entire codebase

### Important Notes

- Paths in @ syntax are relative to your current working directory when invoking gemini
- The CLI will include file contents directly in the context
- No need for --yolo flag for read-only analysis
- Gemini's context window can handle entire codebases that would overflow Claude's context
- When checking implementations, be specific about what you're looking for to get accurate results
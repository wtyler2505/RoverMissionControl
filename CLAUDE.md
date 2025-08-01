# CLAUDE.md - Critical Instructions for Claude

## 🚨 IMMEDIATE PROBLEM-SOLVING PROTOCOL - HIGHEST PRIORITY

### 🔥 MANDATORY: Fix Problems IMMEDIATELY When They Occur

**RULE #1: STOP EVERYTHING AND FIX ISSUES AS SOON AS THEY HAPPEN**

When ANY issue occurs during a session:

1. **STOP** whatever current work you're doing immediately
2. **IDENTIFY** the root cause of the issue 
3. **FIX** the issue completely before continuing with any other work
4. **VERIFY** the fix works properly
5. **DOCUMENT** what went wrong and how it was fixed
6. **ONLY THEN** continue with the original task

### 📋 COMMON ISSUES THAT MUST BE FIXED IMMEDIATELY:

#### 🌳 Worktree Issues
- **Symptom**: Worktree exists but can't access it or dependencies missing
- **Action**: IMMEDIATELY run the correct setup script:
  ```bash
  # From main worktree:
  scripts\worktree-setup-secure.bat "C:\Users\wtyle\rover-[name]" [task-id]
  ```
- **Verification**: Confirm all dependencies installed and environment files exist

#### 🔧 Dependency Issues  
- **Symptom**: Import errors, missing packages, build failures
- **Action**: IMMEDIATELY install missing dependencies in correct environment
- **Verification**: Run tests or build to confirm everything works

#### 📝 File Access Issues
- **Symptom**: Can't read/write files, permission errors
- **Action**: IMMEDIATELY check file paths, permissions, and fix access issues
- **Verification**: Successfully complete the intended file operation

#### 🔗 API/Service Issues
- **Symptom**: Network errors, service unavailable, authentication failures  
- **Action**: IMMEDIATELY check service status, credentials, and connectivity
- **Verification**: Successfully connect to and use the service

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

## 🌳 Git Worktrees - CRITICAL PARALLEL DEVELOPMENT SETUP

### 🚨 MANDATORY: Understanding Git Worktrees
Git worktrees allow multiple branches to be checked out simultaneously in separate directories. This enables:
- **Parallel Claude Sessions**: Run multiple AI assistants on different features
- **Zero Context Switching**: No stashing, no branch switching, no lost work
- **Complete Isolation**: Each worktree has its own file state and dependencies
- **Shared Repository**: All worktrees share the same Git history and commits

### 📍 Current Active Worktrees
| Worktree | Location | Branch | Purpose | Taskmaster Task |
|----------|----------|--------|---------|-----------------|
| **Main** | `C:/Users/wtyle/RoverMissionControl` | `main` | Primary development | Various |
| **Auth** | `C:/Users/wtyle/rover-auth` | `feature/authentication` | Authentication system | Task 27 |
| **Telemetry** | `C:/Users/wtyle/rover-telemetry` | `feature/telemetry-improvements` | Real-time data viz | Task 23 |
| **Hotfix** | `C:/Users/wtyle/rover-hotfix` | `hotfix/urgent-fixes` | Critical bug fixes | As needed |

### 🎯 CRITICAL WORKFLOW: Using Worktrees with Claude

#### 1. Starting a New Feature in a Worktree
```bash
# STEP 1: Create worktree for your task
git worktree add ../rover-gamepad -b feature/gamepad-control

# STEP 2: Setup environment (MANDATORY!)
./scripts/worktree-setup.bat ../rover-gamepad

# STEP 3: Navigate and start Claude
cd ../rover-gamepad
claude

# STEP 4: In Claude, immediately sync with Taskmaster
# Tell Claude: "I'm working on Task 15 (Gamepad Control) in the gamepad worktree"
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

**The setup script handles this automatically:**
```bash
# Windows
./scripts/worktree-setup.bat ../rover-<name>

# Unix/Mac
./scripts/worktree-setup.sh ../rover-<name>
```

### 🛠️ Essential Worktree Commands

```bash
# CREATE: New worktree with new branch
git worktree add ../rover-<name> -b feature/<branch-name>

# CREATE: New worktree with existing branch
git worktree add ../rover-<name> <existing-branch>

# LIST: Show all worktrees
git worktree list

# REMOVE: Delete worktree (after merging)
git worktree remove ../rover-<name>

# PRUNE: Clean up deleted worktree references
git worktree prune

# STATUS: Check worktree details
cd ../rover-auth && git status
```

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

# ✅ CORRECT
git worktree add ../rover-feature -b feature/new
./scripts/worktree-setup.bat ../rover-feature
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
./scripts/worktree-setup.bat .
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
# ✅ SECURE - Use this for production-ready setup
./scripts/worktree-setup-secure.bat ../rover-<name> <task-id>

# ✅ TASK-INTEGRATED - Best for new features
./scripts/create-task-worktree.bat

# ⚠️ DEPRECATED - Original script has security issues
# ./scripts/worktree-setup.bat (DO NOT USE)
```

### 🚀 Advanced Worktree Patterns

#### Pattern 1: Feature Branch Development
```bash
# Main feature branch
git worktree add ../rover-telemetry -b feature/telemetry

# Sub-feature branches
git worktree add ../rover-telemetry-ui -b feature/telemetry-ui
git worktree add ../rover-telemetry-api -b feature/telemetry-api

# Merge sub-features into main feature
cd ../rover-telemetry
git merge feature/telemetry-ui
git merge feature/telemetry-api
```

#### Pattern 2: A/B Testing Implementations
```bash
# Approach A: Socket.IO
git worktree add ../rover-socketio -b feature/telemetry-socketio

# Approach B: Native WebSockets  
git worktree add ../rover-websocket -b feature/telemetry-websocket

# Compare and choose best approach
```

#### Pattern 3: Multi-Version Support
```bash
# Current version development
git worktree add ../rover-v2 -b release/v2.0

# Hotfix for previous version
git worktree add ../rover-v1-hotfix -b hotfix/v1.5.1
```

### 📚 Complete Worktree Reference
Full documentation: `docs/WORKTREE_GUIDE.md`
Setup scripts: `scripts/worktree-setup.bat` (Windows), `scripts/worktree-setup.sh` (Unix)
Manager utility: `scripts/worktree-manager.sh`

## 🚨 MANDATORY TASKMASTER SYNCHRONIZATION 🚨

### RULE #1: TASKMASTER IS THE SINGLE SOURCE OF TRUTH
**EVERY SINGLE ACTION** you take on a task MUST be reflected in Taskmaster IMMEDIATELY.

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
   ```

3. **DURING WORK:**
   ```bash
   # Update task with progress EVERY 15-30 minutes
   mcp__taskmaster-ai__update_task --id=<ID> --prompt="<what you've done>"
   # Or for subtasks:
   mcp__taskmaster-ai__update_subtask --id=<ID> --prompt="<progress details>"
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

### YOUR TODO LIST IS SECONDARY
- Your TodoWrite tool is just a personal reminder
- It should MIRROR Taskmaster, not replace it
- If they're out of sync, Taskmaster is correct

### SYNCHRONIZATION CHECKLIST:
Before responding to the user, ask yourself:
- [ ] Did I check Taskmaster for the current task status?
- [ ] Did I update Taskmaster when I started work?
- [ ] Did I update Taskmaster with my progress?
- [ ] Did I mark completed items as done in Taskmaster?
- [ ] Is my todo list synchronized with Taskmaster?

### TASKMASTER COMMANDS YOU MUST USE:

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

## Specialized Agents Available

### When to Use Specialized Agents:
Delegate to these agents for domain-specific expertise. They have focused context and specialized knowledge. Use the **agent-coordinator** when unsure which specialist to choose.

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
```bash
# When unsure which agent to use
Task(description="Agent selection", prompt="/agent-coordinator I need to add secure gamepad control", subagent_type="agent-coordinator")

# For hardware tasks
Task(description="Arduino integration", prompt="/hardware-integration-specialist Implement serial communication with Arduino", subagent_type="hardware-integration-specialist")

# For security review
Task(description="Security audit", prompt="/cybersecurity-specialist Review API endpoints for vulnerabilities", subagent_type="cybersecurity-specialist")

# For multi-agent workflows
Task(description="Complex feature", prompt="/agent-coordinator Implement secure telemetry with UI dashboard", subagent_type="agent-coordinator")
```

## Project-Specific Instructions

### Authentication System (Task 27)
- Backend implementation is in `/backend/auth/`
- Database tables are initialized
- Only Task 27.4 (Frontend UI) remains
- Default admin: admin/Admin@123 (CHANGE IN PRODUCTION)

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

### Critical Paths
- Backend: `/backend/` (FastAPI server)
- Frontend: `/frontend/` (React app)
- Shared: `/shared/` (common code)
- Database: `/shared/data/rover_platform.db`

---

**REMEMBER: The user's trust depends on you keeping Taskmaster updated. Don't break that trust.**

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
# 🚀 Git Worktrees Quick Reference Card

## ⚡ Most Used Commands

```bash
# List worktrees
git worktree list

# Create & setup new worktree
git worktree add ../rover-<name> -b feature/<branch>
./scripts/worktree-setup.bat ../rover-<name>

# Switch to worktree
cd ../rover-<name>
claude

# Remove completed worktree
git worktree remove ../rover-<name>
```

## 📍 Current Worktrees

| Name | Path | Branch | Task |
|------|------|--------|------|
| Main | `../RoverMissionControl` | main | - |
| Auth | `../rover-auth` | feature/authentication | 27 |
| Telemetry | `../rover-telemetry` | feature/telemetry-improvements | 23 |
| Hotfix | `../rover-hotfix` | hotfix/urgent-fixes | - |

## 🎯 Quick Workflows

### New Feature
```bash
git worktree add ../rover-gamepad -b feature/gamepad
./scripts/worktree-setup.bat ../rover-gamepad
cd ../rover-gamepad && claude
# "Working on Task 15 in gamepad worktree"
```

### Emergency Fix
```bash
cd ../rover-hotfix
git pull origin main
claude
# "Fix critical bug in..."
```

### Parallel Work
```bash
# Terminal 1
cd ../rover-frontend && claude

# Terminal 2  
cd ../rover-backend && claude
```

## ⚠️ Critical Rules

1. **ALWAYS run setup script** after creating worktree
2. **Update Taskmaster** at start/during/end of work
3. **One task per worktree** - keep it focused
4. **Database is shared** - coordinate migrations
5. **Clean up** after PR merge

## 🔧 Common Fixes

| Problem | Solution |
|---------|----------|
| "Module not found" | `./scripts/worktree-setup.bat .` |
| "Branch already checked out" | Use different branch name |
| "Database locked" | Stop other backend servers |
| Port conflict | Change port in package.json/server |
| Missing .env | Copy from main worktree |

## 📞 Help Commands

```bash
# Check status
git worktree list
git status

# Verify setup
ls node_modules .env

# Clean up
git worktree prune
git worktree remove --force <path>
```

## 🏃 Speed Tips

- Use `claude --resume` to continue sessions
- Create aliases for common worktrees
- Keep terminal tabs open for each worktree
- Use VS Code workspace files per worktree

---
**Full Guide**: `docs/WORKTREE_GUIDE.md`
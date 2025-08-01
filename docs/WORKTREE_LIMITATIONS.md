# Git Worktree Implementation - Known Limitations & Critical Notes

## 🚨 CRITICAL SECURITY CONSIDERATIONS

### Environment File Handling
**ISSUE**: The setup scripts copy `.env` files between worktrees, which could expose secrets.

**MITIGATION**:
1. Never store production secrets in development `.env` files
2. Use `.env.example` files for templates
3. The secure setup script now prompts before copying
4. Consider using a secrets management system for sensitive data

### Database Access
**ISSUE**: All worktrees share the same SQLite database file.

**IMPLICATIONS**:
- Concurrent writes may cause lock conflicts
- Schema changes in one worktree affect all others
- No data isolation between worktrees

**MITIGATION**:
1. Coordinate database migrations between worktrees
2. Consider read-only database access for feature branches
3. Use database transactions properly
4. Future: Implement per-worktree test databases

## ⚠️ Technical Limitations

### 1. Windows Path Handling
- Scripts may fail with paths containing spaces
- Workaround: Use short names or paths without spaces
- Fix planned in next iteration

### 2. Cross-Platform Support
- Current scripts are Windows-only (.bat files)
- Unix/Mac support via .sh scripts needs testing
- PowerShell Core scripts would be more portable

### 3. Port Conflicts
- Multiple worktrees running services need different ports
- Manual configuration required in package.json and server startup
- No automatic port assignment yet

### 4. Dependency Duplication
- Each worktree has its own node_modules and venv
- Significant disk space usage (1-2GB per worktree)
- No shared dependency cache implemented

## 📋 Operational Limitations

### 1. No Automatic Cleanup
- Completed worktrees must be manually removed
- Stale branches accumulate over time
- No integration with PR merge events

### 2. Limited CI/CD Integration
- Worktrees are local-only
- No automatic creation from PR reviews
- No cloud-based worktree support

### 3. Taskmaster Integration Gaps
- Task linking is manual (must provide task ID)
- No automatic task status updates
- No validation that task ID exists
- No prevention of multiple worktrees for same task

## 🔧 Planned Improvements

### High Priority
1. **Enhanced Security**: Implement `.env` encryption and validation
2. **Better Error Handling**: Add rollback on setup failure
3. **Automated Ports**: Dynamic port assignment to prevent conflicts
4. **Task Validation**: Verify task exists before creating worktree

### Medium Priority
1. **Cross-Platform Scripts**: PowerShell Core or Python setup scripts
2. **Shared Dependencies**: Implement pnpm or yarn workspaces
3. **Database Isolation**: Per-worktree test databases
4. **Cleanup Automation**: Hook into git branch deletion

### Future Vision
1. **Cloud Worktrees**: Support for GitHub Codespaces
2. **Smart Routing**: Automatic port forwarding and service discovery
3. **Full Taskmaster Integration**: Bidirectional sync with task system
4. **Worktree Templates**: Pre-configured setups for common tasks

## 💡 Best Practices Until Fixed

1. **Always Review Before Setup**
   ```bash
   # Check what will be copied
   cat .env | grep -i secret
   cat frontend/.env | grep -i key
   cat backend/.env | grep -i password
   ```

2. **Use Task-Specific Branches**
   ```bash
   # Good: Includes task reference
   feature/auth-task-27
   bugfix/websocket-task-45
   
   # Bad: No task reference
   feature/new-stuff
   fix-things
   ```

3. **Document Port Usage**
   ```bash
   # In each worktree's README
   echo "Frontend: http://localhost:3001" >> README.md
   echo "Backend: http://localhost:8001" >> README.md
   ```

4. **Regular Cleanup**
   ```bash
   # Weekly cleanup routine
   git worktree list
   git worktree prune
   git branch -d [merged-branches]
   ```

## 🐛 Known Bugs

1. **Bug**: Setup continues even if npm install fails
   - **Workaround**: Check install.log if issues occur
   - **Fix**: Planned in secure setup script

2. **Bug**: Python venv activation fails silently on some Windows configs
   - **Workaround**: Manually activate venv after setup
   - **Fix**: Investigating PowerShell activation method

3. **Bug**: Relative database paths don't work on all systems
   - **Workaround**: Use absolute paths in backend/.env
   - **Fix**: Implement path resolution in application

## 📞 Getting Help

If you encounter issues not listed here:

1. Check `WORKTREE_INFO.txt` in your worktree
2. Review setup logs (install.log, pip_install.log)
3. Run `scripts\worktree-status.bat` for diagnostics
4. Ask Claude: "Help debug my worktree setup issue"

Remember: These limitations are temporary. The worktree system is powerful but requires careful use until all issues are resolved.
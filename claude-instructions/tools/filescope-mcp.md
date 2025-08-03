# FileScopeMCP Integration Module

**MODULE_ID**: FILESCOPE_MCP
**VERSION**: 1.0.0
**PRIORITY**: HIGH
**DEPENDS_ON**: core/quick-start.md
**REFERENCES**: tools/development-suite.md, project/current-status.md
**CONTEXT**: File analysis, codebase understanding, dependency tracking, architecture visualization

## 🎯 Purpose
FileScopeMCP provides intelligent codebase analysis to help understand file relationships, importance rankings, and dependency structures. Essential for navigating complex projects and making informed architectural decisions.

## 🔧 Current Configuration
- **Active Tree**: `FileScopeMCP-tree.json`
- **Base Directory**: `C:/Users/wtyle/RoverMissionControl`
- **Last Updated**: Tracked automatically
- **File Watching**: Configurable real-time monitoring

## 📊 Core Capabilities

### 1. File Importance Analysis (0-10 scale)
```bash
# Find most important files
mcp__FileScopeMCP__find_important_files --minImportance=7 --limit=20

# Check specific file importance
mcp__FileScopeMCP__get_file_importance --filepath="frontend/src/App.tsx"

# Manually adjust importance
mcp__FileScopeMCP__set_file_importance --filepath="path/to/file" --importance=8
```

### 2. Dependency Tracking
```bash
# Recalculate all dependencies
mcp__FileScopeMCP__recalculate_importance

# List all files with rankings
mcp__FileScopeMCP__list_files
```

### 3. File Tree Management
```bash
# Create/load a file tree
mcp__FileScopeMCP__create_file_tree --filename="project-tree.json" --baseDirectory="/path"

# Select existing tree
mcp__FileScopeMCP__select_file_tree --filename="FileScopeMCP-tree.json"

# List saved trees
mcp__FileScopeMCP__list_saved_trees

# Delete tree
mcp__FileScopeMCP__delete_file_tree --filename="old-tree.json"
```

### 4. File Summaries & Documentation
```bash
# Get file summary
mcp__FileScopeMCP__get_file_summary --filepath="path/to/file"

# Set file summary (human or AI-generated)
mcp__FileScopeMCP__set_file_summary --filepath="path/to/file" --summary="Critical auth module"

# Read file content directly
mcp__FileScopeMCP__read_file_content --filepath="path/to/file"
```

### 5. Visualization & Diagrams
```bash
# Generate Mermaid diagram (multiple styles)
mcp__FileScopeMCP__generate_diagram \
  --style="dependency" \  # Options: default, dependency, directory, hybrid, package-deps
  --minImportance=5 \
  --maxDepth=5 \
  --outputFormat="html" \  # Options: mmd, html
  --outputPath="./architecture.html" \
  --showDependencies=true \
  --packageGrouping=true

# Layout options
--layout='{"direction": "LR", "nodeSpacing": 50, "rankSpacing": 80}'
```

### 6. File Watching & Monitoring
```bash
# Toggle file watching
mcp__FileScopeMCP__toggle_file_watching

# Check watching status
mcp__FileScopeMCP__get_file_watching_status

# Update watching config
mcp__FileScopeMCP__update_file_watching_config \
  --config='{"enabled": true, "watchForNewFiles": true, "debounceMs": 500}'
```

### 7. Maintenance & Debugging
```bash
# List all file paths (debugging)
mcp__FileScopeMCP__debug_list_all_files

# Exclude files/patterns
mcp__FileScopeMCP__exclude_and_remove --filepath="node_modules/*"
```

## 🎯 Integration Patterns

### Pattern 1: Project Onboarding
```bash
# 1. Create/select tree for current project
mcp__FileScopeMCP__select_file_tree --filename="FileScopeMCP-tree.json"

# 2. Find critical files
mcp__FileScopeMCP__find_important_files --minImportance=8

# 3. Generate architecture diagram
mcp__FileScopeMCP__generate_diagram --style="hybrid" --outputFormat="html"
```

### Pattern 2: Feature Development
```bash
# 1. Identify affected files
mcp__FileScopeMCP__get_file_importance --filepath="feature/component.tsx"

# 2. Track dependencies
mcp__FileScopeMCP__list_files  # Filter by importance

# 3. Document changes
mcp__FileScopeMCP__set_file_summary --filepath="feature/component.tsx" \
  --summary="Added WebSocket integration for real-time updates"
```

### Pattern 3: Refactoring Support
```bash
# 1. Map current dependencies
mcp__FileScopeMCP__generate_diagram --style="dependency" --showDependencies=true

# 2. Identify high-impact files
mcp__FileScopeMCP__find_important_files --minImportance=9

# 3. Recalculate after changes
mcp__FileScopeMCP__recalculate_importance
```

## 🔍 Language Support
- **JavaScript/TypeScript**: import/export, require
- **Python**: import, from...import
- **C/C++**: #include
- **Rust**: use, mod
- **C#**: using
- **Java**: import
- **Lua**: require, dofile
- **Zig**: @import

## ⚡ Best Practices

### DO:
- ✅ Select appropriate tree before analysis
- ✅ Use importance rankings to prioritize work
- ✅ Generate diagrams for architecture reviews
- ✅ Add summaries to critical files
- ✅ Enable file watching for active development

### DON'T:
- ❌ Include node_modules or build directories
- ❌ Manually edit JSON tree files
- ❌ Ignore importance scores > 8
- ❌ Skip dependency recalculation after major changes

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| Find critical files | `find_important_files --minImportance=8` |
| Check file importance | `get_file_importance --filepath="..."` |
| Generate architecture | `generate_diagram --style="hybrid"` |
| Track dependencies | `recalculate_importance` |
| Add documentation | `set_file_summary --filepath="..." --summary="..."` |

## 🔄 Workflow Integration

### With Taskmaster:
```bash
# Before task work
mcp__FileScopeMCP__find_important_files --minImportance=7
# Identify files related to task

# After task completion
mcp__FileScopeMCP__set_file_summary --filepath="modified/file.ts" \
  --summary="Task #123: Implemented feature X"
```

### With Git Worktrees:
```bash
# Per-branch tree management
mcp__FileScopeMCP__create_file_tree \
  --filename="feature-branch-tree.json" \
  --baseDirectory="./worktrees/feature"
```

## 📈 Importance Score Guidelines
- **10**: Core types, utilities used everywhere
- **9**: Critical components, contexts, dashboards
- **8**: Important features, services
- **7**: Standard components
- **5-6**: Regular files
- **<5**: Low-impact, isolated files

## 🚨 Troubleshooting
- **Tree not loading**: Check filename and path
- **No importance scores**: Run `recalculate_importance`
- **Missing dependencies**: Verify language support
- **Diagram errors**: Check output path permissions

---
*Integrated with RoverMissionControl project - Last validated: 2025-01-03*
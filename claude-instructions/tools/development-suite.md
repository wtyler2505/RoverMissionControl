---
MODULE_ID: tools/development-suite
VERSION: 1.0.0
PRIORITY: MEDIUM
DEPENDS_ON: []
REFERENCES: [workflows/github-integration]
CONTEXT: [development, tools, mcp-servers]
---

# 🔧 Development Tools Suite - AI-Powered & Integrated

## Core Tools Available:
- **🤖 GitHub App (@claude)**: AI-powered code reviews, PR assistance, issue implementation
- **🚀 GitHub CLI (gh)**: Repository management, automation, workflow control
- **📅 time-server**: Timestamps, timezone conversions
- **🧠 clear-thought**: Problem-solving, decisions (see {{MODULE:agents/cognitive-tools}})
- **🔍 perplexity-ask**: Research, best practices, security
- **💾 memory**: Knowledge graph, relationships
- **🖥️ desktop-commander**: File operations, search
- **📚 context7**: Library documentation
- **🎯 taskmaster-ai**: Task management (see {{MODULE:workflows/taskmaster}})

## Tool Usage Examples

### Research & Documentation
```bash
# Research best practices
mcp__perplexity-ask__perplexity_ask --messages='[{"role": "user", "content": "JWT refresh token best practices FastAPI"}]'

# Get library documentation
mcp__context7__resolve-library-id --libraryName="fastapi"
mcp__context7__get-library-docs --context7CompatibleLibraryID="/tiangolo/fastapi" --topic="authentication"
```

### Knowledge Management
```bash
# Store implementation details
mcp__memory__create_entities --entities='[{
  "name": "WebSocketManager",
  "entityType": "Component",
  "observations": ["Implements reconnection logic", "Uses binary protocol", "Handles 1000+ connections"]
}]'

# Create relationships
mcp__memory__create_relations --relations='[{
  "from": "WebSocketManager",
  "to": "TelemetrySystem",
  "relationType": "manages"
}]'

# Search knowledge
mcp__memory__search_nodes --query="WebSocket"
```

### File Operations
```bash
# Search code
mcp__desktop-commander__search_code --path="." --pattern="WebSocket.*timeout"

# Read multiple files
mcp__desktop-commander__read_multiple_files --paths='["file1.ts", "file2.ts"]'

# Smart file editing
mcp__desktop-commander__edit_block --file_path="file.ts" --old_string="old" --new_string="new"
```

### Time Management
```bash
# Get current time in timezone
mcp__time-server__get_current_time --timezone="America/New_York"

# Convert between timezones
mcp__time-server__convert_time --source_timezone="UTC" --target_timezone="Asia/Tokyo" --time="14:30"
```

## MCP Server Instructions

### context7
Use this server to retrieve up-to-date documentation and code examples for any library.

### desktop-commander
Powerful file operations with security boundaries. Prefer this over basic file tools for complex operations.

### memory
Build a knowledge graph of the project. Store entities, relationships, and observations for later retrieval.

### perplexity-ask
Research current best practices, security guidelines, and implementation patterns.

### clear-thought
Cognitive enhancement tools for problem-solving, decision-making, and planning.

### taskmaster-ai
Complete task management system integrated with git worktrees and project tracking.

## Tool Selection Guide

| Need | Use This Tool |
|------|---------------|
| Research best practices | perplexity-ask |
| Library documentation | context7 |
| Complex file operations | desktop-commander |
| Store project knowledge | memory |
| Time/timezone operations | time-server |
| Problem solving | clear-thought |
| Task management | taskmaster-ai |
| GitHub operations | gh CLI |

## Tool Failure Recovery
If any tool fails:
1. Check tool status
2. Use alternative if available
3. Document the issue
4. Continue work with manual approach
5. Report issue for fixing

See {{MODULE:workflows/github-integration}} for GitHub-specific tools.
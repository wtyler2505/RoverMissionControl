# Ref MCP Integration Module

**MODULE_ID**: REF_MCP
**VERSION**: 1.0.0
**PRIORITY**: HIGH
**DEPENDS_ON**: core/quick-start.md
**REFERENCES**: tools/development-suite.md, debugging/problem-solving.md
**CONTEXT**: Documentation search, API research, library documentation, code examples

## 🎯 Purpose
Ref MCP provides intelligent documentation search and retrieval with minimal context usage. Essential for finding accurate, up-to-date documentation while avoiding context rot and reducing token costs.

## 🔧 Key Features
- **Smart Context Management**: Filters duplicate results, fetches only relevant sections
- **Session Tracking**: Learns from search trajectory to refine results
- **Multi-Source Search**: Public docs, GitHub repos, private documentation
- **Token Optimization**: Returns ~5K most relevant tokens from large pages

## 📊 Core Tools

### 1. Documentation Search
```bash
# Search public documentation (default)
mcp__Ref__ref_search_documentation --query="React useState hook best practices"

# Search private documentation
mcp__Ref__ref_search_documentation --query="our payment API implementation ref_src=private"

# Include language/framework for better results
mcp__Ref__ref_search_documentation --query="Python asyncio event loop patterns"
```

### 2. URL Content Reading
```bash
# Read specific documentation page
mcp__Ref__ref_read_url --url="https://reactjs.org/docs/hooks-intro.html"

# Read GitHub files directly
mcp__Ref__ref_read_url --url="https://github.com/org/repo/blob/main/README.md"

# Works with search results
# 1. Search first
mcp__Ref__ref_search_documentation --query="Next.js API routes"
# 2. Read specific result
mcp__Ref__ref_read_url --url="[url from search results]"
```

## 🎯 Integration Patterns

### Pattern 1: Library Research
```bash
# Step 1: Search for library documentation
mcp__Ref__ref_search_documentation --query="Socket.IO client connection best practices"

# Step 2: Read most relevant results
mcp__Ref__ref_read_url --url="https://socket.io/docs/v4/client-initialization/"

# Step 3: Refine search if needed
mcp__Ref__ref_search_documentation --query="Socket.IO reconnection backoff strategy"
```

### Pattern 2: API Integration
```bash
# Research API endpoints
mcp__Ref__ref_search_documentation --query="Stripe payment intent API create endpoint"

# Read detailed documentation
mcp__Ref__ref_read_url --url="https://stripe.com/docs/api/payment_intents/create"

# Find code examples
mcp__Ref__ref_search_documentation --query="Stripe payment intent Node.js example code"
```

### Pattern 3: Framework Migration
```bash
# Compare frameworks
mcp__Ref__ref_search_documentation --query="Vue 3 vs React 18 performance comparison"

# Deep dive into specific features
mcp__Ref__ref_search_documentation --query="React 18 Suspense boundary implementation"

# Migration guides
mcp__Ref__ref_search_documentation --query="migrating from Vue 2 to Vue 3 breaking changes"
```

### Pattern 4: Troubleshooting
```bash
# Error research
mcp__Ref__ref_search_documentation --query="TypeError cannot read property undefined React hooks"

# Stack-specific solutions
mcp__Ref__ref_search_documentation --query="Next.js hydration mismatch error solutions"

# Best practices
mcp__Ref__ref_search_documentation --query="React useEffect cleanup memory leak prevention"
```

## 🔍 Search Optimization Tips

### Query Construction:
```bash
# ✅ GOOD: Specific with context
"Next.js 14 app router middleware authentication implementation"

# ❌ BAD: Too generic
"authentication"

# ✅ GOOD: Include error messages
"React Hook useEffect has missing dependency warning eslint fix"

# ❌ BAD: Vague problem description
"React not working"
```

### Multi-Step Searches:
```bash
# Start broad, then narrow
1. "n8n workflow automation best practices"
2. "n8n Code node multiple inputs access"
3. "n8n $input.all() vs $input.item() difference"
```

## ⚡ Best Practices

### DO:
- ✅ Include framework/library names in queries
- ✅ Use full error messages in searches
- ✅ Read search results before refining
- ✅ Search private docs with `ref_src=private`
- ✅ Chain searches to drill down into topics

### DON'T:
- ❌ Use single-word queries
- ❌ Skip reading URLs from search results
- ❌ Repeat identical searches (filtered automatically)
- ❌ Ignore search trajectory optimization

## 🎯 Common Use Cases

| Task | Query Example |
|------|--------------|
| API Documentation | `"OpenAI GPT-4 API function calling parameters"` |
| Error Resolution | `"TypeError: Cannot read properties of null reading 'useState'"` |
| Implementation Guide | `"implement JWT refresh token rotation Node.js Express"` |
| Migration Help | `"migrate webpack 4 to webpack 5 breaking changes"` |
| Performance Tips | `"React memo vs useMemo performance optimization"` |
| Security Best Practices | `"OWASP Node.js security headers implementation"` |

## 🔄 Workflow Integration

### With FileScopeMCP:
```bash
# 1. Identify important files
mcp__FileScopeMCP__find_important_files --minImportance=8

# 2. Research unfamiliar patterns
mcp__Ref__ref_search_documentation --query="React Context Provider pattern best practices"

# 3. Apply learnings to codebase
```

### With Specialized Agents:
```bash
# Research before implementation
mcp__Ref__ref_search_documentation --query="WebSocket reconnection exponential backoff"

# Launch agent with context
Task --subagent_type="realtime-telemetry-engineer" \
  --prompt="Implement WebSocket reconnection with exponential backoff"
```

### With Debugging:
```bash
# 1. Encounter error
# 2. Search for solutions
mcp__Ref__ref_search_documentation --query="[exact error message]"

# 3. Read detailed fixes
mcp__Ref__ref_read_url --url="[solution URL]"

# 4. Apply fix to codebase
```

## 📈 Token Usage Optimization

### Typical Token Costs:
- Simple query: ~50-400 tokens
- Complex research: ~500-2000 tokens
- Without Ref (raw fetch): ~5000-20000 tokens
- **Savings: 70-90% token reduction**

### Session Optimization:
```bash
# First search: 126 tokens (full results)
"n8n merge node vs Code node best practices"

# Second search: 80 tokens (filtered duplicates)
"n8n Code node usage patterns"

# Third search: 50 tokens (refined trajectory)
"n8n Code node $input access"
```

## 🚨 Advanced Features

### Private Documentation:
```bash
# Search your uploaded docs/repos
mcp__Ref__ref_search_documentation \
  --query="our payment processing implementation ref_src=private"
```

### GitHub Code Search:
```bash
# Find code examples
mcp__Ref__ref_search_documentation \
  --query="github.com React TypeScript component examples"
```

### Multi-Language Support:
```bash
# Search in specific contexts
mcp__Ref__ref_search_documentation \
  --query="Python pandas DataFrame groupby 中文文档"
```

## 🎯 Quick Reference Patterns

```bash
# Framework docs:     "[Framework] [Feature] [Version] documentation"
# Error lookup:       "[Exact error message] [Framework] solution"
# Implementation:     "how to implement [Feature] in [Framework]"
# Best practices:     "[Technology] best practices [Specific area]"
# Comparison:         "[Option A] vs [Option B] when to use"
# Migration:          "migrate from [Old] to [New] guide"
# Performance:        "[Framework] performance optimization [Feature]"
# Security:           "[Technology] security [Vulnerability type]"
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| No results | Try broader query, check spelling |
| Too many results | Add framework/version specifics |
| Outdated info | Include version number in query |
| Wrong context | Specify language/framework clearly |
| Private docs not found | Add `ref_src=private` to query |

---
*Integrated with RoverMissionControl project - Last validated: 2025-01-03*
# Cognitive Enhancement Tools - Detailed Guide

## Overview: Systematic Thinking Tools for Complex Challenges

The clear-thought MCP server provides cognitive tools that enhance problem-solving capabilities. These tools should be invoked automatically when facing specific types of challenges.

## 🔍 Automatic Invocation Triggers

### When to Use Each Tool:

**debuggingapproach** - Systematic Issue Resolution
- **TRIGGER**: Any error, bug, or unexpected behavior
- **USAGE**: `mcp__clear-thought__debuggingapproach --approachName='[approach]' --issue='[description]'`
- **APPROACHES**: binary_search, reverse_engineering, divide_conquer, backtracking, cause_elimination, program_slicing

**sequentialthinking** - Complex Problem Breakdown
- **TRIGGER**: Tasks requiring 3+ steps or when feeling overwhelmed
- **USAGE**: `mcp__clear-thought__sequentialthinking --thought='[current thinking]' --thoughtNumber=1 --totalThoughts=[estimate]`
- **BENEFITS**: Maintains context, allows revision, prevents missed steps

**decisionframework** - Technical Choice Analysis
- **TRIGGER**: Choosing between multiple technical solutions
- **USAGE**: `mcp__clear-thought__decisionframework --decisionStatement='[choice to make]' --analysisType='multi-criteria'`
- **TYPES**: expected-utility, multi-criteria, maximin, minimax-regret, satisficing

**metacognitivemonitoring** - Confidence & Knowledge Tracking
- **TRIGGER**: When confidence < 70% or encountering unfamiliar territory
- **USAGE**: `mcp__clear-thought__metacognitivemonitoring --task='[current task]' --stage='[stage]'`
- **MONITORS**: Knowledge boundaries, claim certainty, reasoning biases

**visualreasoning** - System Relationship Mapping
- **TRIGGER**: Understanding complex architectures or data flows
- **USAGE**: `mcp__clear-thought__visualreasoning --operation='create' --diagramType='[type]'`
- **TYPES**: graph, flowchart, stateDiagram, conceptMap, treeDiagram

**mentalmodel** - Pattern Application
- **TRIGGER**: Recognizing familiar problem patterns
- **USAGE**: `mcp__clear-thought__mentalmodel --modelName='[model]' --problem='[description]'`
- **MODELS**: first_principles, opportunity_cost, pareto_principle, occams_razor

**collaborativereasoning** - Multi-Perspective Analysis
- **TRIGGER**: Complex features requiring diverse expertise
- **USAGE**: `mcp__clear-thought__collaborativereasoning --topic='[feature/problem]'`
- **CREATES**: Virtual expert personas with different viewpoints

**scientificmethod** - Hypothesis Testing
- **TRIGGER**: Validating assumptions or testing solutions
- **USAGE**: `mcp__clear-thought__scientificmethod --stage='hypothesis' --question='[what to test]'`
- **PROCESS**: Observation → Question → Hypothesis → Experiment → Analysis

**structuredargumentation** - Conflict Resolution
- **TRIGGER**: Competing requirements or conflicting approaches
- **USAGE**: `mcp__clear-thought__structuredargumentation --claim='[position]' --argumentType='thesis'`
- **BUILDS**: Thesis → Antithesis → Synthesis

## 📌 Integration Examples

### Example 1: WebSocket Connection Dropping
```bash
# Automatic trigger when error detected
mcp__clear-thought__debuggingapproach \
  --approachName='cause_elimination' \
  --issue='WebSocket connections dropping after 5 minutes'

# If complex, break down with sequential thinking
mcp__clear-thought__sequentialthinking \
  --thought='Need to identify all possible timeout sources' \
  --thoughtNumber=1 \
  --totalThoughts=5
```

### Example 2: Choosing Database for Telemetry
```bash
# Automatic trigger for technical decision
mcp__clear-thought__decisionframework \
  --decisionStatement='Choose telemetry storage: TimescaleDB vs InfluxDB vs MongoDB' \
  --analysisType='multi-criteria' \
  --stage='criteria'

# Define criteria and evaluate
mcp__clear-thought__decisionframework \
  --decisionId='[previous-id]' \
  --stage='evaluation' \
  --criteria='[{"name": "Write Performance", "weight": 0.3}, {"name": "Query Speed", "weight": 0.3}]'
```

### Example 3: Low Confidence in Implementation
```bash
# Automatic trigger when uncertainty detected
mcp__clear-thought__metacognitivemonitoring \
  --task='Implementing WebRTC for video streaming' \
  --stage='knowledge-assessment' \
  --overallConfidence=0.4

# Tool will identify knowledge gaps and suggest approach
```

## 🎯 Success Metrics

Track cognitive tool effectiveness:
- **Problem Resolution Time**: Target 50% reduction
- **Decision Quality**: Fewer reverted decisions
- **Implementation Confidence**: Average > 80%
- **First-Try Success Rate**: Target > 70%

## 🔄 Workflow Integration

These tools integrate seamlessly with existing workflows:
1. **Error occurs** → debuggingapproach automatically invoked
2. **Complex task** → sequentialthinking breaks it down
3. **Technical choice** → decisionframework evaluates options
4. **Low confidence** → metacognitivemonitoring identifies gaps
5. **Results tracked** → Improvements measured

## 🧠 Intelligent Decision Making Examples

### Multi-Agent Coordination with Reasoning

For complex features requiring multiple agents:
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

### Handling Task Conflicts with Argumentation

When tasks have conflicting priorities or requirements:
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

Remember: These tools are force multipliers, not replacements for good judgment. Use them to enhance, not replace, your natural problem-solving abilities.
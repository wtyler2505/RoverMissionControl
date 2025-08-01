# Chromatic Visual Testing Setup

This document outlines the Chromatic integration for automated visual regression testing and Storybook deployment.

## Overview

Chromatic is integrated into our CI/CD pipeline to:
- **Detect visual changes** in UI components automatically
- **Publish Storybook** for team collaboration and review
- **Prevent visual regressions** from being merged
- **Maintain visual consistency** across themes and breakpoints

## Setup Instructions

### 1. Chromatic Project Setup

1. **Create Chromatic Account**
   - Visit [chromatic.com](https://www.chromatic.com)
   - Sign up with your GitHub account
   - Create a new project for RoverMissionControl

2. **Get Project Token**
   - Navigate to your project settings
   - Copy the project token (starts with `chpt_`)
   - Add it to GitHub repository secrets as `CHROMATIC_PROJECT_TOKEN`

### 2. GitHub Repository Configuration

Add the following secret to your GitHub repository:
- **Secret Name**: `CHROMATIC_PROJECT_TOKEN`
- **Secret Value**: Your Chromatic project token

**To add secrets:**
1. Go to Repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add the token with the exact name above

### 3. Local Development Usage

#### Install Dependencies
```bash
npm install  # Chromatic is already included in devDependencies
```

#### Run Visual Tests Locally
```bash
# Run Chromatic with current changes
npm run chromatic

# Run CI-optimized Chromatic build
npm run chromatic:ci
```

#### Build and Preview Storybook
```bash
# Build Storybook locally
npm run build-storybook

# Serve built Storybook
npx serve storybook-static -p 6006
```

## Workflow Integration

### Automatic Triggers

Chromatic runs automatically on:
- **Push to main/develop**: Full visual regression testing
- **Pull Requests**: Visual diff generation for review
- **Scheduled builds**: Daily visual consistency checks

### Manual Triggers

Skip Chromatic builds by including in commit message:
- `[skip chromatic]` - Skip only Chromatic
- `[skip ci]` - Skip entire CI pipeline

### Approval Process

1. **Changes Detected**: Chromatic identifies visual differences
2. **Review Required**: PR is blocked until changes are reviewed
3. **Approve/Deny**: Team lead approves or requests changes
4. **Auto-merge**: Approved changes allow PR to proceed

## Configuration

### chromatic.config.json Options

```json
{
  "exitZeroOnChanges": true,        // Don't fail CI on visual changes
  "autoAcceptChanges": false,       // Require manual approval
  "onlyChanged": true,              // Test only changed components
  "fileHashing": true,              // Enable caching optimization
  "skip": "dependabot/**"           // Skip dependabot PRs
}
```

### GitHub Workflow Features

- **Parallel builds** for faster CI execution
- **Smart caching** with Node.js and npm caching
- **Conditional execution** based on commit messages
- **PR commenting** with Chromatic build links
- **Artifact upload** for failed builds

## Visual Testing Strategy

### Component Coverage

All stories are automatically tested across:
- **4 Professional Themes**: Dark, Light, High Contrast, Mission Critical
- **Multiple Viewports**: Desktop, tablet, mobile
- **Interactive States**: Default, hover, focus, active, disabled

### Test Matrix

| Component Type | Themes Tested | Viewports | States |
|---------------|---------------|-----------|---------|
| Form Controls | All 4 | 3 | 5 |
| Navigation | All 4 | 3 | 3 |
| Data Display | All 4 | 3 | 2 |
| Feedback | All 4 | 2 | 4 |

### Baseline Management

- **Main branch** serves as the visual baseline
- **Feature branches** are compared against main
- **Auto-acceptance** can be enabled for main branch updates
- **Manual approval** required for all PR changes

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check Storybook builds locally first
   npm run build-storybook
   
   # Verify design tokens are built
   cd packages/design-tokens && npm run build
   ```

2. **Authentication Errors**
   - Verify `CHROMATIC_PROJECT_TOKEN` is set correctly
   - Ensure token has proper permissions
   - Check token hasn't expired

3. **Visual Diff Noise**
   - Use `untraced` configuration to ignore non-visual files
   - Configure `ignoreLastBuildOnBranch` for branch-specific baselines
   - Enable `fileHashing` for consistent builds

4. **Performance Optimization**
   - Enable `onlyChanged` to test only modified components
   - Use `zip: true` for faster uploads
   - Configure `externals` to exclude non-essential files

### Debug Mode

Enable debug logging by setting in chromatic.config.json:
```json
{
  "debug": true,
  "diagnostics": true,
  "logFile": "chromatic.log"
}
```

### Support Resources

- **Chromatic Documentation**: [chromatic.com/docs](https://www.chromatic.com/docs)
- **GitHub Integration**: [chromatic.com/docs/github-actions](https://www.chromatic.com/docs/github-actions)
- **Storybook Best Practices**: [storybook.js.org/docs](https://storybook.js.org/docs)

## Performance Metrics

### Expected Build Times

- **Initial Build**: 3-5 minutes (full component suite)
- **Incremental Builds**: 1-2 minutes (changed components only)
- **Baseline Updates**: 30-60 seconds

### Storage Optimization

- **Snapshot Retention**: 90 days
- **Build Artifact Compression**: Enabled
- **Incremental Uploads**: Only changed files

## Team Workflow

### For Developers

1. Create feature branch from main
2. Make UI component changes
3. Commit and push changes
4. Review Chromatic build in PR
5. Request visual approval if needed
6. Merge after approval

### For Reviewers

1. Review code changes in PR
2. Check Chromatic build link in PR comments
3. Approve or request changes for visual diffs
4. Ensure visual consistency across themes
5. Approve PR for merge

### For Maintainers

1. Monitor Chromatic dashboard for trends
2. Update visual baselines as needed  
3. Configure new component test scenarios
4. Maintain GitHub secrets and permissions
5. Optimize build performance settings
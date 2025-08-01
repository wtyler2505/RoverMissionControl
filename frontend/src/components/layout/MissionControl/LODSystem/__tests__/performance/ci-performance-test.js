/**
 * CI/CD Performance Test Script
 * 
 * Node.js script for running performance tests in CI/CD pipelines.
 * Supports GitHub Actions, GitLab CI, Jenkins, etc.
 */

const { AutomatedBenchmarkRunner, defaultBenchmarks } = require('./automatedBenchmarks');
const { execSync } = require('child_process');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');

// Configuration from environment variables
const config = {
  baseUrl: process.env.PERF_TEST_URL || 'http://localhost:3000',
  outputDir: process.env.PERF_OUTPUT_DIR || './performance-results',
  historyFile: process.env.PERF_HISTORY_FILE || './benchmark-history.json',
  screenshotDir: process.env.PERF_SCREENSHOT_DIR || './performance-screenshots',
  failOnRegression: process.env.PERF_FAIL_ON_REGRESSION === 'true',
  regressionThreshold: parseFloat(process.env.PERF_REGRESSION_THRESHOLD || '0.1'),
  slackWebhook: process.env.PERF_SLACK_WEBHOOK,
  githubToken: process.env.GITHUB_TOKEN,
  gitlabToken: process.env.GITLAB_TOKEN
};

// Ensure directories exist
[config.outputDir, config.screenshotDir].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

/**
 * Start the application server
 */
async function startServer() {
  console.log('Starting application server...');
  
  try {
    // Check if server is already running
    const response = await fetch(config.baseUrl);
    if (response.ok) {
      console.log('Server already running');
      return null;
    }
  } catch (e) {
    // Server not running, start it
  }
  
  // Start server in background
  const serverProcess = require('child_process').spawn('npm', ['start'], {
    detached: true,
    stdio: 'ignore',
    cwd: join(__dirname, '../../../../../..')
  });
  
  // Wait for server to be ready
  console.log('Waiting for server to be ready...');
  let retries = 30;
  while (retries > 0) {
    try {
      const response = await fetch(config.baseUrl);
      if (response.ok) {
        console.log('Server is ready');
        return serverProcess;
      }
    } catch (e) {
      // Server not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    retries--;
  }
  
  throw new Error('Server failed to start');
}

/**
 * Run performance benchmarks
 */
async function runBenchmarks() {
  console.log('Running performance benchmarks...');
  
  // Update benchmark URLs with config
  const benchmarks = defaultBenchmarks.map(b => ({
    ...b,
    url: b.url.replace('http://localhost:3000', config.baseUrl)
  }));
  
  const runner = new AutomatedBenchmarkRunner(
    benchmarks,
    config.historyFile,
    config.screenshotDir
  );
  
  try {
    await runner.initialize();
    const results = await runner.runAll();
    const report = runner.generateReport(results);
    
    // Save report
    const reportPath = join(config.outputDir, `performance-report-${Date.now()}.md`);
    writeFileSync(reportPath, report);
    console.log(`Report saved to: ${reportPath}`);
    
    // Save JSON results
    const jsonPath = join(config.outputDir, `performance-results-${Date.now()}.json`);
    writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    
    // Check for failures
    const failures = results.filter(r => !r.passed);
    const regressions = results.flatMap(r => runner.detectRegressions(r, config.regressionThreshold));
    
    // Send notifications
    if (failures.length > 0 || regressions.length > 0) {
      await sendNotifications(failures, regressions, report);
    }
    
    // Generate artifacts for CI
    generateCIArtifacts(results);
    
    return {
      success: failures.length === 0 && (!config.failOnRegression || regressions.length === 0),
      failures,
      regressions,
      report
    };
  } finally {
    await runner.cleanup();
  }
}

/**
 * Send notifications for failures and regressions
 */
async function sendNotifications(failures, regressions, report) {
  // Slack notification
  if (config.slackWebhook) {
    const message = {
      text: '🚨 Performance Test Alert',
      attachments: [
        {
          color: 'danger',
          title: 'Performance Issues Detected',
          fields: [
            {
              title: 'Failed Benchmarks',
              value: failures.length > 0 ? failures.map(f => f.name).join(', ') : 'None',
              short: true
            },
            {
              title: 'Regressions',
              value: regressions.length > 0 ? regressions.join('\n') : 'None',
              short: false
            }
          ],
          footer: 'CI Performance Tests',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
    
    try {
      await fetch(config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    } catch (e) {
      console.error('Failed to send Slack notification:', e);
    }
  }
  
  // GitHub PR comment
  if (config.githubToken && process.env.GITHUB_EVENT_NAME === 'pull_request') {
    try {
      const event = JSON.parse(
        require('fs').readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')
      );
      
      const comment = `## 📊 Performance Test Results\n\n${report}`;
      
      await fetch(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues/${event.pull_request.number}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.githubToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ body: comment })
        }
      );
    } catch (e) {
      console.error('Failed to post GitHub comment:', e);
    }
  }
}

/**
 * Generate CI artifacts
 */
function generateCIArtifacts(results) {
  // JUnit XML format for CI systems
  const junit = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Performance Tests" tests="${results.length}" failures="${results.filter(r => !r.passed).length}">
  ${results.map(result => `
  <testsuite name="${result.name}" tests="1" failures="${result.passed ? 0 : 1}" time="${result.duration / 1000}">
    <testcase name="${result.name}" time="${result.duration / 1000}">
      ${result.passed ? '' : `
      <failure message="Performance requirements not met">
        ${result.failures.join('\n')}
      </failure>`}
    </testcase>
  </testsuite>`).join('')}
</testsuites>`;
  
  writeFileSync(join(config.outputDir, 'performance-junit.xml'), junit);
  
  // GitHub Actions annotations
  if (process.env.GITHUB_ACTIONS) {
    results.forEach(result => {
      if (!result.passed) {
        console.log(`::error title=Performance Test Failed::${result.name} - ${result.failures.join(', ')}`);
      }
    });
    
    // Set output variables
    console.log(`::set-output name=passed::${results.every(r => r.passed)}`);
    console.log(`::set-output name=report_path::${join(config.outputDir, 'performance-report-*.md')}`);
  }
  
  // GitLab CI artifacts
  if (process.env.GITLAB_CI) {
    const gitlabReport = {
      performance: results.map(r => ({
        name: r.name,
        unit: 'fps',
        value: r.metrics.fps?.average || 0
      }))
    };
    
    writeFileSync(join(config.outputDir, 'performance.json'), JSON.stringify(gitlabReport));
  }
}

/**
 * Main execution
 */
async function main() {
  let serverProcess = null;
  let exitCode = 0;
  
  try {
    // Start server if needed
    serverProcess = await startServer();
    
    // Run benchmarks
    const result = await runBenchmarks();
    
    if (!result.success) {
      console.error('\n❌ Performance tests failed!');
      console.error(`Failures: ${result.failures.length}`);
      console.error(`Regressions: ${result.regressions.length}`);
      exitCode = 1;
    } else {
      console.log('\n✅ All performance tests passed!');
    }
    
  } catch (error) {
    console.error('Error running performance tests:', error);
    exitCode = 1;
  } finally {
    // Cleanup
    if (serverProcess) {
      console.log('Stopping server...');
      try {
        process.kill(-serverProcess.pid);
      } catch (e) {
        // Server may have already stopped
      }
    }
  }
  
  process.exit(exitCode);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runBenchmarks, startServer };
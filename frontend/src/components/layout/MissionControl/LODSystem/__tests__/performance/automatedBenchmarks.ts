/**
 * Automated Performance Benchmarks
 * 
 * Automated benchmark suite for CI/CD integration and regression detection.
 * Generates performance reports and detects regressions.
 */

import * as puppeteer from 'puppeteer';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Benchmark configuration
export interface BenchmarkConfig {
  name: string;
  description: string;
  url: string;
  duration: number; // milliseconds
  actions: BenchmarkAction[];
  metrics: MetricRequirement[];
  viewport?: { width: number; height: number };
}

// Action to perform during benchmark
export interface BenchmarkAction {
  type: 'click' | 'hover' | 'drag' | 'keypress' | 'wait' | 'evaluate';
  target?: string; // CSS selector
  value?: any;
  duration?: number;
}

// Metric requirement
export interface MetricRequirement {
  name: string;
  type: 'fps' | 'memory' | 'cpu' | 'network' | 'custom';
  threshold: {
    min?: number;
    max?: number;
    percentile95?: number;
  };
}

// Benchmark result
export interface BenchmarkResult {
  name: string;
  timestamp: number;
  duration: number;
  passed: boolean;
  metrics: {
    [key: string]: {
      average: number;
      min: number;
      max: number;
      percentile95: number;
      samples: number;
    };
  };
  failures: string[];
  screenshots?: string[];
}

// Historical benchmark data for regression detection
export interface BenchmarkHistory {
  benchmarks: {
    [name: string]: BenchmarkResult[];
  };
}

/**
 * Automated benchmark runner
 */
export class AutomatedBenchmarkRunner {
  private browser: puppeteer.Browser | null = null;
  private config: BenchmarkConfig[];
  private historyPath: string;
  private screenshotDir: string;
  
  constructor(
    config: BenchmarkConfig[],
    historyPath: string = './benchmark-history.json',
    screenshotDir: string = './benchmark-screenshots'
  ) {
    this.config = config;
    this.historyPath = historyPath;
    this.screenshotDir = screenshotDir;
  }
  
  /**
   * Initialize browser
   */
  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
  
  /**
   * Run all benchmarks
   */
  async runAll(): Promise<BenchmarkResult[]> {
    if (!this.browser) {
      await this.initialize();
    }
    
    const results: BenchmarkResult[] = [];
    
    for (const benchmark of this.config) {
      console.log(`Running benchmark: ${benchmark.name}`);
      const result = await this.runBenchmark(benchmark);
      results.push(result);
      
      // Save result to history
      this.saveToHistory(result);
    }
    
    return results;
  }
  
  /**
   * Run a single benchmark
   */
  async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const page = await this.browser!.newPage();
    
    // Set viewport
    if (config.viewport) {
      await page.setViewport(config.viewport);
    }
    
    // Enable performance metrics
    await page.evaluateOnNewDocument(() => {
      // Inject performance monitoring
      (window as any).__performanceMetrics = {
        fps: [],
        memory: [],
        timestamps: []
      };
      
      let lastTime = performance.now();
      const measurePerformance = () => {
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        // Calculate FPS
        const fps = 1000 / deltaTime;
        
        // Get memory info if available
        const memory = (performance as any).memory 
          ? (performance as any).memory.usedJSHeapSize / 1048576 
          : 0;
        
        (window as any).__performanceMetrics.fps.push(fps);
        (window as any).__performanceMetrics.memory.push(memory);
        (window as any).__performanceMetrics.timestamps.push(currentTime);
        
        requestAnimationFrame(measurePerformance);
      };
      
      requestAnimationFrame(measurePerformance);
    });
    
    // Navigate to page
    await page.goto(config.url, { waitUntil: 'networkidle0' });
    
    // Wait for 3D scene to load
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(2000); // Additional wait for scene initialization
    
    // Start recording metrics
    const startTime = Date.now();
    const metrics: { [key: string]: number[] } = {
      fps: [],
      memory: [],
      cpu: []
    };
    
    // Execute actions
    for (const action of config.actions) {
      await this.executeAction(page, action);
    }
    
    // Collect metrics during benchmark
    const metricsInterval = setInterval(async () => {
      const perfMetrics = await page.evaluate(() => {
        return (window as any).__performanceMetrics;
      });
      
      if (perfMetrics.fps.length > 0) {
        metrics.fps.push(...perfMetrics.fps.splice(0));
        metrics.memory.push(...perfMetrics.memory.splice(0));
      }
      
      // Get CPU metrics
      const cpuMetrics = await page.metrics();
      metrics.cpu.push(cpuMetrics.TaskDuration || 0);
    }, 100);
    
    // Wait for benchmark duration
    await page.waitForTimeout(config.duration);
    
    // Stop collecting metrics
    clearInterval(metricsInterval);
    
    // Take screenshot
    const screenshotPath = join(
      this.screenshotDir, 
      `${config.name}-${Date.now()}.png`
    );
    await page.screenshot({ path: screenshotPath });
    
    // Process results
    const result = this.processMetrics(
      config,
      metrics,
      Date.now() - startTime,
      [screenshotPath]
    );
    
    await page.close();
    
    return result;
  }
  
  /**
   * Execute a benchmark action
   */
  private async executeAction(
    page: puppeteer.Page,
    action: BenchmarkAction
  ): Promise<void> {
    switch (action.type) {
      case 'click':
        if (action.target) {
          await page.click(action.target);
        }
        break;
        
      case 'hover':
        if (action.target) {
          await page.hover(action.target);
        }
        break;
        
      case 'drag':
        if (action.target && action.value) {
          const element = await page.$(action.target);
          if (element) {
            const box = await element.boundingBox();
            if (box) {
              await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
              await page.mouse.down();
              await page.mouse.move(
                box.x + box.width / 2 + action.value.x,
                box.y + box.height / 2 + action.value.y
              );
              await page.mouse.up();
            }
          }
        }
        break;
        
      case 'keypress':
        if (action.value) {
          await page.keyboard.press(action.value);
        }
        break;
        
      case 'wait':
        await page.waitForTimeout(action.duration || 1000);
        break;
        
      case 'evaluate':
        if (action.value) {
          await page.evaluate(action.value);
        }
        break;
    }
  }
  
  /**
   * Process collected metrics
   */
  private processMetrics(
    config: BenchmarkConfig,
    metrics: { [key: string]: number[] },
    duration: number,
    screenshots: string[]
  ): BenchmarkResult {
    const processedMetrics: BenchmarkResult['metrics'] = {};
    const failures: string[] = [];
    
    // Process each metric type
    for (const [name, values] of Object.entries(metrics)) {
      if (values.length === 0) continue;
      
      const sorted = [...values].sort((a, b) => a - b);
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      const percentile95Index = Math.floor(values.length * 0.95);
      
      processedMetrics[name] = {
        average,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        percentile95: sorted[percentile95Index],
        samples: values.length
      };
    }
    
    // Check requirements
    let passed = true;
    for (const requirement of config.metrics) {
      const metric = processedMetrics[requirement.type];
      if (!metric) continue;
      
      if (requirement.threshold.min && metric.average < requirement.threshold.min) {
        failures.push(
          `${requirement.name}: average ${metric.average.toFixed(2)} below minimum ${requirement.threshold.min}`
        );
        passed = false;
      }
      
      if (requirement.threshold.max && metric.average > requirement.threshold.max) {
        failures.push(
          `${requirement.name}: average ${metric.average.toFixed(2)} above maximum ${requirement.threshold.max}`
        );
        passed = false;
      }
      
      if (requirement.threshold.percentile95 && metric.percentile95 > requirement.threshold.percentile95) {
        failures.push(
          `${requirement.name}: 95th percentile ${metric.percentile95.toFixed(2)} above threshold ${requirement.threshold.percentile95}`
        );
        passed = false;
      }
    }
    
    return {
      name: config.name,
      timestamp: Date.now(),
      duration,
      passed,
      metrics: processedMetrics,
      failures,
      screenshots
    };
  }
  
  /**
   * Save result to history
   */
  private saveToHistory(result: BenchmarkResult): void {
    let history: BenchmarkHistory = { benchmarks: {} };
    
    if (existsSync(this.historyPath)) {
      const data = readFileSync(this.historyPath, 'utf-8');
      history = JSON.parse(data);
    }
    
    if (!history.benchmarks[result.name]) {
      history.benchmarks[result.name] = [];
    }
    
    history.benchmarks[result.name].push(result);
    
    // Keep only last 100 results per benchmark
    if (history.benchmarks[result.name].length > 100) {
      history.benchmarks[result.name] = history.benchmarks[result.name].slice(-100);
    }
    
    writeFileSync(this.historyPath, JSON.stringify(history, null, 2));
  }
  
  /**
   * Detect performance regressions
   */
  detectRegressions(
    current: BenchmarkResult,
    threshold: number = 0.1 // 10% regression threshold
  ): string[] {
    const regressions: string[] = [];
    
    if (!existsSync(this.historyPath)) {
      return regressions;
    }
    
    const data = readFileSync(this.historyPath, 'utf-8');
    const history: BenchmarkHistory = JSON.parse(data);
    const previousResults = history.benchmarks[current.name] || [];
    
    if (previousResults.length < 5) {
      return regressions; // Not enough history
    }
    
    // Get average of last 5 results
    const recentResults = previousResults.slice(-6, -1); // Exclude current
    
    for (const [metricName, currentMetric] of Object.entries(current.metrics)) {
      const historicalValues = recentResults.map(r => r.metrics[metricName]?.average || 0);
      const historicalAverage = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
      
      if (metricName === 'fps') {
        // For FPS, lower is worse
        const degradation = (historicalAverage - currentMetric.average) / historicalAverage;
        if (degradation > threshold) {
          regressions.push(
            `FPS regressed by ${(degradation * 100).toFixed(1)}% (${historicalAverage.toFixed(1)} → ${currentMetric.average.toFixed(1)})`
          );
        }
      } else {
        // For other metrics, higher is worse
        const degradation = (currentMetric.average - historicalAverage) / historicalAverage;
        if (degradation > threshold) {
          regressions.push(
            `${metricName} regressed by ${(degradation * 100).toFixed(1)}% (${historicalAverage.toFixed(1)} → ${currentMetric.average.toFixed(1)})`
          );
        }
      }
    }
    
    return regressions;
  }
  
  /**
   * Generate benchmark report
   */
  generateReport(results: BenchmarkResult[]): string {
    let report = '# Automated Performance Benchmark Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    // Summary
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    
    report += '## Summary\n\n';
    report += `- Total benchmarks: ${results.length}\n`;
    report += `- Passed: ${passed}\n`;
    report += `- Failed: ${failed}\n\n`;
    
    // Detailed results
    report += '## Detailed Results\n\n';
    
    for (const result of results) {
      report += `### ${result.name}\n\n`;
      report += `- Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `- Duration: ${(result.duration / 1000).toFixed(2)}s\n\n`;
      
      // Metrics
      report += '#### Metrics\n\n';
      report += '| Metric | Average | Min | Max | 95th % | Samples |\n';
      report += '|--------|---------|-----|-----|--------|----------|\n';
      
      for (const [name, metric] of Object.entries(result.metrics)) {
        report += `| ${name} | ${metric.average.toFixed(2)} | ${metric.min.toFixed(2)} | ${metric.max.toFixed(2)} | ${metric.percentile95.toFixed(2)} | ${metric.samples} |\n`;
      }
      
      report += '\n';
      
      // Failures
      if (result.failures.length > 0) {
        report += '#### Failures\n\n';
        for (const failure of result.failures) {
          report += `- ${failure}\n`;
        }
        report += '\n';
      }
      
      // Regression detection
      const regressions = this.detectRegressions(result);
      if (regressions.length > 0) {
        report += '#### Performance Regressions\n\n';
        for (const regression of regressions) {
          report += `- ⚠️ ${regression}\n`;
        }
        report += '\n';
      }
    }
    
    return report;
  }
  
  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

/**
 * Default benchmark configurations
 */
export const defaultBenchmarks: BenchmarkConfig[] = [
  {
    name: 'Initial Load Performance',
    description: 'Measures initial load time and rendering performance',
    url: 'http://localhost:3000/mission-control',
    duration: 10000,
    viewport: { width: 1920, height: 1080 },
    actions: [
      { type: 'wait', duration: 3000 } // Wait for initial load
    ],
    metrics: [
      { name: 'FPS', type: 'fps', threshold: { min: 30, percentile95: 25 } },
      { name: 'Memory', type: 'memory', threshold: { max: 500 } }
    ]
  },
  {
    name: 'Camera Movement Stress',
    description: 'Tests performance during rapid camera movements',
    url: 'http://localhost:3000/mission-control',
    duration: 15000,
    viewport: { width: 1920, height: 1080 },
    actions: [
      { type: 'wait', duration: 2000 },
      { type: 'keypress', value: 'w', duration: 1000 },
      { type: 'keypress', value: 's', duration: 1000 },
      { type: 'keypress', value: 'a', duration: 1000 },
      { type: 'keypress', value: 'd', duration: 1000 },
      { type: 'drag', target: 'canvas', value: { x: 200, y: 0 } },
      { type: 'drag', target: 'canvas', value: { x: -200, y: 0 } },
      { type: 'drag', target: 'canvas', value: { x: 0, y: 200 } },
      { type: 'drag', target: 'canvas', value: { x: 0, y: -200 } }
    ],
    metrics: [
      { name: 'FPS', type: 'fps', threshold: { min: 30, percentile95: 25 } },
      { name: 'Frame Time', type: 'cpu', threshold: { max: 33.33 } }
    ]
  },
  {
    name: 'LOD System Performance',
    description: 'Tests LOD switching and quality adjustments',
    url: 'http://localhost:3000/mission-control?lod=true',
    duration: 20000,
    viewport: { width: 1920, height: 1080 },
    actions: [
      { type: 'wait', duration: 2000 },
      { type: 'click', target: '[data-testid="quality-low"]' },
      { type: 'wait', duration: 2000 },
      { type: 'click', target: '[data-testid="quality-medium"]' },
      { type: 'wait', duration: 2000 },
      { type: 'click', target: '[data-testid="quality-high"]' },
      { type: 'wait', duration: 2000 },
      { type: 'click', target: '[data-testid="quality-ultra"]' },
      { type: 'wait', duration: 2000 },
      { type: 'click', target: '[data-testid="adaptive-mode"]' }
    ],
    metrics: [
      { name: 'FPS', type: 'fps', threshold: { min: 30 } },
      { name: 'Memory', type: 'memory', threshold: { max: 600 } }
    ]
  },
  {
    name: 'Physics Simulation Load',
    description: 'Tests physics engine under heavy load',
    url: 'http://localhost:3000/mission-control?physics=true',
    duration: 15000,
    viewport: { width: 1920, height: 1080 },
    actions: [
      { type: 'wait', duration: 2000 },
      { type: 'click', target: '[data-testid="spawn-entities"]' },
      { type: 'wait', duration: 5000 },
      { type: 'click', target: '[data-testid="enable-collisions"]' },
      { type: 'wait', duration: 5000 }
    ],
    metrics: [
      { name: 'FPS', type: 'fps', threshold: { min: 24 } },
      { name: 'CPU', type: 'cpu', threshold: { max: 50 } }
    ]
  },
  {
    name: 'Memory Leak Detection',
    description: 'Long-running test to detect memory leaks',
    url: 'http://localhost:3000/mission-control',
    duration: 60000, // 1 minute
    viewport: { width: 1920, height: 1080 },
    actions: [
      { type: 'wait', duration: 2000 },
      // Repeated actions to trigger potential leaks
      ...Array(10).fill(null).flatMap((_, i) => [
        { type: 'click', target: '[data-testid="add-entity"]' },
        { type: 'wait', duration: 1000 },
        { type: 'click', target: '[data-testid="remove-entity"]' },
        { type: 'wait', duration: 1000 },
        { type: 'drag', target: 'canvas', value: { x: 100, y: 100 } },
        { type: 'wait', duration: 1000 }
      ])
    ],
    metrics: [
      { name: 'Memory', type: 'memory', threshold: { max: 800 } }
    ]
  }
];
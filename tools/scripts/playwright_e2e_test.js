const { chromium } = require('playwright');

async function runE2ETests() {
  console.log('🚀 Starting RoverMissionControl E2E Tests with Playwright');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 // Slow down for visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Console Error:', msg.text());
    }
  });
  
  const testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  async function test(name, fn) {
    console.log(`\n📋 Testing: ${name}`);
    try {
      await fn();
      console.log(`✅ PASSED: ${name}`);
      testResults.passed++;
      testResults.tests.push({ name, status: 'passed' });
    } catch (error) {
      console.error(`❌ FAILED: ${name}`);
      console.error(`   Error: ${error.message}`);
      testResults.failed++;
      testResults.tests.push({ name, status: 'failed', error: error.message });
    }
  }
  
  // Test 1: Backend API Health Check
  await test('Backend API Health Check', async () => {
    const response = await page.goto('http://localhost:8001/api/health');
    const data = await response.json();
    if (data.status !== 'healthy') throw new Error('API not healthy');
  });
  
  // Test 2: Backend API Documentation
  await test('Backend API Documentation', async () => {
    await page.goto('http://localhost:8001/docs');
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });
    const title = await page.title();
    if (!title.includes('Rover Development Platform')) {
      throw new Error('Incorrect API docs title');
    }
    await page.screenshot({ path: 'test-backend-docs.png' });
  });
  
  // Test 3: Frontend Application Load
  await test('Frontend Application Load', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('   3D canvas found');
    await page.screenshot({ path: 'test-frontend-initial.png' });
  });
  
  // Test 4: 3D Rover Visualization
  await test('3D Rover Visualization', async () => {
    // Check if Three.js canvas is present
    const canvas = await page.$('canvas');
    if (!canvas) throw new Error('3D canvas not found');
    
    // Check canvas dimensions
    const box = await canvas.boundingBox();
    if (box.width < 100 || box.height < 100) {
      throw new Error('Canvas too small');
    }
    
    // Interact with OrbitControls
    await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width/2 + 100, box.y + box.height/2);
    await page.mouse.up();
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-3d-rover-rotated.png' });
  });
  
  // Test 5: WebSocket Connection
  await test('WebSocket Telemetry Connection', async () => {
    // Check for WebSocket connection in console
    const wsConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:8001/api/ws/telemetry');
        ws.onopen = () => resolve(true);
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000);
      });
    });
    
    if (!wsConnected) throw new Error('WebSocket connection failed');
  });
  
  // Test 6: Control Interface
  await test('Rover Control Interface', async () => {
    // Look for control elements
    const hasJoystick = await page.$('.joystick-container') !== null;
    const hasControls = await page.$('[data-testid="rover-controls"]') !== null;
    
    if (!hasJoystick && !hasControls) {
      console.log('   Warning: No control interface found');
    }
  });
  
  // Test 7: Responsive Design - Tablet
  await test('Responsive Design - Tablet', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-responsive-tablet.png' });
    
    // Check if UI adapts
    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    if (box.width > 768) throw new Error('Canvas not responsive');
  });
  
  // Test 8: Responsive Design - Mobile
  await test('Responsive Design - Mobile', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-responsive-mobile.png' });
  });
  
  // Test 9: Error Handling
  await test('Error Handling - Invalid API Call', async () => {
    const response = await page.request.post('http://localhost:8001/api/rover/control', {
      data: { invalid: 'data' }
    });
    
    if (response.status() >= 500) {
      throw new Error('Server error on invalid data');
    }
  });
  
  // Test 10: Performance Metrics
  await test('Performance Metrics', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0
      };
    });
    
    console.log(`   Load time: ${metrics.loadTime}ms`);
    console.log(`   DOM ready: ${metrics.domContentLoaded}ms`);
    
    if (metrics.loadTime > 5000) {
      throw new Error('Page load too slow');
    }
  });
  
  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`   Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`   ✅ Passed: ${testResults.passed}`);
  console.log(`   ❌ Failed: ${testResults.failed}`);
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.passed + testResults.failed,
      passed: testResults.passed,
      failed: testResults.failed
    },
    tests: testResults.tests
  };
  
  require('fs').writeFileSync(
    'playwright_test_results.json',
    JSON.stringify(report, null, 2)
  );
  
  await browser.close();
  
  if (testResults.failed > 0) {
    console.error('\n⚠️  Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
  }
}

// Run tests
runE2ETests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
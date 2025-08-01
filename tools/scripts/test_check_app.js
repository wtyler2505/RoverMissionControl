const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Checking different ports...');
  
  // Try different ports
  const ports = [3000, 3001, 8080, 5000, 4200];
  
  for (const port of ports) {
    try {
      console.log(`\nTrying port ${port}...`);
      await page.goto(`http://localhost:${port}`, { timeout: 5000 });
      console.log(`✓ Port ${port} is accessible!`);
      console.log(`  Title: ${await page.title()}`);
      
      // Take screenshot
      await page.screenshot({ path: `screenshots/port-${port}.png` });
      
      // Check for main elements
      const hasCanvas = await page.locator('canvas').count();
      const hasButtons = await page.locator('button').count();
      const hasInputs = await page.locator('input').count();
      
      console.log(`  Canvas elements: ${hasCanvas}`);
      console.log(`  Buttons: ${hasButtons}`);
      console.log(`  Input fields: ${hasInputs}`);
      
      break; // Found working port
    } catch (error) {
      console.log(`✗ Port ${port} failed: ${error.message}`);
    }
  }
  
  // Try backend API
  try {
    console.log('\nChecking backend API...');
    const response = await page.goto('http://localhost:8001/docs');
    console.log(`Backend API docs: ${response.status()}`);
    await page.screenshot({ path: 'screenshots/api-docs.png' });
  } catch (error) {
    console.log(`Backend check failed: ${error.message}`);
  }
  
  await browser.close();
})();
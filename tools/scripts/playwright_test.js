const { chromium } = require('playwright');

(async () => {
  console.log('Starting Playwright test...');
  
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Test backend API docs
    console.log('Testing backend API documentation...');
    await page.goto('http://localhost:8001/docs', { waitUntil: 'networkidle' });
    
    // Wait for the Swagger UI to load
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });
    console.log('Swagger UI loaded successfully');
    
    // Get page title
    const pageTitle = await page.title();
    console.log('Page Title:', pageTitle);
    
    // Take screenshot
    await page.screenshot({ path: 'backend_docs.png' });
    console.log('Screenshot saved as backend_docs.png');
    
    // Test API endpoint
    console.log('Testing API health endpoint...');
    const response = await page.goto('http://localhost:8001/api/health');
    const data = await response.json();
    console.log('Health check response:', data);
    
    // Try frontend (if running)
    console.log('Attempting to test frontend...');
    try {
      await page.goto('http://localhost:3000', { timeout: 5000 });
      console.log('Frontend is accessible');
      await page.screenshot({ path: 'frontend.png' });
    } catch (e) {
      console.log('Frontend not available:', e.message);
    }
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();
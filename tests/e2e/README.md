# Playwright E2E Testing Framework for Rover Mission Control

This comprehensive end-to-end testing framework provides full coverage of the Hardware Abstraction Layer (HAL) components and rover control workflows using Playwright.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Chrome, Firefox, and Safari browsers (installed automatically by Playwright)

### Installation

```bash
# Install all dependencies
npm install

# Install Playwright browsers
npm run test:e2e:install
```

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run specific browser
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit

# Run mobile tests
npm run test:e2e:mobile

# Run API tests only
npm run test:e2e:api

# Run visual regression tests
npm run test:e2e:visual

# Run performance tests
npm run test:e2e:performance

# Run accessibility tests
npm run test:e2e:accessibility

# Debug tests
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

## 📁 Project Structure

```
tests/e2e/
├── auth/                    # Authentication setup and teardown
│   ├── auth.setup.ts       # Login and create auth states
│   └── auth.teardown.ts    # Cleanup auth states
├── fixtures/               # Test data and utilities
│   └── test-data.ts        # Mock data, test scenarios, API responses
├── pages/                  # Page Object Model implementations
│   ├── base-page.ts        # Base page with common functionality
│   ├── hal-dashboard-page.ts   # HAL Dashboard page object
│   └── device-discovery-page.ts  # Device Discovery page object
├── setup/                  # Global setup and teardown
│   ├── global-setup.ts     # Database, services, auth setup
│   └── global-teardown.ts  # Cleanup and artifact organization
├── specs/                  # Test specifications
│   ├── hal-dashboard.spec.ts    # HAL Dashboard tests
│   └── device-discovery.spec.ts # Device Discovery tests
├── utils/                  # Utility services
│   ├── auth-service.ts     # Authentication management
│   ├── database-service.ts # Test database operations
│   └── hardware-service.ts # Hardware simulator management
├── visual/                 # Visual regression tests
│   └── hal-visual.spec.ts  # Visual consistency tests
├── api/                    # API integration tests
│   └── hal-api.spec.ts     # Backend API testing
├── performance/            # Performance tests
├── accessibility/          # Accessibility tests
└── README.md              # This file
```

## 🔧 Configuration

### Playwright Configuration

The main configuration is in `playwright.config.ts` at the project root. Key features:

- **Multi-browser testing**: Chromium, Firefox, WebKit
- **Mobile device simulation**: iPhone, Android
- **Parallel execution**: Configurable workers
- **Visual regression**: Screenshot comparison
- **Authentication**: Persistent login states
- **CI/CD optimization**: Retry logic and reporting

### Environment Variables

Create `.env` file in project root:

```env
# Test environment URLs
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000

# Database
DATABASE_URL=sqlite:///test_rover_platform.db

# Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123

# CI/CD
CI=false
STORAGE_STATE=tests/e2e/auth/admin-auth.json
```

## 🧪 Test Categories

### 1. HAL Dashboard Tests (`hal-dashboard.spec.ts`)

Tests the main Hardware Abstraction Layer dashboard:

- **Dashboard Loading**: Layout, navigation, responsive design
- **System Status**: Health monitoring, device counts, alerts
- **Quick Actions**: Device scan, diagnostics, firmware updates
- **Real-time Updates**: WebSocket telemetry, device events
- **User Interface**: Dark mode, drawer toggle, refresh
- **Error Handling**: Network failures, invalid data
- **Accessibility**: Screen readers, keyboard navigation
- **Performance**: Load times, high-frequency updates

### 2. Device Discovery Tests (`device-discovery.spec.ts`)

Tests device discovery and management workflows:

- **Device Scanning**: Automatic discovery, real-time updates
- **Device Registration**: Connect discovered devices
- **Manual Addition**: Add devices with custom parameters
- **Device Management**: View details, test connections, remove
- **Filtering & Search**: Type, status, connection filters
- **Settings**: Auto-discovery, scan intervals
- **Export**: CSV, JSON, XML formats
- **Error Scenarios**: Hardware failures, network issues

### 3. Visual Regression Tests (`hal-visual.spec.ts`)

Ensures UI consistency across browsers and updates:

- **Layout Screenshots**: Dashboard views, responsive breakpoints
- **Component States**: Loading, error, hover, focus states
- **Theme Variations**: Light/dark mode comparisons
- **Browser Consistency**: Cross-browser rendering
- **Mobile Layouts**: Phone and tablet views

### 4. API Integration Tests (`hal-api.spec.ts`)

Tests backend API endpoints directly:

- **Device Management**: CRUD operations, validation
- **Discovery API**: Scan, register, status endpoints
- **Telemetry API**: Real-time and historical data
- **Command API**: Execute, status, cancel, history
- **System API**: Health, statistics, alerts
- **Authentication**: Login, token validation
- **Error Handling**: Invalid requests, rate limiting
- **Performance**: Response times, concurrent requests

## 🔐 Authentication & Authorization

The framework supports role-based testing:

### User Roles

- **Admin**: Full system access, user management
- **Operator**: Device control, command execution
- **Viewer**: Read-only access, telemetry viewing

### Authentication Flow

1. Global setup creates authenticated browser contexts
2. Tests use persistent storage states for fast execution
3. Role-specific tests verify access controls
4. Global teardown cleans up authentication states

## 📊 Test Data Management

### Test Fixtures

- **Mock Devices**: Arduino rovers, ESP32 sensors, cameras
- **Telemetry Data**: Generated time-series data with realistic patterns
- **Commands**: Device-specific command templates
- **Users**: Role-based test accounts
- **Scenarios**: End-to-end workflow definitions

### Data Generation

```typescript
// Generate telemetry data
const telemetryData = generateTelemetryData(
  'arduino_rover_01',
  ['battery_voltage', 'motor_current'],
  3600000, // 1 hour duration
  1000     // 1 second intervals
);

// Create test command
const command = generateTestCommands(['device_id'])[0];
```

## 🎯 Page Object Model

### Base Page Class

All page objects extend `BasePage` which provides:

- **Navigation**: Safe URL handling, waiting strategies
- **Element Interaction**: Click, fill, select with retry logic
- **Waiting**: Loading states, animations, network idle
- **Error Handling**: Check for errors, dismiss notifications
- **Accessibility**: Basic accessibility verification
- **Performance**: Page load measurement

### HAL Dashboard Page

```typescript
const halDashboard = new HALDashboardPage(page);

// Navigate and wait for load
await halDashboard.goto();
await halDashboard.waitForDashboardData();

// Get system status
const status = await halDashboard.getSystemStatus();

// Execute actions
await halDashboard.executeQuickAction('scan');
await halDashboard.navigateToTab('diagnostics');
```

## 🔄 Hardware Simulation

The framework includes realistic hardware simulators:

### Simulator Services

- **Arduino Rover**: Navigation, battery monitoring
- **ESP32 Sensors**: Environmental data collection
- **Camera Module**: Video streaming, image capture
- **Generic Sensors**: Accelerometer, GPS, gyroscope

### WebSocket Communication

Simulators provide real-time data via WebSocket:

```python
# Arduino Rover Simulator
class ArduinoRoverSimulator:
    async def send_telemetry(self, websocket):
        telemetry = {
            'type': 'telemetry',
            'device_id': 'arduino_rover_01',
            'data': {
                'battery_voltage': 12.0,
                'motor_current': 1.5
            }
        }
        await websocket.send(json.dumps(telemetry))
```

## 📈 Performance Testing

### Metrics Measured

- **Page Load Times**: First contentful paint, full load
- **API Response Times**: Individual endpoint performance
- **WebSocket Latency**: Real-time data streaming
- **UI Responsiveness**: High-frequency updates handling

### Load Testing

- **Concurrent Users**: Multiple browser contexts
- **High Volume Data**: Large device lists, telemetry streams
- **Memory Usage**: Long-running test scenarios

## ♿ Accessibility Testing

### WCAG 2.1 Compliance

- **Keyboard Navigation**: Tab order, focus management
- **Screen Reader Support**: ARIA labels, roles, descriptions
- **Color Contrast**: Text visibility in light/dark modes
- **Form Labels**: Proper input associations

### Automated Checks

```typescript
await halDashboard.verifyAccessibility();
// Checks:
// - Heading hierarchy
// - Image alt text
// - Form labels
// - Keyboard focusability
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow

The E2E tests run automatically on:

- **Push to main/develop**: Full test suite
- **Pull Requests**: Core functionality tests
- **Scheduled**: Daily comprehensive testing
- **Manual Trigger**: On-demand test execution

### Test Sharding

Large test suites are split across multiple runners:

```yaml
strategy:
  matrix:
    browser: [chromium, firefox, webkit]
    shard: [1, 2, 3, 4]
```

### Artifacts

- **Test Reports**: HTML reports with screenshots
- **Videos**: Failed test recordings
- **Traces**: Detailed execution traces
- **Screenshots**: Visual regression comparisons

## 🐛 Debugging

### Debug Mode

```bash
# Run with debugger
npm run test:e2e:debug

# Run headed (visible browser)
npm run test:e2e:headed

# Run with UI mode
npm run test:e2e:ui
```

### Common Issues

1. **Flaky Tests**: Add explicit waits, check for race conditions
2. **Element Not Found**: Verify selectors, check page load state
3. **Timeout Issues**: Increase timeouts for slow operations
4. **Visual Differences**: Update snapshots after UI changes

### Debugging Tools

- **Playwright Inspector**: Step through tests interactively
- **Browser DevTools**: Inspect elements, network requests
- **Console Logs**: View page errors and messages
- **Screenshots**: Automatic capture on failures

## 📋 Best Practices

### Test Organization

- **One feature per spec file**: Keep tests focused
- **Descriptive test names**: Explain what is being tested
- **Proper test isolation**: Each test should be independent
- **Data-driven tests**: Use fixtures for consistent data

### Page Objects

- **Single responsibility**: One page object per page/component
- **Encapsulation**: Hide implementation details
- **Reusability**: Common actions in base classes
- **Maintainability**: Update selectors in one place

### Assertions

- **Explicit waits**: Use expect() with timeouts
- **Meaningful messages**: Custom error messages
- **State verification**: Check both positive and negative cases
- **Progressive enhancement**: Test with/without JavaScript

### Performance

- **Parallel execution**: Run tests concurrently when possible
- **Smart waiting**: Use page.waitForLoadState() appropriately
- **Resource cleanup**: Clean up after each test
- **Selective testing**: Use test.only() during development

## 🔧 Troubleshooting

### Common Setup Issues

**Browsers not installed:**
```bash
npm run test:e2e:install
```

**Permission errors on Linux:**
```bash
sudo npx playwright install-deps
```

**Database connection issues:**
```bash
# Check database service is running
# Verify connection string in .env
```

**WebSocket connection failures:**
```bash
# Ensure backend server is running
# Check firewall settings
# Verify WebSocket URL in configuration
```

### Test Failures

**Visual regression failures:**
```bash
# Update snapshots after intentional UI changes
npm run test:e2e:update-snapshots
```

**Authentication failures:**
```bash
# Clear auth states and regenerate
rm -rf tests/e2e/auth/*-auth.json
```

**Timing issues:**
```bash
# Increase timeouts in playwright.config.ts
# Add explicit waits in page objects
```

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model Guide](https://playwright.dev/docs/pom)
- [Visual Testing Guide](https://playwright.dev/docs/test-snapshots)
- [API Testing with Playwright](https://playwright.dev/docs/test-api-testing)

## 🤝 Contributing

### Adding New Tests

1. Create test spec in appropriate directory
2. Follow naming convention: `feature-name.spec.ts`
3. Use existing page objects or create new ones
4. Add test data to fixtures if needed
5. Update CI configuration if necessary

### Page Object Guidelines

1. Extend `BasePage` class
2. Use data-testid selectors when possible
3. Implement waiting strategies
4. Add error handling
5. Document public methods

### Test Data Management

1. Add mock data to `test-data.ts`
2. Use generators for dynamic data
3. Keep test data realistic
4. Avoid hardcoded values in tests

---

This E2E testing framework provides comprehensive coverage of the Rover Mission Control system, ensuring reliability and quality across all user workflows and system components.
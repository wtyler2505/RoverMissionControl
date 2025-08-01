# Frontend Testing Guide

This directory contains the comprehensive testing setup for the Rover Mission Control frontend application.

## Overview

Our testing infrastructure includes:
- **Unit Tests**: Component and function testing with Jest and React Testing Library
- **Integration Tests**: Testing component interactions and API integrations
- **E2E Tests**: End-to-end user journey testing
- **Performance Tests**: Lighthouse CI for performance monitoring
- **Accessibility Tests**: Automated accessibility compliance testing
- **Visual Regression Tests**: UI consistency validation

## Test Structure

```
src/__tests__/
├── test-utils.tsx          # Shared testing utilities and custom render
├── setupTests.js           # Global test configuration
├── README.md              # This file
└── jest-watch-config.js   # Jest watch mode configuration

src/__mocks__/
├── server.js              # MSW server setup
├── handlers.js            # API mock handlers
└── fileMock.js           # Static asset mocks

src/components/
└── [Component]/
    └── __tests__/
        ├── Component.test.tsx
        ├── Component.integration.test.tsx
        └── Component.accessibility.test.tsx

src/services/
└── __tests__/
    └── service.test.ts

src/hooks/
└── __tests__/
    └── hook.test.ts
```

## Running Tests

### Basic Commands

```bash
# Run all tests once
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage

# Run tests with debug output
yarn test:debug

# Run tests for CI/CD
yarn test:ci
```

### Advanced Test Commands

```bash
# Run tests for specific component
yarn test HALDashboard

# Run tests for specific folder
yarn test components/HAL

# Run tests matching pattern
yarn test --testNamePattern="should render"

# Run tests for changed files only
yarn test --onlyChanged

# Update snapshots
yarn test --updateSnapshot
```

## Writing Tests

### Component Tests

Use the custom render function from `test-utils.tsx`:

```tsx
import { render, screen, userEvent } from '../../__tests__/test-utils';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Clicked!')).toBeInTheDocument();
  });
});
```

### Service Tests

Mock API calls using MSW:

```typescript
import { hardwareService } from '../hardwareService';
import { server } from '../../__mocks__/server';
import { http, HttpResponse } from 'msw';

describe('hardwareService', () => {
  it('fetches devices successfully', async () => {
    const devices = await hardwareService.getDevices();
    expect(devices).toHaveLength(2);
  });

  it('handles errors gracefully', async () => {
    server.use(
      http.get('*/hal/devices', () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      })
    );

    await expect(hardwareService.getDevices()).rejects.toThrow();
  });
});
```

### Hook Tests

Use `renderHook` from React Testing Library:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCustomHook } from '../useCustomHook';

describe('useCustomHook', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useCustomHook());
    
    expect(result.current.value).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('updates state correctly', () => {
    const { result } = renderHook(() => useCustomHook());
    
    act(() => {
      result.current.increment();
    });

    expect(result.current.value).toBe(1);
  });
});
```

## Test Utilities

### Custom Render

The `render` function from `test-utils.tsx` automatically wraps components with necessary providers:

- React Router
- Material-UI Theme Provider
- Mock WebSocket Provider
- Mock HAL Provider

### Mock Providers

Use mock providers for testing components that depend on context:

```tsx
import { MockWebSocketProvider, MockHALProvider } from '../../__tests__/test-utils';

render(
  <MockWebSocketProvider mockValues={{ isConnected: false }}>
    <MockHALProvider mockValues={{ devices: [] }}>
      <ComponentUnderTest />
    </MockHALProvider>
  </MockWebSocketProvider>
);
```

### Data Generators

Use helper functions to generate test data:

```typescript
import { generateMockDevice, generateMockTelemetryData } from '../../__tests__/test-utils';

const mockDevice = generateMockDevice({
  id: 'custom-id',
  status: 'connected'
});

const telemetryData = generateMockTelemetryData(50, 'temperature');
```

## Coverage Requirements

Our coverage thresholds are:

- **Global**: 80% (branches, functions, lines, statements)
- **HAL Components**: 85%
- **WebSocket Components**: 85%
- **Services**: 80%

Coverage reports are generated in the `coverage/` directory:
- `coverage/lcov-report/index.html` - HTML report
- `coverage/lcov.info` - LCOV format for CI tools
- `coverage/coverage-final.json` - JSON format

## Mocking Strategy

### API Calls

We use MSW (Mock Service Worker) for API mocking:

1. **Global handlers** in `__mocks__/handlers.js` provide default responses
2. **Test-specific overrides** using `server.use()` for edge cases
3. **Error scenarios** using custom error responses

### External Libraries

Common mocks are set up in `setupTests.js`:

- **Socket.IO**: Mocked with controllable connection state
- **Chart.js**: Mocked to prevent canvas issues
- **Three.js**: Mocked for 3D components
- **Monaco Editor**: Mocked with textarea fallback

### Hardware Interfaces

Hardware-dependent code is mocked at the service layer:

```typescript
jest.mock('../hardwareService', () => ({
  hardwareService: {
    getDevices: jest.fn().mockResolvedValue([]),
    sendCommand: jest.fn().mockResolvedValue({ success: true }),
  },
}));
```

## Accessibility Testing

Accessibility tests are automatically included:

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Performance Testing

Performance tests run with Lighthouse CI:

1. **Local testing**: Use `yarn test:performance`
2. **CI integration**: Automated in GitHub Actions
3. **Thresholds**: Configured in `.lighthouserc.js`

## Debugging Tests

### Debug Mode

Run tests with debug output:

```bash
yarn test:debug ComponentName
```

### VS Code Integration

Use the Jest extension for VS Code:

1. Install "Jest" extension
2. Configure in `.vscode/settings.json`:

```json
{
  "jest.jestCommandLine": "yarn test --",
  "jest.autoRun": "watch"
}
```

### Browser Debugging

For debugging React Testing Library queries:

```typescript
import { screen } from '@testing-library/react';

// Add breakpoint and inspect in console
screen.debug(); // Prints current DOM
screen.logTestingPlaygroundURL(); // Opens Testing Playground
```

## Continuous Integration

Tests run automatically on:

- **Push to main/develop**: Full test suite
- **Pull requests**: Full test suite + coverage check
- **Nightly**: Extended test suite including E2E

### Coverage Reports

Coverage is tracked and reported:

- **Codecov**: Integrated with GitHub for PR comments
- **GitHub Actions**: Artifacts stored for 30 days
- **Local**: Generated in `coverage/` directory

## Best Practices

### Writing Tests

1. **Arrange, Act, Assert**: Structure tests clearly
2. **One assertion per test**: Focus on single behaviors
3. **Descriptive names**: Test names should explain expected behavior
4. **User-centric tests**: Test from user's perspective
5. **Mock external dependencies**: Keep tests isolated

### Test Organization

1. **Group related tests**: Use `describe` blocks effectively
2. **Setup/cleanup**: Use `beforeEach`/`afterEach` consistently
3. **Shared utilities**: Extract common patterns
4. **Test data**: Use factories for generating test data

### Performance

1. **Avoid deep mounting**: Use shallow rendering when possible
2. **Clean up**: Ensure proper cleanup in `afterEach`
3. **Parallel execution**: Tests should be independent
4. **Mock heavy operations**: Don't test external services

## Troubleshooting

### Common Issues

1. **Canvas errors**: Check canvas mocking in `setupTests.js`
2. **WebSocket errors**: Ensure proper mocking of Socket.IO
3. **Router errors**: Use `MockWebSocketProvider` wrapper
4. **Timeout errors**: Increase timeout for slow operations

### Performance Issues

1. **Slow test runs**: Check for unnecessary re-renders
2. **Memory leaks**: Ensure proper cleanup
3. **CI timeouts**: Optimize test parallelization

### Coverage Issues

1. **Low coverage**: Check for untested branches
2. **Excluded files**: Review coverage configuration
3. **False positives**: Use `istanbul ignore` comments sparingly

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/docs/)
- [Testing Playground](https://testing-playground.com/)
- [Jest Extended Matchers](https://github.com/jest-community/jest-extended)

## Contributing

When adding new components or features:

1. Write tests first (TDD approach)
2. Ensure accessibility compliance
3. Update mock handlers if new APIs are used
4. Maintain coverage thresholds
5. Document any new testing patterns

For questions or issues with the testing setup, please refer to the team documentation or create an issue in the repository.
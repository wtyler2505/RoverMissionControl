# Simulation System Testing Guide

## Overview

This document provides comprehensive guidance for testing the Rover Mission Control simulation system. The test suite covers all aspects of the simulation functionality including backend services, frontend components, WebSocket communication, and end-to-end workflows.

## Test Structure

```
RoverMissionControl/
├── backend/tests/
│   ├── test_simulation_system.py      # Core simulation engine tests
│   └── test_simulation_websocket.py   # WebSocket integration tests
├── frontend/src/components/SimulationControl/__tests__/
│   ├── SimulationDashboard.test.tsx   # Dashboard component tests
│   ├── SimulationControlPanel.test.tsx # Control panel tests
│   └── DeviceSimulator.test.tsx       # Device simulator tests
├── e2e/
│   └── simulation-system.e2e.test.ts  # End-to-end Playwright tests
└── run_simulation_tests.py            # Test runner script
```

## Running Tests

### Quick Start

Run all tests:
```bash
python run_simulation_tests.py
```

Run specific test suites:
```bash
python run_simulation_tests.py backend
python run_simulation_tests.py frontend
python run_simulation_tests.py e2e
```

### Backend Tests

Run backend tests with coverage:
```bash
cd backend
pytest tests/test_simulation_system.py tests/test_simulation_websocket.py -v --cov=. --cov-report=html
```

Key test areas:
- Simulation engine initialization and lifecycle
- Device management and telemetry
- Physics simulation accuracy
- Network condition simulation
- Scenario execution
- HAL integration
- API endpoints
- WebSocket communication

### Frontend Tests

Run frontend tests:
```bash
cd frontend
npm test -- --coverage --watchAll=false
```

Key test areas:
- Component rendering and state management
- User interactions and form validation
- WebSocket message handling
- Error states and loading states
- Device configuration UI
- Real-time telemetry updates

### End-to-End Tests

Run E2E tests:
```bash
npx playwright test e2e/simulation-system.e2e.test.ts
```

View test report:
```bash
npx playwright show-report
```

Key test scenarios:
- Complete simulation workflow
- Scenario recording and playback
- Network condition effects
- Environmental condition simulation
- Multi-device management
- Error handling and recovery
- Performance under load

## Test Coverage Goals

- **Backend**: Minimum 80% coverage
- **Frontend**: Minimum 75% coverage
- **E2E**: All critical user workflows

## Writing New Tests

### Backend Test Example

```python
@pytest.mark.asyncio
async def test_new_simulation_feature(self):
    """Test description."""
    # Arrange
    engine = SimulationEngine()
    await engine.start()
    
    # Act
    result = await engine.new_feature()
    
    # Assert
    assert result.status == "success"
    
    # Cleanup
    await engine.stop()
```

### Frontend Test Example

```typescript
it('should handle new feature', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ComponentName />);
  
  // Act
  await user.click(screen.getByRole('button', { name: /feature/i }));
  
  // Assert
  await waitFor(() => {
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });
});
```

### E2E Test Example

```typescript
test('new feature workflow', async ({ page }) => {
  await navigateToSimulation(page);
  
  // Perform actions
  await page.click('[data-testid="new-feature-btn"]');
  
  // Verify results
  await expect(page.locator('[data-testid="result"]')).toContainText('Expected');
});
```

## Continuous Integration

Tests run automatically on:
- Push to main/develop branches
- Pull requests
- Scheduled nightly builds

GitHub Actions workflow: `.github/workflows/simulation-tests.yml`

## Test Data

### Mock Devices
- Temperature Sensor: Basic sensor with noise simulation
- IMU Sensor: 6-axis sensor with realistic physics
- GPS: Location sensor with accuracy simulation
- Rover: Complex actuator with movement and battery

### Test Scenarios
- `basic_test`: Simple device interaction
- `rover_patrol`: Multi-step rover movement
- `sensor_sweep`: Comprehensive sensor testing
- `network_stress`: Network condition testing

## Debugging Tests

### Backend Debugging
```bash
# Run with verbose output
pytest -vv tests/test_simulation_system.py::TestSimulationEngine::test_engine_start_stop

# Run with debugging
pytest --pdb tests/test_simulation_system.py

# Run specific test class
pytest tests/test_simulation_system.py::TestPhysicsSimulator
```

### Frontend Debugging
```bash
# Run in watch mode
npm test -- --watch

# Debug specific test file
npm test SimulationDashboard.test.tsx

# Update snapshots
npm test -- -u
```

### E2E Debugging
```bash
# Run with UI mode
npx playwright test --ui

# Debug mode
npx playwright test --debug

# Headed mode (see browser)
npx playwright test --headed
```

## Performance Testing

Monitor key metrics during tests:
- Response time < 100ms for API calls
- WebSocket latency < 50ms
- UI updates < 16ms (60 FPS)
- Memory usage stable over time

## Security Testing

Verify:
- Authentication required for simulation control
- Role-based access control enforced
- Input validation on all endpoints
- WebSocket connection security

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Dependencies**: Use mocks for hardware, network, etc.
3. **Clear Test Names**: Describe what is being tested
4. **Arrange-Act-Assert**: Follow AAA pattern
5. **Fast Tests**: Keep unit tests under 100ms
6. **Reliable Tests**: No flaky tests allowed
7. **Meaningful Assertions**: Test behavior, not implementation

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill process on port 8000 (backend)
   lsof -ti:8000 | xargs kill -9
   
   # Kill process on port 3000 (frontend)
   lsof -ti:3000 | xargs kill -9
   ```

2. **WebSocket Connection Failed**
   - Check if backend is running
   - Verify CORS configuration
   - Check WebSocket URL in frontend config

3. **Test Timeout**
   - Increase timeout in test configuration
   - Check for blocking operations
   - Verify async/await usage

4. **Coverage Not Generated**
   - Install coverage dependencies
   - Check coverage configuration
   - Verify test discovery

## Maintenance

- Review and update tests when adding new features
- Remove obsolete tests
- Keep test documentation current
- Monitor test execution time
- Regularly review coverage reports

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/react)
- [WebSocket Testing Guide](https://docs.python.org/3/library/asyncio.html)
/**
 * Unit Tests for MainVisualizationPanel
 * 
 * Comprehensive test suite covering functionality, accessibility,
 * responsiveness, and edge cases for the main visualization panel.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MainVisualizationPanel } from './MainVisualizationPanel';
import type { MainVisualizationPanelProps, ContextMenuItem } from './MainVisualizationPanel';

// Mock CSS import
jest.mock('./MainVisualizationPanel.css', () => ({}));

// Mock theme provider
jest.mock('../../../theme/ThemeProvider', () => ({
  useTheme: () => ({
    name: 'default',
    colors: {
      primary: '#007acc',
      secondary: '#6c757d'
    }
  })
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('MainVisualizationPanel', () => {
  // Default props for testing
  const defaultProps: MainVisualizationPanelProps = {
    id: 'test-panel',
    testId: 'main-visualization-panel'
  };

  const renderComponent = (props: Partial<MainVisualizationPanelProps> = {}) => {
    return render(<MainVisualizationPanel {...defaultProps} {...props} />);
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock window dimensions for responsive tests
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });
  });

  // ========== Basic Rendering Tests ==========

  describe('Basic Rendering', () => {
    it('renders the main panel with correct role and aria-label', () => {
      renderComponent();
      
      const panel = screen.getByRole('main', { name: /main visualization panel/i });
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveAttribute('tabIndex', '0');
    });

    it('renders with default 3D mode', () => {
      renderComponent();
      
      const threeDTab = screen.getByRole('tab', { name: /3D/i });
      expect(threeDTab).toHaveAttribute('aria-selected', 'true');
      
      const threeDContainer = screen.getByRole('img', { name: /3d visualization/i });
      expect(threeDContainer).toBeInTheDocument();
    });

    it('applies custom className and testId', () => {
      renderComponent({ 
        className: 'custom-class', 
        testId: 'custom-test-id' 
      });
      
      const panel = screen.getByTestId('custom-test-id');
      expect(panel).toHaveClass('custom-class');
    });

    it('renders panel title and subtitle', () => {
      renderComponent();
      
      expect(screen.getByText('Mission Visualization')).toBeInTheDocument();
      expect(screen.getByText('Real-time 3D rover visualization and mission data')).toBeInTheDocument();
    });
  });

  // ========== Mode Switching Tests ==========

  describe('Mode Switching', () => {
    it('switches to map mode when map button is clicked', async () => {
      const user = userEvent.setup();
      const onModeChange = jest.fn();
      renderComponent({ onModeChange });
      
      const mapButton = screen.getByRole('tab', { name: /MAP/i });
      await user.click(mapButton);
      
      expect(onModeChange).toHaveBeenCalledWith('map');
      expect(mapButton).toHaveAttribute('aria-selected', 'true');
      
      const mapContainer = screen.getByRole('img', { name: /map view/i });
      expect(mapContainer).toBeInTheDocument();
    });

    it('switches to data mode when data button is clicked', async () => {
      const user = userEvent.setup();
      const onModeChange = jest.fn();
      renderComponent({ onModeChange });
      
      const dataButton = screen.getByRole('tab', { name: /DATA/i });
      await user.click(dataButton);
      
      expect(onModeChange).toHaveBeenCalledWith('data');
      expect(dataButton).toHaveAttribute('aria-selected', 'true');
      
      const dataContainer = screen.getByRole('region', { name: /data visualization/i });
      expect(dataContainer).toBeInTheDocument();
    });

    it('announces mode changes to screen readers', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Create aria live region
      const liveRegion = document.createElement('div');
      liveRegion.id = 'aria-announcements';
      document.body.appendChild(liveRegion);
      
      const mapButton = screen.getByRole('tab', { name: /MAP/i });
      await user.click(mapButton);
      
      expect(liveRegion.textContent).toBe('Visualization mode changed to map');
      
      document.body.removeChild(liveRegion);
    });
  });

  // ========== Loading and Error States ==========

  describe('Loading and Error States', () => {
    it('displays loading state correctly', () => {
      renderComponent({ isLoading: true });
      
      const loadingContainer = screen.getByRole('status', { name: /loading visualization/i });
      expect(loadingContainer).toBeInTheDocument();
      expect(screen.getByText('Loading visualization...')).toBeInTheDocument();
    });

    it('displays error state correctly', () => {
      const errorMessage = 'Network connection failed';
      renderComponent({ error: errorMessage });
      
      const errorContainer = screen.getByRole('alert', { name: /visualization error/i });
      expect(errorContainer).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('calls window.location.reload when retry button is clicked', async () => {
      const user = userEvent.setup();
      const reloadMock = jest.fn();
      Object.defineProperty(window.location, 'reload', {
        configurable: true,
        value: reloadMock,
      });
      
      renderComponent({ error: 'Test error' });
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      
      expect(reloadMock).toHaveBeenCalled();
    });
  });

  // ========== Minimized State ==========

  describe('Minimized State', () => {
    it('renders minimized view correctly', () => {
      renderComponent({ isMinimized: true });
      
      const minimizedPanel = screen.getByTestId('main-visualization-panel-minimized');
      expect(minimizedPanel).toBeInTheDocument();
      expect(screen.getByText('3D Viz')).toBeInTheDocument();
    });

    it('does not render full content when minimized', () => {
      renderComponent({ isMinimized: true });
      
      expect(screen.queryByText('Mission Visualization')).not.toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });
  });

  // ========== Fullscreen Functionality ==========

  describe('Fullscreen Functionality', () => {
    it('applies fullscreen class when isFullscreen is true', () => {
      renderComponent({ isFullscreen: true });
      
      const panel = screen.getByTestId('main-visualization-panel');
      expect(panel).toHaveClass('fullscreen');
    });

    it('calls onFullscreenToggle when fullscreen button is clicked', async () => {
      const user = userEvent.setup();
      const onFullscreenToggle = jest.fn();
      renderComponent({ onFullscreenToggle });
      
      const fullscreenButton = screen.getByRole('button', { name: /enter fullscreen/i });
      await user.click(fullscreenButton);
      
      expect(onFullscreenToggle).toHaveBeenCalled();
    });

    it('updates fullscreen button label based on fullscreen state', () => {
      const { rerender } = renderComponent({ isFullscreen: false });
      
      expect(screen.getByRole('button', { name: /enter fullscreen/i })).toBeInTheDocument();
      
      rerender(<MainVisualizationPanel {...defaultProps} isFullscreen={true} />);
      
      expect(screen.getByRole('button', { name: /exit fullscreen/i })).toBeInTheDocument();
    });
  });

  // ========== Context Menu Tests ==========

  describe('Context Menu', () => {
    it('shows context menu on right click', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const panel = screen.getByRole('main');
      await user.pointer({ keys: '[MouseRight]', target: panel });
      
      await waitFor(() => {
        const contextMenu = screen.getByRole('menu', { name: /visualization panel options/i });
        expect(contextMenu).toBeInTheDocument();
      });
    });

    it('hides context menu when clicking outside', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const panel = screen.getByRole('main');
      await user.pointer({ keys: '[MouseRight]', target: panel });
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      // Click outside
      await user.click(document.body);
      
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('renders custom context menu items', async () => {
      const user = userEvent.setup();
      const customAction = jest.fn();
      const customItems: ContextMenuItem[] = [
        {
          id: 'custom-item',
          label: 'Custom Action',
          icon: '🔧',
          action: customAction
        }
      ];
      
      renderComponent({ customContextMenuItems: customItems });
      
      const panel = screen.getByRole('main');
      await user.pointer({ keys: '[MouseRight]', target: panel });
      
      await waitFor(() => {
        const customMenuItem = screen.getByRole('menuitem', { name: /custom action/i });
        expect(customMenuItem).toBeInTheDocument();
      });
      
      const customMenuItem = screen.getByRole('menuitem', { name: /custom action/i });
      await user.click(customMenuItem);
      
      expect(customAction).toHaveBeenCalled();
    });
  });

  // ========== Keyboard Navigation Tests ==========

  describe('Keyboard Navigation', () => {
    it('handles F11 key for fullscreen toggle', async () => {
      const user = userEvent.setup();
      const onFullscreenToggle = jest.fn();
      renderComponent({ onFullscreenToggle });
      
      const panel = screen.getByRole('main');
      panel.focus();
      
      await user.keyboard('{F11}');
      
      expect(onFullscreenToggle).toHaveBeenCalled();
    });

    it('handles Ctrl+1/2/3 for mode switching', async () => {
      const user = userEvent.setup();
      const onModeChange = jest.fn();
      renderComponent({ onModeChange });
      
      const panel = screen.getByRole('main');
      panel.focus();
      
      await user.keyboard('{Control>}2{/Control}');
      expect(onModeChange).toHaveBeenCalledWith('map');
      
      await user.keyboard('{Control>}3{/Control}');
      expect(onModeChange).toHaveBeenCalledWith('data');
      
      await user.keyboard('{Control>}1{/Control}');
      expect(onModeChange).toHaveBeenCalledWith('3d');
    });

    it('handles Escape key to close context menu', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const panel = screen.getByRole('main');
      
      // Open context menu
      await user.pointer({ keys: '[MouseRight]', target: panel });
      
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      
      // Press Escape
      panel.focus();
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  // ========== Drag and Drop Tests ==========

  describe('Drag and Drop', () => {
    it('enables dragging when dragDropConfig allows it', () => {
      renderComponent({
        dragDropConfig: { enableDragToReposition: true }
      });
      
      const panel = screen.getByRole('main');
      expect(panel).toHaveAttribute('draggable', 'true');
    });

    it('disables dragging when dragDropConfig disallows it', () => {
      renderComponent({
        dragDropConfig: { enableDragToReposition: false }
      });
      
      const panel = screen.getByRole('main');
      expect(panel).toHaveAttribute('draggable', 'false');
    });

    it('handles drag start event', () => {
      renderComponent();
      
      const panel = screen.getByRole('main');
      const dragEvent = new DragEvent('dragstart', {
        bubbles: true,
        dataTransfer: new DataTransfer()
      });
      
      fireEvent(panel, dragEvent);
      
      expect(panel).toHaveClass('dragging');
    });
  });

  // ========== Responsive Behavior Tests ==========

  describe('Responsive Behavior', () => {
    it('applies desktop width (60%) on large screens', () => {
      // Mock large screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1400,
      });
      
      renderComponent();
      
      const panel = screen.getByRole('main');
      expect(panel).toHaveStyle('width: 60%');
    });

    it('applies full width (100%) on tablet screens', () => {
      // Mock tablet screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 900,
      });
      
      // Trigger resize event
      fireEvent(window, new Event('resize'));
      
      renderComponent();
      
      const panel = screen.getByRole('main');
      expect(panel).toHaveStyle('width: 100%');
    });

    it('applies full width (100%) on mobile screens', () => {
      // Mock mobile screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 400,
      });
      
      // Trigger resize event
      fireEvent(window, new Event('resize'));
      
      renderComponent();
      
      const panel = screen.getByRole('main');
      expect(panel).toHaveStyle('width: 100%');
    });
  });

  // ========== Accessibility Tests ==========

  describe('Accessibility', () => {
    it('has proper ARIA roles and labels', () => {
      renderComponent();
      
      const main = screen.getByRole('main', { name: /main visualization panel/i });
      expect(main).toBeInTheDocument();
      
      const tablist = screen.getByRole('tablist', { name: /visualization mode selection/i });
      expect(tablist).toBeInTheDocument();
      
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
      
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected');
        expect(tab).toHaveAttribute('aria-controls');
      });
    });

    it('manages focus correctly', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const panel = screen.getByRole('main');
      await user.tab();
      
      expect(panel).toHaveFocus();
    });

    it('provides keyboard shortcuts information', () => {
      renderComponent();
      
      // Check if shortcuts are available in context menu
      const panel = screen.getByRole('main');
      fireEvent.contextMenu(panel);
      
      waitFor(() => {
        const fullscreenItem = screen.getByText('F11');
        expect(fullscreenItem).toBeInTheDocument();
      });
    });
  });

  // ========== Configuration Tests ==========

  describe('Configuration', () => {
    it('applies custom Three.js configuration', () => {
      const customConfig = {
        backgroundColor: '#ff0000',
        cameraPosition: [5, 5, 5] as [number, number, number],
        fieldOfView: 60,
        enableOrbitControls: false,
        enableGrid: false,
        enableAxes: false
      };
      
      renderComponent({ threeJSConfig: customConfig });
      
      const threejsContainer = screen.getByText(/60°/);
      expect(threejsContainer).toBeInTheDocument();
      
      const cameraText = screen.getByText(/\[5, 5, 5\]/);
      expect(cameraText).toBeInTheDocument();
    });

    it('displays visualization data count in status bar', () => {
      const visualizationData = {
        temperature: 25.4,
        pressure: 1013.2,
        humidity: 45.2
      };
      
      renderComponent({ visualizationData });
      
      expect(screen.getByText('3')).toBeInTheDocument(); // 3 data points
    });
  });

  // ========== Edge Cases ==========

  describe('Edge Cases', () => {
    it('handles missing callbacks gracefully', async () => {
      const user = userEvent.setup();
      renderComponent(); // No callbacks provided
      
      // Should not throw errors
      const mapButton = screen.getByRole('tab', { name: /MAP/i });
      await user.click(mapButton);
      
      const settingsButton = screen.getByRole('button', { name: /panel settings/i });
      await user.click(settingsButton);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('handles empty visualization data', () => {
      renderComponent({ 
        mode: 'data',
        visualizationData: {} 
      });
      
      const dataContainer = screen.getByRole('region', { name: /data visualization/i });
      expect(dataContainer).toBeInTheDocument();
    });

    it('handles very long error messages', () => {
      const longError = 'A'.repeat(1000);
      renderComponent({ error: longError });
      
      const errorContainer = screen.getByRole('alert');
      expect(errorContainer).toBeInTheDocument();
      expect(screen.getByText(longError)).toBeInTheDocument();
    });
  });

  // ========== Cleanup Tests ==========

  describe('Cleanup', () => {
    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      const { unmount } = renderComponent();
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('cleans up context menu event listeners', async () => {
      const user = userEvent.setup();
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      
      const { unmount } = renderComponent();
      
      // Open context menu to add event listeners
      const panel = screen.getByRole('main');
      await user.pointer({ keys: '[MouseRight]', target: panel });
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });
});
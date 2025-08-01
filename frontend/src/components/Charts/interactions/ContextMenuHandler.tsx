/**
 * Context Menu Handler for chart interactions
 * Provides right-click context menus with keyboard accessibility
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { ContextMenuConfig, ContextMenuItem, ContextMenuContext } from './types';

// Styled components
const MenuContainer = styled.div<{ x: number; y: number; visible: boolean }>`
  position: fixed;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  z-index: 10000;
  opacity: ${props => props.visible ? 1 : 0};
  transform: scale(${props => props.visible ? 1 : 0.95});
  transition: opacity 150ms ease-out, transform 150ms ease-out;
  pointer-events: ${props => props.visible ? 'auto' : 'none'};
`;

const Menu = styled.ul`
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  margin: 0;
  list-style: none;
  min-width: 200px;
  max-width: 300px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  
  @media (prefers-color-scheme: dark) {
    background: #2a2a2a;
    border-color: #444;
    color: #ffffff;
  }
`;

const MenuItem = styled.li<{ disabled?: boolean }>`
  padding: 8px 16px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.5 : 1};
  display: flex;
  align-items: center;
  gap: 12px;
  user-select: none;
  position: relative;
  
  &:hover:not(:disabled) {
    background-color: #f5f5f5;
    
    @media (prefers-color-scheme: dark) {
      background-color: #3a3a3a;
    }
  }
  
  &:focus {
    outline: 2px solid #2196f3;
    outline-offset: -2px;
    background-color: #f5f5f5;
    
    @media (prefers-color-scheme: dark) {
      background-color: #3a3a3a;
    }
  }
`;

const MenuIcon = styled.span`
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const MenuLabel = styled.span`
  flex: 1;
`;

const MenuShortcut = styled.span`
  font-size: 12px;
  color: #999;
  margin-left: auto;
  
  @media (prefers-color-scheme: dark) {
    color: #999;
  }
`;

const MenuDivider = styled.li`
  height: 1px;
  background-color: #e0e0e0;
  margin: 4px 0;
  
  @media (prefers-color-scheme: dark) {
    background-color: #444;
  }
`;

const SubmenuArrow = styled.span`
  margin-left: auto;
  font-size: 10px;
  color: #999;
`;

interface ContextMenuHandlerProps extends ContextMenuConfig {
  containerRef: React.RefObject<SVGElement>;
  chartDimensions?: { width: number; height: number; margin: any };
}

export const ContextMenuHandler: React.FC<ContextMenuHandlerProps> = ({
  enabled = true,
  items = [],
  onOpen,
  onClose,
  containerRef,
  chartDimensions
}) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [context, setContext] = useState<ContextMenuContext | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const menuRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  /**
   * Calculate menu position to avoid edge clipping
   */
  const calculatePosition = useCallback((x: number, y: number): { x: number; y: number } => {
    const menuWidth = 250; // Approximate menu width
    const menuHeight = items.length * 40 + 20; // Approximate menu height
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Adjust horizontal position
    if (x + menuWidth > windowWidth - 20) {
      x = x - menuWidth;
    }
    
    // Adjust vertical position
    if (y + menuHeight > windowHeight - 20) {
      y = windowHeight - menuHeight - 20;
    }
    
    // Ensure menu stays within viewport
    x = Math.max(10, Math.min(x, windowWidth - menuWidth - 10));
    y = Math.max(10, Math.min(y, windowHeight - menuHeight - 10));
    
    return { x, y };
  }, [items.length]);

  /**
   * Handle context menu event
   */
  const handleContextMenu = useCallback((event: MouseEvent) => {
    if (!enabled || !containerRef.current) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Calculate chart coordinates if dimensions provided
    let chartX: number | undefined;
    let chartY: number | undefined;
    
    if (chartDimensions) {
      chartX = event.clientX - rect.left - chartDimensions.margin.left;
      chartY = event.clientY - rect.top - chartDimensions.margin.top;
      
      // Check if click is within chart area
      if (chartX < 0 || chartX > chartDimensions.width - chartDimensions.margin.left - chartDimensions.margin.right ||
          chartY < 0 || chartY > chartDimensions.height - chartDimensions.margin.top - chartDimensions.margin.bottom) {
        chartX = undefined;
        chartY = undefined;
      }
    }
    
    // Create context
    const menuContext: ContextMenuContext = {
      x: event.clientX,
      y: event.clientY,
      chartX,
      chartY
    };
    
    setContext(menuContext);
    setPosition(calculatePosition(event.clientX, event.clientY));
    setVisible(true);
    setSelectedIndex(-1);
    
    // Call onOpen callback
    onOpen?.(menuContext);
  }, [enabled, containerRef, chartDimensions, calculatePosition, onOpen]);

  /**
   * Handle menu item click
   */
  const handleItemClick = useCallback((item: ContextMenuItem) => {
    if (item.disabled || !context) return;
    
    // Execute action
    item.action?.(context);
    
    // Close menu
    setVisible(false);
    onClose?.();
  }, [context, onClose]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!visible) return;
    
    const enabledItems = items.filter(item => !item.divider && !item.disabled);
    const enabledIndices = items
      .map((item, index) => (!item.divider && !item.disabled ? index : -1))
      .filter(index => index !== -1);
    
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setVisible(false);
        onClose?.();
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => {
          const currentEnabledIndex = enabledIndices.indexOf(prev);
          const nextIndex = (currentEnabledIndex + 1) % enabledIndices.length;
          return enabledIndices[nextIndex];
        });
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => {
          const currentEnabledIndex = enabledIndices.indexOf(prev);
          const nextIndex = currentEnabledIndex <= 0 
            ? enabledIndices.length - 1 
            : currentEnabledIndex - 1;
          return enabledIndices[nextIndex];
        });
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          const item = items[selectedIndex];
          if (!item.divider && !item.disabled) {
            handleItemClick(item);
          }
        }
        break;
        
      case 'Home':
        event.preventDefault();
        setSelectedIndex(enabledIndices[0] || -1);
        break;
        
      case 'End':
        event.preventDefault();
        setSelectedIndex(enabledIndices[enabledIndices.length - 1] || -1);
        break;
        
      default:
        // Handle shortcut keys
        const key = event.key.toLowerCase();
        const itemWithShortcut = items.find(item => 
          !item.divider && 
          !item.disabled && 
          item.shortcut?.toLowerCase().includes(key)
        );
        
        if (itemWithShortcut) {
          event.preventDefault();
          handleItemClick(itemWithShortcut);
        }
        break;
    }
  }, [visible, items, selectedIndex, handleItemClick, onClose]);

  /**
   * Handle clicks outside menu
   */
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (visible && menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setVisible(false);
      onClose?.();
    }
  }, [visible, onClose]);

  /**
   * Handle Shift+F10 for keyboard context menu
   */
  const handleKeyboardContextMenu = useCallback((event: KeyboardEvent) => {
    if (!enabled || !containerRef.current) return;
    
    if (event.shiftKey && event.key === 'F10') {
      event.preventDefault();
      
      // Get focused element or container center
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const focusedElement = document.activeElement;
      
      let x = rect.left + rect.width / 2;
      let y = rect.top + rect.height / 2;
      
      if (focusedElement && container.contains(focusedElement)) {
        const focusedRect = focusedElement.getBoundingClientRect();
        x = focusedRect.left + focusedRect.width / 2;
        y = focusedRect.top + focusedRect.height / 2;
      }
      
      // Create synthetic context menu event
      const syntheticEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      });
      
      container.dispatchEvent(syntheticEvent);
    }
  }, [enabled, containerRef]);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    
    const container = containerRef.current;
    
    // Add event listeners
    container.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleKeyboardContextMenu);
    
    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleKeyboardContextMenu);
    };
  }, [enabled, containerRef, handleContextMenu, handleClickOutside, handleKeyDown, handleKeyboardContextMenu]);

  /**
   * Focus selected item
   */
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.focus();
    }
  }, [selectedIndex]);

  /**
   * Render menu items
   */
  const renderMenuItem = (item: ContextMenuItem, index: number) => {
    if (item.divider) {
      return <MenuDivider key={`divider-${index}`} />;
    }
    
    return (
      <MenuItem
        key={item.id}
        ref={el => itemRefs.current[index] = el}
        disabled={item.disabled}
        tabIndex={selectedIndex === index ? 0 : -1}
        onClick={() => handleItemClick(item)}
        onMouseEnter={() => setSelectedIndex(index)}
        role="menuitem"
        aria-disabled={item.disabled}
      >
        {item.icon && <MenuIcon>{item.icon}</MenuIcon>}
        <MenuLabel>{item.label}</MenuLabel>
        {item.shortcut && <MenuShortcut>{item.shortcut}</MenuShortcut>}
        {item.submenu && <SubmenuArrow>▶</SubmenuArrow>}
      </MenuItem>
    );
  };

  if (!enabled) return null;

  return createPortal(
    <MenuContainer
      x={position.x}
      y={position.y}
      visible={visible}
      role="menu"
      aria-label="Context menu"
    >
      <Menu ref={menuRef}>
        {items.map((item, index) => renderMenuItem(item, index))}
      </Menu>
    </MenuContainer>,
    document.body
  );
};

/**
 * Default context menu items for charts
 */
export const getDefaultChartMenuItems = (
  onExportCSV?: () => void,
  onExportJSON?: () => void,
  onCopyImage?: () => void,
  onResetView?: () => void
): ContextMenuItem[] => {
  return [
    {
      id: 'export-csv',
      label: 'Export as CSV',
      icon: '📊',
      shortcut: 'Ctrl+S',
      action: () => onExportCSV?.()
    },
    {
      id: 'export-json',
      label: 'Export as JSON',
      icon: '📋',
      action: () => onExportJSON?.()
    },
    {
      id: 'divider-1',
      label: '',
      divider: true
    },
    {
      id: 'copy-image',
      label: 'Copy as Image',
      icon: '🖼️',
      shortcut: 'Ctrl+C',
      action: () => onCopyImage?.()
    },
    {
      id: 'divider-2',
      label: '',
      divider: true
    },
    {
      id: 'reset-view',
      label: 'Reset View',
      icon: '🔄',
      shortcut: 'Ctrl+0',
      action: () => onResetView?.()
    }
  ];
};
import React, { forwardRef, useState, useRef, useEffect, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { TooltipProps, TooltipPosition } from '../types';
import { Theme } from '../../../../theme/themes';
import { transitionStyles, generateId } from '../utils';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const getPositionStyles = (position: TooltipPosition, offset: number) => {
  const positions = {
    top: css`
      bottom: calc(100% + ${offset}px);
      left: 50%;
      transform: translateX(-50%);
    `,
    'top-start': css`
      bottom: calc(100% + ${offset}px);
      left: 0;
    `,
    'top-end': css`
      bottom: calc(100% + ${offset}px);
      right: 0;
    `,
    right: css`
      left: calc(100% + ${offset}px);
      top: 50%;
      transform: translateY(-50%);
    `,
    bottom: css`
      top: calc(100% + ${offset}px);
      left: 50%;
      transform: translateX(-50%);
    `,
    'bottom-start': css`
      top: calc(100% + ${offset}px);
      left: 0;
    `,
    'bottom-end': css`
      top: calc(100% + ${offset}px);
      right: 0;
    `,
    left: css`
      right: calc(100% + ${offset}px);
      top: 50%;
      transform: translateY(-50%);
    `,
  };
  
  return positions[position];
};

const getArrowStyles = (position: TooltipPosition, theme: Theme) => {
  const arrowSize = 6;
  const arrowStyles = {
    top: css`
      bottom: -${arrowSize}px;
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
    `,
    'top-start': css`
      bottom: -${arrowSize}px;
      left: ${theme.spacing[4]};
      transform: rotate(45deg);
    `,
    'top-end': css`
      bottom: -${arrowSize}px;
      right: ${theme.spacing[4]};
      transform: rotate(45deg);
    `,
    right: css`
      left: -${arrowSize}px;
      top: 50%;
      transform: translateY(-50%) rotate(45deg);
    `,
    bottom: css`
      top: -${arrowSize}px;
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
    `,
    'bottom-start': css`
      top: -${arrowSize}px;
      left: ${theme.spacing[4]};
      transform: rotate(45deg);
    `,
    'bottom-end': css`
      top: -${arrowSize}px;
      right: ${theme.spacing[4]};
      transform: rotate(45deg);
    `,
    left: css`
      right: -${arrowSize}px;
      top: 50%;
      transform: translateY(-50%) rotate(45deg);
    `,
  };
  
  return arrowStyles[position];
};

const TooltipWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const TooltipContent = styled.div<{
  theme: Theme;
  position: TooltipPosition;
  offset: number;
  maxWidth?: number;
  visible: boolean;
}>`
  position: absolute;
  z-index: ${({ theme }) => theme.zIndex.tooltip};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  background-color: ${({ theme }) => theme.colors.neutral[900]};
  color: ${({ theme }) => theme.colors.neutral[0]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  white-space: nowrap;
  pointer-events: none;
  
  ${({ position, offset }) => getPositionStyles(position, offset)}
  ${({ maxWidth }) => maxWidth && css`
    max-width: ${maxWidth}px;
    white-space: normal;
  `}
  
  opacity: ${({ visible }) => visible ? 1 : 0};
  visibility: ${({ visible }) => visible ? 'visible' : 'hidden'};
  
  animation: ${({ visible }) => visible ? fadeIn : 'none'} 200ms ease-in-out;
  ${({ theme }) => transitionStyles(theme, ['opacity', 'visibility'])}
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    border: 2px solid ${({ theme }) => theme.colors.neutral[0]};
  }
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const TooltipArrow = styled.span<{
  theme: Theme;
  position: TooltipPosition;
}>`
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: ${({ theme }) => theme.colors.neutral[900]};
  
  ${({ position, theme }) => getArrowStyles(position, theme)}
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    border: 2px solid ${({ theme }) => theme.colors.neutral[0]};
    border-bottom: none;
    border-right: none;
  }
`;

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  (
    {
      content,
      children,
      position = 'top',
      trigger = 'hover',
      delay = 0,
      offset = 8,
      arrow = true,
      open: controlledOpen,
      onOpenChange,
      maxWidth,
      testId,
      className,
      ...props
    },
    ref
  ) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const [coordinates, setCoordinates] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout>();
    const id = generateId('tooltip');
    
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;
    
    const setOpen = (newOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    };
    
    // Update tooltip position
    useEffect(() => {
      if (!isOpen || !triggerRef.current || !tooltipRef.current) return;
      
      const updatePosition = () => {
        const triggerRect = triggerRef.current!.getBoundingClientRect();
        const tooltipRect = tooltipRef.current!.getBoundingClientRect();
        
        // Calculate position relative to viewport
        let top = triggerRect.top;
        let left = triggerRect.left;
        
        // Adjust for scroll
        top += window.scrollY;
        left += window.scrollX;
        
        setCoordinates({ top, left });
      };
      
      updatePosition();
      
      // Update position on scroll or resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }, [isOpen, position]);
    
    const showTooltip = () => {
      if (delay > 0) {
        timeoutRef.current = setTimeout(() => setOpen(true), delay);
      } else {
        setOpen(true);
      }
    };
    
    const hideTooltip = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setOpen(false);
    };
    
    const handleMouseEnter = () => {
      if (trigger === 'hover') {
        showTooltip();
      }
    };
    
    const handleMouseLeave = () => {
      if (trigger === 'hover') {
        hideTooltip();
      }
    };
    
    const handleClick = () => {
      if (trigger === 'click') {
        if (isOpen) {
          hideTooltip();
        } else {
          showTooltip();
        }
      }
    };
    
    const handleFocus = () => {
      if (trigger === 'focus' || trigger === 'hover') {
        showTooltip();
      }
    };
    
    const handleBlur = () => {
      if (trigger === 'focus' || trigger === 'hover') {
        hideTooltip();
      }
    };
    
    // Handle escape key
    useEffect(() => {
      if (!isOpen) return;
      
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          hideTooltip();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen]);
    
    // Handle click outside for click trigger
    useEffect(() => {
      if (!isOpen || trigger !== 'click') return;
      
      const handleClickOutside = (e: MouseEvent) => {
        if (
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node) &&
          tooltipRef.current &&
          !tooltipRef.current.contains(e.target as Node)
        ) {
          hideTooltip();
        }
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, trigger]);
    
    // Clone child element and add event handlers
    const child = React.Children.only(children);
    if (!isValidElement(child)) {
      return null;
    }
    
    const triggerElement = cloneElement(child as React.ReactElement, {
      ref: triggerRef,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onClick: handleClick,
      onFocus: handleFocus,
      onBlur: handleBlur,
      'aria-describedby': isOpen ? id : undefined,
    });
    
    const tooltipContent = isOpen && (
      <div
        style={{
          position: 'fixed',
          top: coordinates.top,
          left: coordinates.left,
          width: triggerRef.current?.offsetWidth,
          height: triggerRef.current?.offsetHeight,
          pointerEvents: 'none',
        }}
      >
        <TooltipContent
          ref={tooltipRef}
          id={id}
          role="tooltip"
          position={position}
          offset={offset}
          maxWidth={maxWidth}
          visible={isOpen}
          data-testid={testId}
          {...props}
        >
          {arrow && <TooltipArrow position={position} />}
          {content}
        </TooltipContent>
      </div>
    );
    
    return (
      <>
        <TooltipWrapper ref={ref} className={className}>
          {triggerElement}
        </TooltipWrapper>
        {createPortal(tooltipContent, document.body)}
      </>
    );
  }
);

Tooltip.displayName = 'Tooltip';
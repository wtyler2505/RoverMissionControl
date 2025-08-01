/**
 * VirtualizedList Component
 * A comprehensive virtualization wrapper for large lists/grids
 * Optimized for telemetry, logs, device lists, and data tables
 */

import React, { useMemo, useCallback, forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { FixedSizeList as List, VariableSizeList as VariableList, FixedSizeGrid as Grid, ListOnScrollProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';

// Enhanced types for comprehensive virtualization
export interface VirtualizedListItem {
  id: string | number;
  height?: number;
  data?: any;
}

export interface VirtualizedListProps {
  items: VirtualizedListItem[];
  itemHeight?: number | ((index: number) => number);
  height: number;
  width?: number | string;
  renderItem: (props: {
    index: number;
    style: React.CSSProperties;
    data: VirtualizedListItem;
    isVisible: boolean;
  }) => React.ReactNode;
  onScroll?: (props: ListOnScrollProps) => void;
  onItemsRendered?: (props: {
    overscanStartIndex: number;
    overscanStopIndex: number;
    visibleStartIndex: number;
    visibleStopIndex: number;
  }) => void;
  
  // Infinite loading support
  hasNextPage?: boolean;
  isNextPageLoading?: boolean;
  loadNextPage?: () => Promise<void> | void;
  
  // Grid support
  isGrid?: boolean;
  columnCount?: number;
  columnWidth?: number;
  
  // Performance optimizations
  overscanCount?: number;
  itemSize?: 'fixed' | 'variable';
  estimatedItemSize?: number;
  
  // Accessibility
  itemRole?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  
  // Loading and empty states
  loading?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  
  // Scroll restoration
  initialScrollOffset?: number;
  onScrollOffsetChange?: (offset: number) => void;
  
  // CSS classes and styling
  className?: string;
  itemClassName?: string;
  containerClassName?: string;
  
  // Custom props
  [key: string]: any;
}

export interface VirtualizedListRef {
  scrollTo: (offset: number) => void;
  scrollToItem: (index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => void;
  getCurrentScrollOffset: () => number;
  refresh: () => void;
}

// Styled components for better performance and consistency
const VirtualizedContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isGrid'
})<{ isGrid?: boolean }>(({ theme, isGrid }) => ({
  position: 'relative',
  overflow: 'hidden',
  
  // Enhanced scrollbar styling
  '& ::-webkit-scrollbar': {
    width: 8,
    height: 8,
  },
  '& ::-webkit-scrollbar-track': {
    background: theme.palette.action.hover,
    borderRadius: 4,
  },
  '& ::-webkit-scrollbar-thumb': {
    background: theme.palette.action.selected,
    borderRadius: 4,
    '&:hover': {
      background: theme.palette.action.focus,
    },
  },
  
  // Grid-specific styles
  ...(isGrid && {
    '& > div': {
      scrollbarGutter: 'stable',
    },
  }),
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(4),
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const EmptyContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(8, 4),
  flexDirection: 'column',
  color: theme.palette.text.secondary,
}));

// Performance monitoring hook
const useVirtualizationMetrics = (itemCount: number) => {
  const [metrics, setMetrics] = useState({
    renderedItems: 0,
    domNodes: 0,
    lastRenderTime: 0,
  });

  const updateMetrics = useCallback((visibleStartIndex: number, visibleStopIndex: number) => {
    const renderedItems = visibleStopIndex - visibleStartIndex + 1;
    setMetrics(prev => ({
      ...prev,
      renderedItems,
      domNodes: renderedItems, // Approximation
      lastRenderTime: Date.now(),
    }));
  }, []);

  return { metrics, updateMetrics };
};

export const VirtualizedList = forwardRef<VirtualizedListRef, VirtualizedListProps>(({
  items,
  itemHeight = 50,
  height,
  width = '100%',
  renderItem,
  onScroll,
  onItemsRendered,
  hasNextPage = false,
  isNextPageLoading = false,
  loadNextPage,
  isGrid = false,
  columnCount = 1,
  columnWidth = 300,
  overscanCount = 5,
  itemSize = 'fixed',
  estimatedItemSize = 50,
  itemRole = 'listitem',
  ariaLabel,
  ariaLabelledBy,
  loading = false,
  emptyMessage = 'No items to display',
  loadingMessage = 'Loading...',
  initialScrollOffset = 0,
  onScrollOffsetChange,
  className,
  itemClassName,
  containerClassName,
  ...otherProps
}, ref) => {
  const theme = useTheme();
  const listRef = useRef<any>(null);
  const gridRef = useRef<any>(null);
  const { metrics, updateMetrics } = useVirtualizationMetrics(items.length);
  
  // Track visible items for accessibility
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());

  // Calculate item height for variable size lists
  const getItemHeight = useCallback((index: number): number => {
    if (typeof itemHeight === 'function') {
      return itemHeight(index);
    }
    if (items[index]?.height) {
      return items[index].height!;
    }
    return itemHeight as number;
  }, [itemHeight, items]);

  // Enhanced item renderer with visibility tracking
  const itemRenderer = useCallback(({ index, style, ...props }: any) => {
    const item = items[index];
    if (!item) return null;

    // Track visibility for accessibility
    const isVisible = visibleItems.has(index);
    
    return (
      <div
        style={style}
        role={itemRole}
        aria-rowindex={index + 1}
        className={itemClassName}
        {...props}
      >
        {renderItem({
          index,
          style: { ...style, padding: 0 }, // Remove padding from style for inner content
          data: item,
          isVisible,
        })}
      </div>
    );
  }, [items, renderItem, itemRole, itemClassName, visibleItems]);

  // Grid item renderer
  const gridItemRenderer = useCallback(({ columnIndex, rowIndex, style, ...props }: any) => {
    const index = rowIndex * columnCount + columnIndex;
    const item = items[index];
    
    if (!item) return null;

    const isVisible = visibleItems.has(index);
    
    return (
      <div
        style={style}
        role="gridcell"
        aria-colindex={columnIndex + 1}
        aria-rowindex={rowIndex + 1}
        className={itemClassName}
        {...props}
      >
        {renderItem({
          index,
          style: { ...style, padding: 0 },
          data: item,
          isVisible,
        })}
      </div>
    );
  }, [items, renderItem, columnCount, itemClassName, visibleItems]);

  // Enhanced scroll handler with metrics and restoration
  const handleScroll = useCallback((scrollProps: ListOnScrollProps) => {
    onScroll?.(scrollProps);
    onScrollOffsetChange?.(scrollProps.scrollOffset);
  }, [onScroll, onScrollOffsetChange]);

  // Enhanced items rendered handler with visibility tracking
  const handleItemsRendered = useCallback((props: any) => {
    const { visibleStartIndex, visibleStopIndex, overscanStartIndex, overscanStopIndex } = props;
    
    // Update visible items set for accessibility
    const newVisibleItems = new Set<number>();
    for (let i = visibleStartIndex; i <= visibleStopIndex; i++) {
      newVisibleItems.add(i);
    }
    setVisibleItems(newVisibleItems);
    
    // Update performance metrics
    updateMetrics(visibleStartIndex, visibleStopIndex);
    
    onItemsRendered?.(props);
  }, [onItemsRendered, updateMetrics]);

  // Infinite loading integration
  const itemCount = hasNextPage ? items.length + 1 : items.length;
  const isItemLoaded = useCallback((index: number) => !!items[index], [items]);
  
  const loadMoreItems = useCallback(async (startIndex: number, stopIndex: number) => {
    if (loadNextPage && !isNextPageLoading) {
      await loadNextPage();
    }
  }, [loadNextPage, isNextPageLoading]);

  // Imperative API
  useImperativeHandle(ref, () => ({
    scrollTo: (offset: number) => {
      if (isGrid) {
        gridRef.current?.scrollTo({ scrollTop: offset });
      } else {
        listRef.current?.scrollTo(offset);
      }
    },
    scrollToItem: (index: number, align = 'auto') => {
      if (isGrid) {
        const rowIndex = Math.floor(index / columnCount);
        gridRef.current?.scrollToItem({ rowIndex, columnIndex: 0, align });
      } else {
        listRef.current?.scrollToItem(index, align);
      }
    },
    getCurrentScrollOffset: () => {
      // This would need to be tracked in state for accurate values
      return 0;
    },
    refresh: () => {
      if (isGrid) {
        gridRef.current?.resetAfterIndices({ rowIndex: 0, columnIndex: 0 });
      } else {
        listRef.current?.resetAfterIndex(0);
      }
    },
  }), [isGrid, columnCount]);

  // Loading state
  if (loading) {
    return (
      <VirtualizedContainer className={containerClassName} style={{ height, width }}>
        <LoadingContainer>
          <CircularProgress size={40} />
          <Typography variant="body2" color="textSecondary">
            {loadingMessage}
          </Typography>
        </LoadingContainer>
      </VirtualizedContainer>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <VirtualizedContainer className={containerClassName} style={{ height, width }}>
        <EmptyContainer>
          <Typography variant="h6" color="textSecondary">
            {emptyMessage}
          </Typography>
        </EmptyContainer>
      </VirtualizedContainer>
    );
  }

  // Calculate grid dimensions
  const rowCount = isGrid ? Math.ceil(items.length / columnCount) : 0;

  const commonProps = {
    height,
    width,
    onScroll: handleScroll,
    onItemsRendered: handleItemsRendered,
    overscanCount,
    initialScrollOffset,
    className,
    role: isGrid ? 'grid' : 'list',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-rowcount': isGrid ? rowCount : items.length,
    ...otherProps,
  };

  // Render virtualized content
  const renderVirtualizedContent = () => {
    if (isGrid) {
      return (
        <Grid
          ref={gridRef}
          {...commonProps}
          columnCount={columnCount}
          columnWidth={columnWidth}
          rowCount={rowCount}
          rowHeight={typeof itemHeight === 'function' ? itemHeight : itemHeight as number}
          aria-colcount={columnCount}
        >
          {gridItemRenderer}
        </Grid>
      );
    }

    // Choose between fixed and variable size lists
    const ListComponent = itemSize === 'variable' ? VariableList : List;
    const sizeProps = itemSize === 'variable' 
      ? { itemSize: getItemHeight, estimatedItemSize }
      : { itemSize: itemHeight as number };

    return (
      <ListComponent
        ref={listRef}
        {...commonProps}
        {...sizeProps}
        itemCount={itemCount}
        itemData={items}
      >
        {itemRenderer}
      </ListComponent>
    );
  };

  return (
    <VirtualizedContainer 
      className={containerClassName} 
      isGrid={isGrid}
      style={{ height, width }}
    >
      {hasNextPage && loadNextPage ? (
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
        >
          {({ onItemsRendered: onInfiniteItemsRendered, ref: infiniteRef }) => {
            // Merge refs and handlers for infinite loading
            const mergedRef = (el: any) => {
              infiniteRef(el);
              if (isGrid) {
                gridRef.current = el;
              } else {
                listRef.current = el;
              }
            };

            const mergedOnItemsRendered = (props: any) => {
              onInfiniteItemsRendered(props);
              handleItemsRendered(props);
            };

            if (isGrid) {
              return (
                <Grid
                  ref={mergedRef}
                  {...commonProps}
                  columnCount={columnCount}
                  columnWidth={columnWidth}
                  rowCount={rowCount}
                  rowHeight={typeof itemHeight === 'function' ? itemHeight : itemHeight as number}
                  onItemsRendered={mergedOnItemsRendered}
                  aria-colcount={columnCount}
                >
                  {gridItemRenderer}
                </Grid>
              );
            }

            const ListComponent = itemSize === 'variable' ? VariableList : List;
            const sizeProps = itemSize === 'variable' 
              ? { itemSize: getItemHeight, estimatedItemSize }
              : { itemSize: itemHeight as number };

            return (
              <ListComponent
                ref={mergedRef}
                {...commonProps}
                {...sizeProps}
                itemCount={itemCount}
                itemData={items}
                onItemsRendered={mergedOnItemsRendered}
              >
                {itemRenderer}
              </ListComponent>
            );
          }}
        </InfiniteLoader>
      ) : (
        renderVirtualizedContent()
      )}
      
      {/* Development metrics display */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: 1,
            borderRadius: 1,
            fontSize: '12px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}
        >
          <div>Items: {items.length}</div>
          <div>Rendered: {metrics.renderedItems}</div>
          <div>DOM Nodes: ~{metrics.domNodes}</div>
        </Box>
      )}
    </VirtualizedContainer>
  );
});

VirtualizedList.displayName = 'VirtualizedList';

export default VirtualizedList;
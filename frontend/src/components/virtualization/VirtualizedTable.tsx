/**
 * VirtualizedTable Component
 * Specialized virtualization for data tables with column support
 * Optimized for telemetry data, logs, and device management tables
 */

import React, { useMemo, useCallback, forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { FixedSizeGrid as Grid, GridOnScrollProps } from 'react-window';
import {
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Checkbox,
  Typography,
  useTheme,
} from '@mui/material';
import { styled } from '@mui/material/styles';

// Types for table virtualization
export interface TableColumn<T = any> {
  id: string;
  label: string;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  resizable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  getValue?: (row: T) => any;
  sticky?: 'left' | 'right';
}

export interface VirtualizedTableRow {
  id: string | number;
  data: any;
  height?: number;
  selected?: boolean;
  disabled?: boolean;
}

export interface VirtualizedTableProps {
  columns: TableColumn[];
  rows: VirtualizedTableRow[];
  height: number;
  width?: number | string;
  rowHeight?: number;
  headerHeight?: number;
  
  // Selection
  selectable?: boolean;
  selectedRows?: Set<string | number>;
  onRowSelect?: (rowId: string | number, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  
  // Sorting
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnId: string) => void;
  
  // Scrolling
  onScroll?: (props: GridOnScrollProps) => void;
  overscanRowCount?: number;
  overscanColumnCount?: number;
  
  // Loading states
  loading?: boolean;
  loadingRowCount?: number;
  
  // Row interaction
  onRowClick?: (row: VirtualizedTableRow, index: number) => void;
  onRowDoubleClick?: (row: VirtualizedTableRow, index: number) => void;
  
  // Styling
  className?: string;
  stickyHeader?: boolean;
  dense?: boolean;
  striped?: boolean;
  
  // Accessibility
  ariaLabel?: string;
  caption?: string;
}

export interface VirtualizedTableRef {
  scrollToRow: (index: number) => void;
  scrollToColumn: (index: number) => void;
  scrollTo: (scrollLeft: number, scrollTop: number) => void;
  getCurrentScroll: () => { scrollLeft: number; scrollTop: number };
}

// Styled components
const TableWrapper = styled(Box)(({ theme }) => ({
  position: 'relative',
  overflow: 'hidden',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

const VirtualTableContainer = styled(Box)(({ theme }) => ({
  '& ::-webkit-scrollbar': {
    width: 12,
    height: 12,
  },
  '& ::-webkit-scrollbar-track': {
    background: theme.palette.action.hover,
  },
  '& ::-webkit-scrollbar-thumb': {
    background: theme.palette.action.selected,
    borderRadius: 6,
    '&:hover': {
      background: theme.palette.action.focus,
    },
  },
  '& ::-webkit-scrollbar-corner': {
    background: theme.palette.action.hover,
  },
}));

const TableHeaderContainer = styled(Box)<{ stickyHeader?: boolean }>(({ theme, stickyHeader }) => ({
  borderBottom: `2px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  ...(stickyHeader && {
    position: 'sticky',
    top: 0,
    zIndex: 2,
  }),
}));

const TableCellStyled = styled(TableCell)<{ 
  dense?: boolean;
  sticky?: 'left' | 'right';
  stickyOffset?: number;
}>(({ theme, dense, sticky, stickyOffset = 0 }) => ({
  padding: dense ? theme.spacing(0.5, 1) : theme.spacing(1, 2),
  borderRight: `1px solid ${theme.palette.divider}`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  
  '&:last-child': {
    borderRight: 'none',
  },
  
  ...(sticky && {
    position: 'sticky',
    backgroundColor: theme.palette.background.paper,
    zIndex: 1,
    boxShadow: sticky === 'left' 
      ? `2px 0 4px -2px ${theme.palette.action.hover}`
      : `-2px 0 4px -2px ${theme.palette.action.hover}`,
    
    [sticky]: stickyOffset,
  }),
}));

const VirtualRow = styled(Box)<{ 
  striped?: boolean;
  selected?: boolean;
  hover?: boolean;
  index?: number;
}>(({ theme, striped, selected, hover, index }) => ({
  display: 'flex',
  alignItems: 'center',
  borderBottom: `1px solid ${theme.palette.divider}`,
  cursor: 'pointer',
  transition: theme.transitions.create(['background-color']),
  
  ...(striped && index && index % 2 === 1 && {
    backgroundColor: theme.palette.action.hover,
  }),
  
  ...(selected && {
    backgroundColor: theme.palette.action.selected,
  }),
  
  ...(hover && {
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  }),
}));

const LoadingRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.action.hover,
  animation: 'pulse 1.5s ease-in-out infinite',
  
  '@keyframes pulse': {
    '0%': {
      opacity: 1,
    },
    '50%': {
      opacity: 0.5,
    },
    '100%': {
      opacity: 1,
    },
  },
}));

export const VirtualizedTable = forwardRef<VirtualizedTableRef, VirtualizedTableProps>(({
  columns,
  rows,
  height,
  width = '100%',
  rowHeight = 52,
  headerHeight = 56,
  selectable = false,
  selectedRows = new Set(),
  onRowSelect,
  onSelectAll,
  sortBy,
  sortDirection,
  onSort,
  onScroll,
  overscanRowCount = 5,
  overscanColumnCount = 1,
  loading = false,
  loadingRowCount = 10,
  onRowClick,
  onRowDoubleClick,
  className,
  stickyHeader = true,
  dense = false,
  striped = false,
  ariaLabel,
  caption,
}, ref) => {
  const theme = useTheme();
  const gridRef = useRef<any>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  // Calculate sticky column offsets
  const stickyOffsets = useMemo(() => {
    const leftOffsets = new Map<string, number>();
    const rightOffsets = new Map<string, number>();
    
    let leftOffset = selectable ? 48 : 0; // Checkbox column width
    let rightOffset = 0;
    
    columns.forEach((column) => {
      if (column.sticky === 'left') {
        leftOffsets.set(column.id, leftOffset);
        leftOffset += column.width;
      }
    });
    
    // Calculate right offsets in reverse
    for (let i = columns.length - 1; i >= 0; i--) {
      const column = columns[i];
      if (column.sticky === 'right') {
        rightOffsets.set(column.id, rightOffset);
        rightOffset += column.width;
      }
    }
    
    return { left: leftOffsets, right: rightOffsets };
  }, [columns, selectable]);

  // Calculate total width
  const totalWidth = useMemo(() => {
    const columnsWidth = columns.reduce((sum, col) => sum + col.width, 0);
    return columnsWidth + (selectable ? 48 : 0);
  }, [columns, selectable]);

  // Enhanced cell renderer
  const cellRenderer = useCallback(({ columnIndex, rowIndex, style }: any) => {
    const adjustedColumnIndex = selectable ? columnIndex - 1 : columnIndex;
    
    // Render selection checkbox
    if (selectable && columnIndex === 0) {
      const row = rows[rowIndex];
      if (!row && loading) {
        return (
          <div style={style}>
            <LoadingRow style={{ height: rowHeight }}>
              <Checkbox disabled />
            </LoadingRow>
          </div>
        );
      }
      
      if (!row) return null;
      
      return (
        <div style={style}>
          <TableCellStyled
            dense={dense}
            sticky="left"
            stickyOffset={0}
            style={{ 
              width: 48, 
              height: rowHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Checkbox
              checked={selectedRows.has(row.id)}
              onChange={(e) => onRowSelect?.(row.id, e.target.checked)}
              size={dense ? 'small' : 'medium'}
              disabled={row.disabled}
            />
          </TableCellStyled>
        </div>
      );
    }
    
    const column = columns[adjustedColumnIndex];
    const row = rows[rowIndex];
    
    if (!column) return null;
    
    // Loading state
    if (!row && loading) {
      return (
        <div style={style}>
          <LoadingRow style={{ height: rowHeight, width: column.width }}>
            <Box
              sx={{
                width: '60%',
                height: 16,
                backgroundColor: 'action.hover',
                borderRadius: 1,
              }}
            />
          </LoadingRow>
        </div>
      );
    }
    
    if (!row) return null;
    
    const cellValue = column.getValue ? column.getValue(row.data) : row.data[column.id];
    const stickyOffset = column.sticky 
      ? stickyOffsets[column.sticky].get(column.id) || 0
      : undefined;
    
    return (
      <div style={style}>
        <TableCellStyled
          dense={dense}
          sticky={column.sticky}
          stickyOffset={stickyOffset}
          align={column.align}
          style={{ 
            width: column.width, 
            height: rowHeight,
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={() => setHoveredRow(rowIndex)}
          onMouseLeave={() => setHoveredRow(null)}
          onClick={() => onRowClick?.(row, rowIndex)}
          onDoubleClick={() => onRowDoubleClick?.(row, rowIndex)}
        >
          {column.render ? column.render(cellValue, row.data, rowIndex) : cellValue}
        </TableCellStyled>
      </div>
    );
  }, [
    columns, 
    rows, 
    selectable, 
    selectedRows, 
    onRowSelect, 
    dense, 
    rowHeight, 
    loading,
    stickyOffsets,
    onRowClick,
    onRowDoubleClick,
  ]);

  // Render table header
  const renderTableHeader = () => (
    <TableHeaderContainer stickyHeader={stickyHeader}>
      <TableRow style={{ height: headerHeight }}>
        {selectable && (
          <TableCellStyled
            dense={dense}
            sticky="left"
            stickyOffset={0}
            style={{ width: 48 }}
          >
            <Checkbox
              indeterminate={selectedRows.size > 0 && selectedRows.size < rows.length}
              checked={rows.length > 0 && selectedRows.size === rows.length}
              onChange={(e) => onSelectAll?.(e.target.checked)}
              size={dense ? 'small' : 'medium'}
            />
          </TableCellStyled>
        )}
        {columns.map((column) => {
          const stickyOffset = column.sticky 
            ? stickyOffsets[column.sticky].get(column.id) || 0
            : undefined;
            
          return (
            <TableCellStyled
              key={column.id}
              dense={dense}
              sticky={column.sticky}
              stickyOffset={stickyOffset}
              align={column.align}
              style={{ width: column.width }}
              onClick={() => column.sortable && onSort?.(column.id)}
              sx={{
                cursor: column.sortable ? 'pointer' : 'default',
                userSelect: 'none',
                fontWeight: 'bold',
                ...(column.sortable && {
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {column.label}
                {column.sortable && sortBy === column.id && (
                  <Typography variant="caption">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </Typography>
                )}
              </Box>
            </TableCellStyled>
          );
        })}
      </TableRow>
    </TableHeaderContainer>
  );

  // Imperative API
  useImperativeHandle(ref, () => ({
    scrollToRow: (index: number) => {
      gridRef.current?.scrollToItem({ rowIndex: index, columnIndex: 0 });
    },
    scrollToColumn: (index: number) => {
      gridRef.current?.scrollToItem({ rowIndex: 0, columnIndex: index });
    },
    scrollTo: (scrollLeft: number, scrollTop: number) => {
      gridRef.current?.scrollTo({ scrollLeft, scrollTop });
    },
    getCurrentScroll: () => {
      // This would need to be tracked in state for accurate values
      return { scrollLeft: 0, scrollTop: 0 };
    },
  }), []);

  const itemCount = loading ? Math.max(rows.length, loadingRowCount) : rows.length;
  const columnCount = columns.length + (selectable ? 1 : 0);

  return (
    <TableWrapper className={className}>
      {caption && (
        <Typography variant="caption" component="caption" sx={{ p: 1 }}>
          {caption}
        </Typography>
      )}
      
      {renderTableHeader()}
      
      <VirtualTableContainer style={{ height: height - headerHeight }}>
        <Grid
          ref={gridRef}
          height={height - headerHeight}
          width={typeof width === 'string' ? '100%' : width}
          columnCount={columnCount}
          columnWidth={(index) => {
            if (selectable && index === 0) return 48;
            const adjustedIndex = selectable ? index - 1 : index;
            return columns[adjustedIndex]?.width || 100;
          }}
          rowCount={itemCount}
          rowHeight={rowHeight}
          onScroll={onScroll}
          overscanRowCount={overscanRowCount}
          overscanColumnCount={overscanColumnCount}
          role="grid"
          aria-label={ariaLabel}
          aria-rowcount={itemCount}
          aria-colcount={columnCount}
        >
          {cellRenderer}
        </Grid>
      </VirtualTableContainer>
      
      {/* Performance metrics for development */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
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
          <div>Rows: {rows.length}</div>
          <div>Columns: {columns.length}</div>
          <div>Total Width: {totalWidth}px</div>
        </Box>
      )}
    </TableWrapper>
  );
});

VirtualizedTable.displayName = 'VirtualizedTable';

export default VirtualizedTable;
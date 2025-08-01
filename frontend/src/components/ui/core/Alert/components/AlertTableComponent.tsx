/**
 * AlertTableComponent
 * Table component for displaying tabular data in alerts with sorting and search
 */

import React, { useState, useMemo, useCallback } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { TableContent, RichContentConfig } from '../types/RichContentTypes';

interface AlertTableComponentProps {
  content: TableContent;
  config: RichContentConfig;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onInteraction?: (action: string, data?: any) => void;
}

const TableContainer = styled.div<{ 
  theme: Theme;
  constraints?: TableContent['constraints'];
}>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.background.paper};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  
  /* Apply constraints */
  ${({ constraints }) => constraints && css`
    max-width: ${constraints.maxWidth || '100%'};
    max-height: ${constraints.maxHeight || 'none'};
    
    /* Mobile responsive */
    @media (max-width: 768px) {
      ${constraints.mobile?.maxWidth && css`
        max-width: ${constraints.mobile.maxWidth};
      `}
      ${constraints.mobile?.maxHeight && css`
        max-height: ${constraints.mobile.maxHeight};
      `}
      ${constraints.mobile?.hide && css`
        display: none;
      `}
    }
  `}
`;

const TableControls = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.background.elevated};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    gap: ${({ theme }) => theme.spacing[2]};
  }
`;

const SearchInput = styled.input<{ theme: Theme }>`
  flex: 1;
  min-width: 200px;
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.background.paper};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary.main};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary.main}20;
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.text.secondary};
  }
`;

const TableInfo = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  white-space: nowrap;
`;

const TableWrapper = styled.div<{ theme: Theme; hasMaxHeight: boolean }>`
  ${({ hasMaxHeight }) => hasMaxHeight && css`
    overflow: auto;
    max-height: 400px;
    
    /* Custom scrollbar */
    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    &::-webkit-scrollbar-track {
      background: ${({ theme }) => theme.colors.background.elevated};
    }
    
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.text.secondary}40;
      border-radius: 4px;
      
      &:hover {
        background: ${({ theme }) => theme.colors.text.secondary}60;
      }
    }
  `}
`;

const Table = styled.table<{ theme: Theme }>`
  width: 100%;
  border-collapse: collapse;
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const TableHead = styled.thead<{ theme: Theme }>`
  background: ${({ theme }) => theme.colors.background.elevated};
  position: sticky;
  top: 0;
  z-index: 1;
`;

const TableHeaderCell = styled.th<{ 
  theme: Theme; 
  sortable: boolean;
  sorted?: 'asc' | 'desc' | null;
  align: 'left' | 'center' | 'right';
}>`
  padding: ${({ theme }) => theme.spacing[3]};
  text-align: ${({ align }) => align};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  border-bottom: 2px solid ${({ theme }) => theme.colors.divider};
  user-select: none;
  position: relative;
  
  ${({ sortable }) => sortable && css`
    cursor: pointer;
    transition: background-color 0.2s ease;
    
    &:hover {
      background-color: ${({ theme }) => theme.colors.background.paper};
    }
    
    &:focus {
      outline: 2px solid ${({ theme }) => theme.colors.primary.main};
      outline-offset: -2px;
    }
  `}
  
  ${({ sorted, theme }) => sorted && css`
    background-color: ${theme.colors.primary.main}10;
    
    &::after {
      content: "";
      position: absolute;
      right: ${theme.spacing[2]};
      top: 50%;
      transform: translateY(-50%);
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      
      ${sorted === 'asc' && css`
        border-bottom: 6px solid ${theme.colors.text.primary};
      `}
      
      ${sorted === 'desc' && css`
        border-top: 6px solid ${theme.colors.text.primary};
      `}
    }
  `}
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border-bottom-width: 3px;
  }
`;

const TableBody = styled.tbody<{ theme: Theme }>``;

const TableRow = styled.tr<{ theme: Theme; loading?: boolean }>`
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.background.elevated}50;
  }
  
  &:nth-of-type(even) {
    background-color: ${({ theme }) => theme.colors.background.elevated}20;
  }
  
  ${({ loading, theme }) => loading && css`
    opacity: 0.6;
    pointer-events: none;
    
    &::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      width: 16px;
      height: 16px;
      margin: -8px 0 0 -8px;
      border: 2px solid ${theme.colors.text.secondary}30;
      border-top: 2px solid ${theme.colors.text.secondary};
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `}
`;

const TableCell = styled.td<{ 
  theme: Theme; 
  align: 'left' | 'center' | 'right';
}>`
  padding: ${({ theme }) => theme.spacing[3]};
  text-align: ${({ align }) => align};
  color: ${({ theme }) => theme.colors.text.primary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  vertical-align: top;
  word-wrap: break-word;
  max-width: 300px; /* Prevent very wide cells */
`;

const EmptyState = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[3]};  
  padding: ${({ theme }) => theme.spacing[8]};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  
  .empty-icon {
    width: 48px;
    height: 48px;
    opacity: 0.5;
    fill: currentColor;
  }
`;

const LoadingOverlay = styled.div<{ theme: Theme; show: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${({ theme }) => theme.colors.background.paper}90;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${({ show }) => show ? 1 : 0};
  visibility: ${({ show }) => show ? 'visible' : 'hidden'};
  transition: all 0.2s ease;
  z-index: 10;
  
  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid ${({ theme }) => theme.colors.text.secondary}30;
    border-top: 3px solid ${({ theme }) => theme.colors.primary.main};
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export const AlertTableComponent: React.FC<AlertTableComponentProps> = ({
  content,
  config,
  onLoad,
  onError,
  onInteraction
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = content.data;

    // Apply search filter
    if (searchTerm && content.searchable !== false) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(search)
        )
      );
    }

    // Apply sorting
    if (sortColumn && content.sortable !== false) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];
        
        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
        if (bValue == null) return sortDirection === 'asc' ? 1 : -1;
        
        // Compare values
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply max rows limit
    if (content.maxRows && filtered.length > content.maxRows) {
      filtered = filtered.slice(0, content.maxRows);
    }

    return filtered;
  }, [content.data, content.searchable, content.sortable, content.maxRows, searchTerm, sortColumn, sortDirection]);

  // Handle column header click (sorting)
  const handleColumnClick = useCallback((columnId: string, sortable: boolean) => {
    if (!sortable || content.sortable === false) return;

    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }

    onInteraction?.('table-sort', { 
      column: columnId, 
      direction: sortColumn === columnId ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'
    });
  }, [sortColumn, sortDirection, content.sortable, onInteraction]);

  // Handle search
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    onInteraction?.('table-search', { term: value, results: processedData.length });
  }, [processedData.length, onInteraction]);

  // Load callback
  React.useEffect(() => {
    onLoad?.();
  }, [onLoad]);

  // Render cell content
  const renderCellContent = (column: any, value: any, row: any) => {
    if (column.render) {
      try {
        return column.render(value, row);
      } catch (error) {
        return String(value || '');
      }
    }
    return String(value || '');
  };

  return (
    <TableContainer
      constraints={content.constraints}
      className={content.className}
      data-testid={content.testId || `table-${content.id}`}
    >
      {/* Controls */}
      {(content.searchable !== false || content.data.length > 0) && (
        <TableControls>
          {/* Search */}
          {content.searchable !== false && (
            <SearchInput
              type="text"
              placeholder="Search table..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              aria-label="Search table data"
            />
          )}
          
          {/* Info */}
          <TableInfo>
            {processedData.length !== content.data.length && (
              <span>{processedData.length} of {content.data.length} rows</span>
            )}
            {processedData.length === content.data.length && content.data.length > 0 && (
              <span>{content.data.length} rows</span>
            )}
            {content.maxRows && content.data.length > content.maxRows && (
              <span>(limited to {content.maxRows})</span>
            )}
          </TableInfo>
        </TableControls>
      )}

      {/* Table */}
      <TableWrapper hasMaxHeight={Boolean(content.constraints?.maxHeight)}>
        <div style={{ position: 'relative' }}>
          <Table role="table" aria-label={content.ariaLabel}>
            {/* Header */}
            <TableHead>
              <tr>
                {content.columns.map(column => (
                  <TableHeaderCell
                    key={column.id}
                    sortable={column.sortable !== false && content.sortable !== false}
                    sorted={sortColumn === column.id ? sortDirection : null}
                    align={column.align || 'left'}
                    style={{ width: column.width }}
                    onClick={() => handleColumnClick(column.id, column.sortable !== false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleColumnClick(column.id, column.sortable !== false);
                      }
                    }}
                    tabIndex={column.sortable !== false && content.sortable !== false ? 0 : -1}
                    role="columnheader"
                    aria-sort={
                      sortColumn === column.id 
                        ? sortDirection === 'asc' ? 'ascending' : 'descending'
                        : 'none'
                    }
                  >
                    {column.label}
                  </TableHeaderCell>
                ))}
              </tr>
            </TableHead>

            {/* Body */}
            <TableBody>
              {processedData.map((row, rowIndex) => (
                <TableRow
                  key={`row-${rowIndex}`}
                  loading={content.loading}
                  onClick={() => onInteraction?.('table-row-click', { row, index: rowIndex })}
                >
                  {content.columns.map(column => (
                    <TableCell
                      key={`cell-${rowIndex}-${column.id}`}
                      align={column.align || 'left'}
                      role="cell"
                    >
                      {renderCellContent(column, row[column.id], row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Empty state */}
          {processedData.length === 0 && !content.loading && (
            <EmptyState>
              <svg className="empty-icon" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
              <div>
                {searchTerm 
                  ? `No results found for "${searchTerm}"`
                  : (content.emptyMessage || 'No data available')
                }
              </div>
            </EmptyState>
          )}

          {/* Loading overlay */}
          <LoadingOverlay show={Boolean(content.loading)}>
            <div className="loading-spinner" />
          </LoadingOverlay>
        </div>
      </TableWrapper>
    </TableContainer>
  );
};
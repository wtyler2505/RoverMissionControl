/**
 * Drill-down Breadcrumb Navigation
 * Provides hierarchical navigation for drill-down interactions
 */

import React from 'react';
import styled from 'styled-components';
import { Breadcrumbs, Link, Typography, Chip } from '@mui/material';
import { NavigateNext as NavigateNextIcon, Home as HomeIcon } from '@mui/icons-material';

const BreadcrumbContainer = styled.div`
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  padding: 8px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  max-width: 600px;
  
  @media (prefers-color-scheme: dark) {
    background: rgba(42, 42, 42, 0.95);
    border-color: #444;
  }
`;

interface DrillDownBreadcrumbProps {
  path: Array<{
    id: string;
    label: string;
    data?: any;
  }>;
  onNavigate: (level: number) => void;
  renderer?: (path: Array<{ id: string; label: string; data?: any }>) => React.ReactNode;
}

export const DrillDownBreadcrumb: React.FC<DrillDownBreadcrumbProps> = ({
  path,
  onNavigate,
  renderer
}) => {
  // Use custom renderer if provided
  if (renderer) {
    return <>{renderer(path)}</>;
  }

  // Default breadcrumb renderer
  return (
    <BreadcrumbContainer>
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        maxItems={4}
        itemsAfterCollapse={2}
        itemsBeforeCollapse={2}
      >
        {/* Home/Root level */}
        <Link
          component="button"
          variant="body2"
          onClick={() => onNavigate(0)}
          underline="hover"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'inherit',
            '&:hover': {
              color: 'primary.main'
            }
          }}
        >
          <HomeIcon fontSize="small" />
          Overview
        </Link>

        {/* Path items */}
        {path.map((item, index) => {
          const isLast = index === path.length - 1;
          
          if (isLast) {
            return (
              <Typography
                key={item.id}
                variant="body2"
                color="text.primary"
                sx={{ fontWeight: 500 }}
              >
                {item.label}
              </Typography>
            );
          }

          return (
            <Link
              key={item.id}
              component="button"
              variant="body2"
              onClick={() => onNavigate(index + 1)}
              underline="hover"
              sx={{
                color: 'inherit',
                '&:hover': {
                  color: 'primary.main'
                }
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </Breadcrumbs>
    </BreadcrumbContainer>
  );
};

/**
 * Alternative breadcrumb style with chips
 */
export const ChipBreadcrumb: React.FC<DrillDownBreadcrumbProps> = ({
  path,
  onNavigate
}) => {
  return (
    <BreadcrumbContainer>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip
          icon={<HomeIcon />}
          label="Overview"
          onClick={() => onNavigate(0)}
          size="small"
          variant="outlined"
          sx={{ cursor: 'pointer' }}
        />
        
        {path.map((item, index) => (
          <React.Fragment key={item.id}>
            <NavigateNextIcon fontSize="small" color="action" />
            <Chip
              label={item.label}
              onClick={() => onNavigate(index + 1)}
              size="small"
              variant={index === path.length - 1 ? 'filled' : 'outlined'}
              color={index === path.length - 1 ? 'primary' : 'default'}
              sx={{ cursor: index === path.length - 1 ? 'default' : 'pointer' }}
              disabled={index === path.length - 1}
            />
          </React.Fragment>
        ))}
      </div>
    </BreadcrumbContainer>
  );
};
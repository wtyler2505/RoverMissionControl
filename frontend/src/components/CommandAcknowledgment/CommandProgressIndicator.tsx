import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
  Fade,
  Zoom,
  useTheme
} from '@mui/material';
import { keyframes } from '@mui/system';
import { AcknowledgmentProgress } from '../../services/acknowledgment.service';

interface CommandProgressIndicatorProps {
  progress: number;
  message?: string;
  variant?: 'circular' | 'linear' | 'combined';
  size?: 'small' | 'medium' | 'large';
  showPercentage?: boolean;
  animated?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  thickness?: number;
}

const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const sizeConfig = {
  small: {
    circular: 40,
    linear: 4,
    fontSize: '0.75rem'
  },
  medium: {
    circular: 60,
    linear: 8,
    fontSize: '0.875rem'
  },
  large: {
    circular: 80,
    linear: 12,
    fontSize: '1rem'
  }
};

export const CommandProgressIndicator: React.FC<CommandProgressIndicatorProps> = ({
  progress,
  message,
  variant = 'circular',
  size = 'medium',
  showPercentage = true,
  animated = true,
  color = 'primary',
  thickness = 4
}) => {
  const theme = useTheme();
  const [displayProgress, setDisplayProgress] = useState(0);
  const animationRef = useRef<number>();
  const config = sizeConfig[size];

  useEffect(() => {
    // Animate progress changes
    if (animated) {
      const startProgress = displayProgress;
      const targetProgress = Math.min(100, Math.max(0, progress * 100));
      const duration = 300; // ms
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out-cubic)
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentProgress = startProgress + (targetProgress - startProgress) * eased;
        
        setDisplayProgress(currentProgress);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      setDisplayProgress(progress * 100);
    }
  }, [progress, animated]);

  const renderCircularProgress = () => (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={displayProgress}
        size={config.circular}
        thickness={thickness}
        color={color}
        sx={{
          ...(animated && displayProgress > 0 && displayProgress < 100 && {
            animation: `${pulse} 2s ease-in-out infinite`
          })
        }}
      />
      {showPercentage && (
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="caption"
            component="div"
            color="text.secondary"
            sx={{ fontSize: config.fontSize }}
          >
            {`${Math.round(displayProgress)}%`}
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderLinearProgress = () => (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: '100%', mr: 1 }}>
          <LinearProgress
            variant="determinate"
            value={displayProgress}
            color={color}
            sx={{
              height: config.linear,
              borderRadius: config.linear / 2,
              ...(animated && displayProgress > 0 && displayProgress < 100 && {
                '& .MuiLinearProgress-bar': {
                  background: `linear-gradient(
                    90deg,
                    ${theme.palette[color].main} 0%,
                    ${theme.palette[color].light} 50%,
                    ${theme.palette[color].main} 100%
                  )`,
                  backgroundSize: '200% 100%',
                  animation: `${shimmer} 2s linear infinite`
                }
              })
            }}
          />
        </Box>
        {showPercentage && (
          <Box sx={{ minWidth: 35 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: config.fontSize }}
            >
              {`${Math.round(displayProgress)}%`}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  const renderCombinedProgress = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {renderCircularProgress()}
      <Box sx={{ width: '100%', maxWidth: 200 }}>
        {renderLinearProgress()}
      </Box>
    </Box>
  );

  const getProgressComponent = () => {
    switch (variant) {
      case 'circular':
        return renderCircularProgress();
      case 'linear':
        return renderLinearProgress();
      case 'combined':
        return renderCombinedProgress();
      default:
        return renderCircularProgress();
    }
  };

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Fade in={true} timeout={300}>
        <Box>
          {getProgressComponent()}
          
          {message && (
            <Zoom in={!!message} timeout={200}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 1,
                  fontSize: config.fontSize,
                  fontStyle: 'italic'
                }}
              >
                {message}
              </Typography>
            </Zoom>
          )}
        </Box>
      </Fade>
    </Box>
  );
};

interface MultiStepProgressProps {
  steps: Array<{
    id: string;
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
    progress?: number;
    message?: string;
  }>;
  orientation?: 'horizontal' | 'vertical';
}

export const MultiStepProgress: React.FC<MultiStepProgressProps> = ({
  steps,
  orientation = 'vertical'
}) => {
  const theme = useTheme();

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return theme.palette.success.main;
      case 'active':
        return theme.palette.primary.main;
      case 'error':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[400];
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        gap: 2,
        width: '100%'
      }}
    >
      {steps.map((step, index) => (
        <Box
          key={step.id}
          sx={{
            display: 'flex',
            flexDirection: orientation === 'vertical' ? 'row' : 'column',
            alignItems: orientation === 'vertical' ? 'flex-start' : 'center',
            gap: 1,
            flex: orientation === 'horizontal' ? 1 : 'none',
            position: 'relative'
          }}
        >
          {/* Step indicator */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: getStepColor(step.status),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.875rem',
              transition: 'all 0.3s ease',
              ...(step.status === 'active' && {
                animation: `${pulse} 2s ease-in-out infinite`
              })
            }}
          >
            {step.status === 'completed' ? '✓' : index + 1}
          </Box>

          {/* Step content */}
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: step.status === 'active' ? 'bold' : 'normal',
                color: step.status === 'error' ? 'error.main' : 'text.primary'
              }}
            >
              {step.label}
            </Typography>
            
            {step.status === 'active' && step.progress !== undefined && (
              <Box sx={{ mt: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={step.progress * 100}
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>
            )}
            
            {step.message && (
              <Typography variant="caption" color="text.secondary">
                {step.message}
              </Typography>
            )}
          </Box>

          {/* Connector line */}
          {index < steps.length - 1 && (
            <Box
              sx={{
                position: 'absolute',
                ...(orientation === 'vertical' ? {
                  left: 15,
                  top: 40,
                  width: 2,
                  height: 'calc(100% + 8px)',
                } : {
                  top: 15,
                  left: 'calc(50% + 20px)',
                  height: 2,
                  width: 'calc(100% - 40px)',
                }),
                bgcolor: index < steps.findIndex(s => s.status === 'active' || s.status === 'pending')
                  ? theme.palette.success.main
                  : theme.palette.grey[300],
                transition: 'background-color 0.3s ease'
              }}
            />
          )}
        </Box>
      ))}
    </Box>
  );
};
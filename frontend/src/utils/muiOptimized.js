/**
 * Optimized Material-UI imports for tree shaking
 * Import only the components we actually use
 */

// Core components (essential)
export {
  Button,
  TextField,
  Typography,
  Paper,
  Card,
  CardContent,
  CardActions,
  Box,
  Container
} from '@mui/material';

// Layout components
export {
  Grid,
  Stack,
  Divider,
  Toolbar,
  AppBar
} from '@mui/material';

// Input components (commonly used)
export {
  IconButton,
  Checkbox,
  Radio,
  Switch,
  Slider,
  Select,
  MenuItem,
  FormControl,
  FormLabel,
  FormControlLabel
} from '@mui/material';

// Feedback components
export {
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  LinearProgress
} from '@mui/material';

// Navigation
export {
  Tabs,
  Tab,
  Breadcrumbs,
  Link
} from '@mui/material';

// Theme and styling
export {
  ThemeProvider,
  createTheme,
  styled,
  useTheme
} from '@mui/material/styles';

// Icons (selective import)
export {
  PlayArrow,
  Pause,
  Stop,
  Settings,
  Warning,
  Error,
  CheckCircle,
  Info,
  Close,
  ExpandMore,
  ChevronLeft,
  ChevronRight
} from '@mui/icons-material';

// Optimized theme configuration
export const createOptimizedTheme = (mode = 'light') => createTheme({
  palette: {
    mode,
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
    success: {
      main: '#4caf50',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 300 },
    h2: { fontSize: '2rem', fontWeight: 300 },
    h3: { fontSize: '1.75rem', fontWeight: 400 },
    h4: { fontSize: '1.5rem', fontWeight: 400 },
    h5: { fontSize: '1.25rem', fontWeight: 400 },
    h6: { fontSize: '1rem', fontWeight: 500 },
    body1: { fontSize: '1rem', fontWeight: 400 },
    body2: { fontSize: '0.875rem', fontWeight: 400 }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});
/**
 * Optimized Chart.js imports for tree shaking
 * Reduces bundle size by importing only necessary Chart.js components
 */

// Core Chart.js components (essential)
export {
  Chart as ChartJS,
  registerables
} from 'chart.js';

// Scales (commonly used)
export {
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  TimeScale,
  RadialLinearScale
} from 'chart.js';

// Elements (essential)
export {
  PointElement,
  LineElement,
  BarElement,
  ArcElement
} from 'chart.js';

// Plugins (commonly used)
export {
  Title,
  Tooltip,
  Legend,
  Filler,
  SubTitle
} from 'chart.js';

// Chart types we actually use
export {
  Line,
  Bar,
  Doughnut,
  Scatter
} from 'react-chartjs-2';

// D3 selective imports (only what we need)
export {
  select,
  selectAll,
  scaleLinear,
  scaleTime,
  axisBottom,
  axisLeft,
  line,
  area,
  extent,
  max,
  min
} from 'd3';

// Optimized chart configuration
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register only essential components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export { ChartJS };

// Optimized chart defaults
export const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: false
    },
    tooltip: {
      enabled: true,
      intersect: false,
      mode: 'index'
    }
  },
  scales: {
    x: {
      display: true,
      grid: {
        display: false
      }
    },
    y: {
      display: true,
      grid: {
        display: true,
        color: 'rgba(0,0,0,0.1)'
      }
    }
  },
  elements: {
    point: {
      radius: 3,
      hoverRadius: 5
    },
    line: {
      tension: 0.1
    }
  }
};
// Modules index for lazy loading
import { lazy } from 'react';

// Lazy load all major modules for code splitting
export const Dashboard = lazy(() => import('./Dashboard'));
export const IDE = lazy(() => import('./IDE'));
export const Project = lazy(() => import('./Project'));
export const Knowledge = lazy(() => import('./Knowledge'));
export const AIAssistant = lazy(() => import('./AIAssistant'));

// Also export the D3Demo component
export const D3Demo = lazy(() => import('../D3Test/D3Demo'));
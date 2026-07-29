import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0f9b8e' },
    secondary: { main: '#0dbfb0' },
    background: { default: '#f5f5f5', paper: '#ffffff' },
    text: { primary: '#1a1a2e', secondary: '#6b6b80' },
    error: { main: '#e74c3c' },
    success: { main: '#2ecc71' },
    warning: { main: '#f39c12' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: '1px solid #e0e0e0', backgroundColor: '#ffffff' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#0f9b8e' },
    secondary: { main: '#0dbfb0' },
    background: { default: '#1a1a2e', paper: '#1e2a4a' },
    text: { primary: '#e8e8e8', secondary: '#a0a0b0' },
    error: { main: '#e74c3c' },
    success: { main: '#2ecc71' },
    warning: { main: '#f39c12' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: '1px solid #2a3a5a', backgroundColor: '#16213e' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
  },
});

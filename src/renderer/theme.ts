import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#9e9e9e' },
    secondary: { main: '#607d8b' },
    divider: '#BDBDBD',
    background: { default: '#f5f5f5', paper: '#ffffff' },
    text: { primary: '#212121', secondary: '#757575' },
    error: { main: '#e74c3c' },
    success: { main: '#2ecc71' },
    warning: { main: '#f39c12' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial",sans-serif' },
  shape: { borderRadius: 8 },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: '1px solid #BDBDBD', backgroundColor: '#ffffff' },
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
    primary: { main: '#9e9e9e' },
    secondary: { main: '#607d8b' },
    divider: '#757575',
    background: { default: '#616161', paper: '#6d6d6d' },
    text: { primary: '#f5f5f5', secondary: '#BDBDBD' },
    error: { main: '#e74c3c' },
    success: { main: '#2ecc71' },
    warning: { main: '#f39c12' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial",sans-serif' },
  shape: { borderRadius: 8 },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: '1px solid #757575', backgroundColor: '#616161' },
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

import { createTheme } from '@mui/material/styles';

// Dark theme by default. See EDITOR_LEAD.md - we ship a single code-editor
// palette instead of offering a toggle.
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#7c5cff' },
    secondary: { main: '#00d1b2' },
    background: {
      default: '#0f1117',
      paper: '#161923',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    fontSize: 14,
  },
  shape: { borderRadius: 10 },
});

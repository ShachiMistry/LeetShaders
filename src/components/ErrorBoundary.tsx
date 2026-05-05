import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useThemeStore } from '../store/themeStore';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const colors = useThemeStore.getState().colors;
      return (
        <Box sx={{ p: 4, backgroundColor: colors.bg, minHeight: '100vh', color: colors.textPrimary }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: colors.danger, mb: 2 }}>
            Something crashed
          </Typography>
          <Box
            component="pre"
            sx={{
              fontSize: '0.78rem',
              fontFamily: '"JetBrains Mono", monospace',
              color: colors.textSecondary,
              whiteSpace: 'pre-wrap',
              mb: 3,
              p: 2,
              backgroundColor: colors.surface,
              borderRadius: 1,
              border: `1px solid ${colors.border}`,
            }}
          >
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => this.setState({ error: null })}
            sx={{ color: colors.textSecondary, borderColor: colors.border }}
          >
            Try again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

import { Box, IconButton, Typography } from '@mui/material';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import { Link, useLocation } from 'react-router-dom';
import { useColors } from '../hooks/useColors';
import { useThemeStore } from '../store/themeStore';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const colors = useColors();
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.bg }}>
      {!isLanding && (
        <Box
          component="nav"
          sx={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            px: 2,
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: colors.bg,
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Typography
            component={Link}
            to="/"
            sx={{
              textDecoration: 'none',
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: colors.textPrimary,
              letterSpacing: '-0.02em',
            }}
          >
            LeetShaders
          </Typography>

          <Box sx={{ flex: 1 }} />

          <IconButton
            onClick={toggle}
            size="small"
            sx={{ color: colors.textSecondary, '&:hover': { color: colors.textPrimary } }}
          >
            {mode === 'dark'
              ? <LightModeOutlinedIcon sx={{ fontSize: 18 }} />
              : <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />
            }
          </IconButton>
        </Box>
      )}
      <Box sx={{ flex: 1 }}>{children}</Box>
    </Box>
  );
}

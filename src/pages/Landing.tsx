import { Box, IconButton, Typography } from '@mui/material';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { DitheringShader } from '../components/DitheringShader';
import { fadeIn, blink } from '../styles/animations';
import { useColors } from '../hooks/useColors';
import { useThemeStore } from '../store/themeStore';

function useViewportSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export default function Landing() {
  const { w, h } = useViewportSize();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = useColors();
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <DitheringShader
          width={Math.ceil(w / 2)}
          height={Math.ceil(h / 2)}
          shape="wave"
          type="8x8"
          colorBack={mode === 'dark' ? '#0d1117' : '#e8ecf0'}
          colorFront={mode === 'dark' ? '#58a6ff' : '#0969da'}
          pxSize={3}
          speed={reducedMotion ? 0 : 0.6}
          style={{ width: w, height: h }}
        />
      </Box>

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          backgroundColor: mode === 'dark' ? 'rgba(13, 17, 23, 0.55)' : 'rgba(255, 255, 255, 0.6)',
        }}
      />

      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 3 }}>
        <IconButton
          onClick={toggle}
          size="small"
          sx={{ color: colors.textSecondary, '&:hover': { color: colors.textPrimary } }}
        >
          {mode === 'dark'
            ? <LightModeOutlinedIcon sx={{ fontSize: 20 }} />
            : <DarkModeOutlinedIcon sx={{ fontSize: 20 }} />
          }
        </IconButton>
      </Box>

      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          px: 3,
          animation: `${fadeIn} 0.8s ease`,
        }}
      >
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: '2.5rem', md: '4rem' }, color: colors.textPrimary, mb: 2 }}
        >
          LeetShaders
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: '0.95rem', md: '1.1rem' },
            color: colors.textPrimary,
            opacity: 0.7,
            mb: 5,
            maxWidth: 440,
            mx: 'auto',
            lineHeight: 1.6,
          }}
        >
          Practice GLSL fragment shaders. Write code that matches the reference output.
        </Typography>

        <Box
          component={Link}
          to="/challenges"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1.5,
            px: 3,
            py: 1.5,
            backgroundColor: mode === 'dark' ? 'rgba(22, 27, 34, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background-color 0.2s',
            '&:hover': {
              borderColor: colors.accent,
              backgroundColor: mode === 'dark' ? 'rgba(22, 27, 34, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              '& .prompt-arrow': { color: colors.accent },
              '& .prompt-text': { color: colors.textPrimary },
            },
          }}
        >
          <Typography
            className="prompt-arrow"
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '1rem',
              fontWeight: 700,
              color: colors.accent,
              transition: 'color 0.2s',
            }}
          >
            &gt;
          </Typography>
          <Typography
            className="prompt-text"
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: colors.textSecondary,
              letterSpacing: '0.02em',
              transition: 'color 0.2s',
            }}
          >
            start_practicing
          </Typography>
          <Box
            sx={{
              width: '2px',
              height: '1.1em',
              backgroundColor: colors.accent,
              animation: reducedMotion ? 'none' : `${blink} 1s step-end infinite`,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

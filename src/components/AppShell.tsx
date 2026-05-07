import { Box, IconButton, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, alpha } from '@mui/material';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Link, useLocation } from 'react-router-dom';
import { useColors } from '../hooks/useColors';
import { useThemeStore } from '../store/themeStore';
import { supabase } from '../backend/supabase';
import { useState } from 'react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const colors = useColors();
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleResetProgress = async () => {
    setResetting(true);
    try {
      // 1. Clear Supabase solves
      const { error } = await supabase.from('solves').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
      
      // 2. Clear LocalStorage history
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('ls_history_')) {
          localStorage.removeItem(key);
        }
      });

      if (error) throw error;
      window.location.reload();
    } catch (err) {
      console.error('Failed to reset:', err);
      alert('Failed to reset progress.');
    } finally {
      setResetting(false);
      setResetDialogOpen(false);
    }
  };

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
            onClick={() => setResetDialogOpen(true)}
            size="small"
            sx={{ color: colors.textTertiary, '&:hover': { color: colors.danger }, mr: 1 }}
            title="Reset Progress"
          >
            <RestartAltIcon sx={{ fontSize: 18 }} />
          </IconButton>

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

      {/* Reset Confirmation Dialog */}
      <Dialog 
        open={resetDialogOpen} 
        onClose={() => !resetting && setResetDialogOpen(false)}
        PaperProps={{
          sx: { 
            bgcolor: mode === 'dark' ? '#1e293b' : '#fff',
            backgroundImage: 'none',
            borderRadius: '16px',
            color: colors.textPrimary
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Reset all progress?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            This will permanently delete your submission history and reset your progress. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button 
            onClick={() => setResetDialogOpen(false)} 
            disabled={resetting}
            sx={{ color: colors.textTertiary, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleResetProgress} 
            variant="contained"
            color="error"
            disabled={resetting}
            sx={{ borderRadius: '8px', textTransform: 'none', px: 3 }}
          >
            {resetting ? 'Resetting...' : 'Reset Everything'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

import { Box, Collapse, IconButton, Typography } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useEffect, useState } from 'react';
import type { PipelineError } from '../judge/types';

interface ErrorConsoleProps {
  errors: PipelineError[];
  onJumpToLine?: (line: number) => void;
}

export default function ErrorConsole({ errors, onJumpToLine }: ErrorConsoleProps) {
  const hasErrors = errors.length > 0;
  const [open, setOpen] = useState(hasErrors);

  useEffect(() => {
    if (hasErrors) setOpen(true);
  }, [hasErrors]);

  return (
    <Box
      sx={{ borderTop: '1px solid #2a2f3e', background: '#0b0d13', borderRadius: 1 }}
      role="region"
      aria-label="Error console"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 0.5,
          cursor: 'pointer',
          '&:hover': { background: 'rgba(255,255,255,0.03)' },
        }}
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`Error console, ${errors.length} errors`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <ErrorOutlineIcon
          fontSize="small"
          sx={{ mr: 1, color: hasErrors ? 'error.main' : 'text.secondary', fontSize: 16 }}
        />
        <Typography variant="caption" sx={{ flex: 1, fontWeight: hasErrors ? 600 : 400 }}>
          {hasErrors ? `${errors.length} error${errors.length > 1 ? 's' : ''}` : 'No errors'}
        </Typography>
        <IconButton size="small" aria-label={open ? 'Collapse error console' : 'Expand error console'} tabIndex={-1}>
          {open ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box
          component="ul"
          sx={{
            px: 2,
            py: 1,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
            listStyle: 'none',
            m: 0,
          }}
        >
          {errors.length === 0 ? (
            <Box component="li" sx={{ opacity: 0.5 }}>No compile errors.</Box>
          ) : (
            errors.map((err, i) => {
              const clickable = err.kind === 'compile-error' && err.line != null;
              return (
                <Box
                  component="li"
                  key={i}
                  sx={{
                    py: 0.25,
                    cursor: clickable ? 'pointer' : 'default',
                    color: 'error.light',
                    '&:hover': clickable ? { textDecoration: 'underline' } : {},
                  }}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={clickable ? `Error on line ${err.line}: ${err.message}. Click to jump.` : undefined}
                  onClick={() => {
                    if (clickable && onJumpToLine) onJumpToLine(err.line!);
                  }}
                  onKeyDown={(e) => {
                    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onJumpToLine?.(err.line!);
                    }
                  }}
                >
                  {err.kind === 'compile-error' && err.line != null
                    ? `L${err.line}: ${err.message}`
                    : err.message}
                </Box>
              );
            })
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

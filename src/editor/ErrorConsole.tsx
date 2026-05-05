import { Box, Collapse, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useColors } from '../hooks/useColors';
import type { PipelineError } from '../judge/types';

interface ErrorConsoleProps {
  errors: PipelineError[];
  onJumpToLine?: (line: number) => void;
}

export default function ErrorConsole({ errors, onJumpToLine }: ErrorConsoleProps) {
  const colors = useColors();
  const hasErrors = errors.length > 0;
  const [open, setOpen] = useState(hasErrors);

  useEffect(() => {
    if (hasErrors) setOpen(true);
  }, [hasErrors]);

  return (
    <Box
      sx={{ borderTop: `1px solid ${colors.border}`, backgroundColor: colors.surface }}
      role="region"
      aria-label="Error console"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 0.75,
          cursor: 'pointer',
          '&:hover': { backgroundColor: colors.surfaceHover },
        }}
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
        }}
      >
        <Typography sx={{ fontSize: '0.7rem', color: hasErrors ? colors.danger : colors.textTertiary, fontWeight: 500 }}>
          {hasErrors ? `${errors.length} error${errors.length > 1 ? 's' : ''}` : 'No errors'}
        </Typography>
      </Box>

      <Collapse in={open && hasErrors}>
        <Box
          component="ul"
          sx={{
            px: 2,
            py: 1,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.7rem',
            listStyle: 'none',
            m: 0,
            maxHeight: 120,
            overflow: 'auto',
          }}
        >
          {errors.map((err, i) => {
            const clickable = err.kind === 'compile-error' && err.line != null;
            return (
              <Box
                component="li"
                key={i}
                sx={{
                  py: 0.25,
                  cursor: clickable ? 'pointer' : 'default',
                  color: colors.danger,
                  '&:hover': clickable ? { textDecoration: 'underline' } : {},
                }}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={() => { if (clickable && onJumpToLine) onJumpToLine(err.line!); }}
                onKeyDown={(e) => {
                  if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onJumpToLine?.(err.line!); }
                }}
              >
                {err.kind === 'compile-error' && err.line != null ? `L${err.line}: ${err.message}` : err.message}
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
}

// Editor & UI Lead owns this file. See EDITOR_LEAD.md task 4.

import { Box, Collapse, IconButton, Typography } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
    setOpen(hasErrors);
  }, [hasErrors]);

  return (
    <Box sx={{ borderTop: '1px solid #2a2f3e', background: '#0b0d13' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 0.5,
          cursor: 'pointer',
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <Typography variant="caption" sx={{ flex: 1 }}>
          Errors ({errors.length})
        </Typography>
        <IconButton size="small" aria-label={open ? 'collapse errors' : 'expand errors'}>
          {open ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 2, py: 1, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
          {errors.length === 0 ? (
            <Box sx={{ opacity: 0.5 }}>No compile errors.</Box>
          ) : (
            errors.map((err, i) => (
              <Box
                key={i}
                sx={{ py: 0.25, cursor: err.kind === 'compile-error' && err.line ? 'pointer' : 'default' }}
                onClick={() => {
                  if (err.kind === 'compile-error' && err.line && onJumpToLine) {
                    onJumpToLine(err.line);
                  }
                }}
              >
                {err.kind === 'compile-error' && err.line != null
                  ? `L${err.line}: ${err.message}`
                  : err.message}
              </Box>
            ))
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

import { Box, Chip, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import type { JudgeResult } from '../judge/types';

interface ResultPanelProps {
  result: JudgeResult;
}

export default function ResultPanel({ result }: ResultPanelProps) {
  return (
    <Box
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: result.passed ? 'success.main' : 'error.main',
        borderRadius: 2,
        background: result.passed ? 'rgba(46, 125, 50, 0.08)' : 'rgba(211, 47, 47, 0.08)',
      }}
      role="region"
      aria-label="Submission result"
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Typography variant="h3" component="span" sx={{ fontWeight: 700 }}>
          {result.finalScore}
        </Typography>
        <Chip
          icon={result.passed ? <CheckCircleOutlineIcon /> : <CancelOutlinedIcon />}
          label={result.passed ? 'Passed' : 'Failed'}
          color={result.passed ? 'success' : 'error'}
          variant="outlined"
          aria-label={result.passed ? 'Result: Passed' : 'Result: Failed'}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1 }}>
        <Detail label="MAE Score" value={result.maeScore.toFixed(1)} />
        {result.llmScore != null && (
          <Detail label="LLM Score" value={result.llmScore.toFixed(1)} />
        )}
        <Detail label="MAE Raw" value={result.breakdown.maeRaw.toFixed(4)} />
      </Box>

      {result.breakdown.stageTwoInvoked && result.breakdown.llmReasoning && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            LLM Reasoning
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
            {result.breakdown.llmReasoning}
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 1.5, display: 'flex', gap: 2, opacity: 0.5 }}>
        <Typography variant="caption">
          Render: {result.renderLatencyMs.toFixed(0)}ms
        </Typography>
        <Typography variant="caption">
          Judge: {result.judgeLatencyMs.toFixed(0)}ms
        </Typography>
        {result.breakdown.stageTwoInvoked && (
          <Typography variant="caption">Stage 2 invoked</Typography>
        )}
      </Box>
    </Box>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  );
}

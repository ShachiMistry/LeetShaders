import { Box, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { useColors } from '../hooks/useColors';
import type { JudgeResult } from '../judge/types';

interface RunResult {
  kind: 'run';
  mae: number;
  score: number;
}

interface SubmitResult {
  kind: 'submit';
  result: JudgeResult;
}

export type ResultData = RunResult | SubmitResult;

interface ResultPanelProps {
  data: ResultData;
}

export default function ResultPanel({ data }: ResultPanelProps) {
  if (data.kind === 'run') {
    return <RunResultView mae={data.mae} score={data.score} />;
  }
  return <SubmitResultView result={data.result} />;
}

function RunResultView({ mae, score }: { mae: number; score: number }) {
  const colors = useColors();
  const statusColor = score >= 90 ? colors.success : score >= 50 ? colors.warning : colors.danger;
  const statusLabel = score >= 90 ? 'Looks correct' : score >= 50 ? 'Partially matching' : 'Not matching';
  const StatusIcon = score >= 90 ? CheckCircleOutlineIcon : CancelOutlinedIcon;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <StatusIcon sx={{ fontSize: 15, color: statusColor }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: statusColor }}>
          {statusLabel}
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: colors.textPrimary, ml: 'auto', fontFamily: '"JetBrains Mono", monospace' }}>
          {score}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <ScoreItem label="Score" value={String(score)} />
        <ScoreItem label="MAE" value={mae.toFixed(4)} />
      </Box>
      <Typography sx={{ fontSize: '0.6rem', color: colors.textTertiary, mt: 1 }}>
        Quick check only. Submit for the full judge.
      </Typography>
    </Box>
  );
}

function SubmitResultView({ result }: { result: JudgeResult }) {
  const colors = useColors();
  const statusColor = result.passed ? colors.success : colors.danger;
  const StatusIcon = result.passed ? CheckCircleOutlineIcon : CancelOutlinedIcon;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <StatusIcon sx={{ fontSize: 15, color: statusColor }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: statusColor }}>
          {result.passed ? 'Accepted' : 'Wrong Answer'}
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: colors.textPrimary, ml: 'auto', fontFamily: '"JetBrains Mono", monospace' }}>
          {result.finalScore}
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <ScoreItem label="MAE" value={result.maeScore.toFixed(1)} />
        <ScoreItem label="MAE Raw" value={result.breakdown.maeRaw.toFixed(4)} />
        {result.llmScore != null && (
          <ScoreItem label="LLM Score" value={result.llmScore.toFixed(1)} />
        )}
      </Box>

      {result.breakdown.stageTwoInvoked && result.breakdown.llmReasoning && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: '0.6rem', color: colors.textTertiary, mb: 0.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Reasoning
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: colors.textSecondary, lineHeight: 1.5, fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'pre-wrap' }}>
            {result.breakdown.llmReasoning}
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
        <Typography sx={{ fontSize: '0.58rem', color: colors.textTertiary }}>
          Render {result.renderLatencyMs.toFixed(0)}ms
        </Typography>
        <Typography sx={{ fontSize: '0.58rem', color: colors.textTertiary }}>
          Judge {result.judgeLatencyMs.toFixed(0)}ms
        </Typography>
      </Box>
    </Box>
  );
}

function ScoreItem({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <Box sx={{ px: 1.5, py: 0.75, borderRadius: 0.5, backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
      <Typography sx={{ fontSize: '0.58rem', color: colors.textTertiary, mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: colors.textPrimary, fontFamily: '"JetBrains Mono", monospace' }}>{value}</Typography>
    </Box>
  );
}

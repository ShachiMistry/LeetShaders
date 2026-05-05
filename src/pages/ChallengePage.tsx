import {
  Box,
  Button,
  CircularProgress,
  Container,
  Chip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link, useParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Monaco from '../editor/Monaco';
import LivePreview from '../editor/LivePreview';
import ErrorConsole from '../editor/ErrorConsole';
import ResultPanel from '../editor/ResultPanel';
import { useChallenge, submitSolve } from '../backend/useChallenges';
import { judge } from '../judge/combiner';
import { llmJudge } from '../judge/llm';
import type { JudgeResult, PipelineError } from '../judge/types';

const STARTER = `#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  fragColor = vec4(uv, 0.0, 1.0);
}
`;

const DEBOUNCE_MS = 300;

const DIFFICULTY_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'error',
};

export default function ChallengePage() {
  const { slug = '' } = useParams();
  const { data: challenge, loading } = useChallenge(slug);
  const [src, setSrc] = useState(STARTER);
  const [debouncedSrc, setDebouncedSrc] = useState(STARTER);
  const [errors, setErrors] = useState<PipelineError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState('');
  const [result, setResult] = useState<JudgeResult | null>(null);

  const jumpToLineRef = useRef<((line: number) => void) | null>(null);
  const timeRef = useRef(0);

  const referenceSrc = useMemo(() => challenge?.referenceShaderSrc ?? '', [challenge]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSrc(src), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [src]);

  // Shared animation clock for both previews
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    function tick() {
      timeRef.current = (performance.now() - start) / 1000;
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleUserErrors = useCallback((errs: PipelineError[]) => {
    setErrors(errs);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!challenge || submitting) return;

    setSubmitting(true);
    setResult(null);

    setSubmitStage('Running pixel comparison...');

    try {
      const judgeResult = await judge(src, challenge, async (input) => {
        setSubmitStage('Asking model for visual judgment...');
        return llmJudge(input);
      });

      setResult(judgeResult);

      if (judgeResult.passed) {
        try {
          await submitSolve(challenge.id, judgeResult.finalScore, src);
        } catch {
          // Backend may not be wired yet
        }
      }
    } catch (err) {
      setResult(null);
      setErrors([{
        kind: 'context-lost',
        message: err instanceof Error ? err.message : 'Submission failed',
      }]);
    } finally {
      setSubmitting(false);
      setSubmitStage('');
    }
  }, [challenge, src, submitting]);

  if (loading) {
    return (
      <Container sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress aria-label="Loading challenge" />
      </Container>
    );
  }

  if (!challenge) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>Challenge not found.</Typography>
        <Button component={Link} to="/challenges" startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>
          Back to challenges
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: 2, px: { xs: 1, md: 3 }, maxWidth: 1600 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Button
          component={Link}
          to="/challenges"
          startIcon={<ArrowBackIcon />}
          size="small"
          aria-label="Back to challenge list"
        >
          Back
        </Button>
        <Typography variant="h5" component="h1" sx={{ flex: 1 }}>
          {challenge.title}
        </Typography>
        <Chip
          label={challenge.difficulty}
          color={DIFFICULTY_COLOR[challenge.difficulty]}
          size="small"
          variant="outlined"
        />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {challenge.description}
      </Typography>

      {/* Three-pane layout */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gridTemplateRows: { md: 'minmax(320px, 60vh)' },
          gap: 2,
          mb: 1,
        }}
      >
        {/* Left: Monaco editor */}
        <Box
          sx={{
            border: '1px solid #2a2f3e',
            borderRadius: 1,
            overflow: 'hidden',
            minHeight: 320,
          }}
        >
          <Monaco
            value={src}
            onChange={setSrc}
            errors={errors}
            onJumpToLine={jumpToLineRef}
          />
        </Box>

        {/* Right: Live preview + Reference */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateRows: '1fr 1fr',
            gap: 1,
            minHeight: 320,
          }}
        >
          <LivePreview
            shaderSrc={debouncedSrc}
            label="Your output"
            timeRef={timeRef}
            onErrors={handleUserErrors}
          />
          <LivePreview
            shaderSrc={referenceSrc}
            label="Reference"
            timeRef={timeRef}
          />
        </Box>
      </Box>

      {/* Error console */}
      <ErrorConsole
        errors={errors}
        onJumpToLine={(line) => jumpToLineRef.current?.(line)}
      />

      {/* Submit area */}
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={submitting || errors.some((e) => e.kind === 'compile-error')}
          aria-label="Submit shader for judging"
          sx={{ minWidth: 120 }}
        >
          {submitting ? 'Judging...' : 'Submit'}
        </Button>
        {submitting && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              {submitStage}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Result panel */}
      {result && (
        <Box sx={{ mt: 2 }}>
          <ResultPanel result={result} />
        </Box>
      )}
    </Container>
  );
}

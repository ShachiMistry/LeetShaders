import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Monaco from '../editor/Monaco';
import LivePreview from '../editor/LivePreview';
import ErrorConsole from '../editor/ErrorConsole';
import ResultPanel from '../editor/ResultPanel';
import type { ResultData } from '../editor/ResultPanel';
import { useChallenge, submitSolve } from '../backend/useChallenges';
import { judge } from '../judge/combiner';
import { llmJudge } from '../judge/llm';
import { computeMAEResult } from '../judge/mae';
import { compileAndRender } from '../judge/pipeline';
import { useColors } from '../hooks/useColors';
import type { ColorPalette } from '../theme';
import type { PipelineError } from '../judge/types';

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
const MIN_LEFT = 240;
const MIN_RIGHT = 240;
const MIN_CENTER = 300;

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'Easy',
  intermediate: 'Medium',
  advanced: 'Hard',
};

function getDifficultyColor(d: string, c: ColorPalette): string {
  if (d === 'beginner') return c.success;
  if (d === 'intermediate') return c.warning;
  return c.danger;
}

interface SubmissionRecord {
  timestamp: number;
  score: number;
  passed: boolean;
}

function getSubmissionHistory(challengeId: string): SubmissionRecord[] {
  try {
    const raw = localStorage.getItem(`ls_history_${challengeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSubmission(challengeId: string, record: SubmissionRecord) {
  const history = getSubmissionHistory(challengeId);
  history.unshift(record);
  localStorage.setItem(`ls_history_${challengeId}`, JSON.stringify(history.slice(0, 50)));
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const colors = useColors();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ mb: 1 }}>
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          py: 0.75,
          '&:hover': { '& .section-label': { color: colors.textSecondary } },
        }}
      >
        {open
          ? <ExpandLessIcon sx={{ fontSize: 14, color: colors.textTertiary, mr: 0.5 }} />
          : <ExpandMoreIcon sx={{ fontSize: 14, color: colors.textTertiary, mr: 0.5 }} />
        }
        <Typography className="section-label" sx={{ fontSize: '0.68rem', color: colors.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'color 0.1s' }}>
          {title}
        </Typography>
      </Box>
      <Collapse in={open}>
        <Box sx={{ pl: 2.5, pb: 1.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

function DragHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const colors = useColors();
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const onMove = (ev: MouseEvent) => onDrag(ev.clientX - startX);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [onDrag]);

  return (
    <Box
      onMouseDown={handleMouseDown}
      sx={{
        width: 5,
        flexShrink: 0,
        cursor: 'col-resize',
        backgroundColor: colors.border,
        transition: 'background-color 0.15s',
        '&:hover': { backgroundColor: colors.accent },
      }}
    />
  );
}

export default function ChallengePage() {
  const colors = useColors();
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const { data: challenge, loading } = useChallenge(slug);
  const [src, setSrc] = useState(STARTER);
  const [debouncedSrc, setDebouncedSrc] = useState(STARTER);
  const [errors, setErrors] = useState<PipelineError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState('');
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<SubmissionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'description' | 'solution' | 'submissions'>('description');

  const [leftWidth, setLeftWidth] = useState(360);
  const [rightWidth, setRightWidth] = useState(380);
  const leftBase = useRef(360);
  const rightBase = useRef(380);

  const jumpToLineRef = useRef<((line: number) => void) | null>(null);
  const timeRef = useRef(0);

  const referenceSrc = useMemo(() => challenge?.referenceShaderSrc ?? '', [challenge]);
  const hasCompileError = errors.some((e) => e.kind === 'compile-error');

  useEffect(() => {
    if (challenge) setHistory(getSubmissionHistory(challenge.id));
  }, [challenge]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSrc(src), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [src]);

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

  const handleLeftDrag = useCallback((dx: number) => {
    const total = window.innerWidth;
    const newLeft = Math.max(MIN_LEFT, Math.min(leftBase.current + dx, total - rightWidth - MIN_CENTER));
    setLeftWidth(newLeft);
  }, [rightWidth]);

  const handleRightDrag = useCallback((dx: number) => {
    const total = window.innerWidth;
    const newRight = Math.max(MIN_RIGHT, Math.min(rightBase.current - dx, total - leftWidth - MIN_CENTER));
    setRightWidth(newRight);
  }, [leftWidth]);

  useEffect(() => {
    const onUp = () => {
      leftBase.current = leftWidth;
      rightBase.current = rightWidth;
    };
    document.addEventListener('mouseup', onUp);
    return () => document.removeEventListener('mouseup', onUp);
  }, [leftWidth, rightWidth]);

  const handleUserErrors = useCallback((errs: PipelineError[]) => {
    setErrors(errs);
  }, []);

  const handleRun = useCallback(() => {
    if (!challenge || hasCompileError) return;
    setRunning(true);
    setResultData(null);

    setTimeout(() => {
      const userResult = compileAndRender(src);
      if ('type' in userResult) { setRunning(false); return; }
      const refResult = compileAndRender(challenge.referenceShaderSrc);
      if ('type' in refResult) { setRunning(false); return; }

      const mae = computeMAEResult(userResult.pixels, refResult.pixels, challenge.tolerance, challenge.useBlur);
      setResultData({ kind: 'run', mae: mae.rawMae, score: Math.round(mae.score) });
      setDebouncedSrc(src);
      setRunning(false);
    }, 50);
  }, [challenge, src, hasCompileError]);

  const handleSubmit = useCallback(async () => {
    if (!challenge || submitting) return;
    setSubmitting(true);
    setResultData(null);
    setSubmitStage('Running pixel comparison...');

    try {
      const judgeResult = await judge(src, challenge, async (input) => {
        setSubmitStage('Running AI visual analysis...');
        return llmJudge(input);
      });
      setResultData({ kind: 'submit', result: judgeResult });

      const record: SubmissionRecord = {
        timestamp: Date.now(),
        score: judgeResult.finalScore,
        passed: judgeResult.passed,
      };
      saveSubmission(challenge.id, record);
      setHistory(getSubmissionHistory(challenge.id));

      if (judgeResult.passed) {
        try { await submitSolve(challenge.id, judgeResult.finalScore, src); } catch {}
      }
    } catch (err) {
      setResultData(null);
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 48px)' }}>
        <CircularProgress size={20} sx={{ color: colors.accent }} />
      </Box>
    );
  }

  if (!challenge) {
    return (
      <Box sx={{ px: 4, py: 6 }}>
        <Typography sx={{ color: colors.textSecondary, mb: 2 }}>Challenge not found.</Typography>
        <Button component={Link} to="/challenges" startIcon={<ArrowBackIcon />} size="small">Back</Button>
      </Box>
    );
  }

  const tabs = ['description', 'solution', 'submissions'] as const;

  return (
    <Box sx={{ height: 'calc(100vh - 48px)', display: 'flex', overflow: 'hidden' }}>

      {/* Left */}
      <Box sx={{ width: leftWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${colors.border}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Button component={Link} to="/challenges" size="small" sx={{ minWidth: 0, p: 0.25, color: colors.textTertiary, '&:hover': { color: colors.textPrimary } }}>
              <ArrowBackIcon sx={{ fontSize: 14 }} />
            </Button>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary, fontFamily: '"Space Grotesk", sans-serif' }}>
              {challenge.title}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 500, color: getDifficultyColor(challenge.difficulty, colors), pl: 3.5 }}>
            {DIFFICULTY_LABEL[challenge.difficulty]}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
          {tabs.map((tab) => (
            <Box
              key={tab}
              onClick={() => setActiveTab(tab)}
              sx={{
                flex: 1, py: 0.75, textAlign: 'center', cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: 500,
                color: activeTab === tab ? colors.textPrimary : colors.textTertiary,
                borderBottom: activeTab === tab ? `2px solid ${colors.accent}` : '2px solid transparent',
                transition: 'color 0.1s',
                '&:hover': { color: colors.textSecondary },
                textTransform: 'capitalize',
              }}
            >
              {tab === 'submissions' ? `Submissions (${history.length})` : tab}
            </Box>
          ))}
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {activeTab === 'description' && (
            <Box sx={{ px: 1.5, py: 1 }}>
              <Section title="Description">
                <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.7 }}>
                  {challenge.description}
                </Typography>
              </Section>

              {challenge.hintText && (
                <Section title="Hint" defaultOpen={false}>
                  <Typography sx={{ fontSize: '0.78rem', color: colors.textSecondary, lineHeight: 1.6 }}>
                    {challenge.hintText}
                  </Typography>
                </Section>
              )}

              <Section title="Uniforms">
                <Box component="ul" sx={{ m: 0, pl: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {[
                    { name: 'u_time', type: 'float', desc: 'Elapsed seconds' },
                    { name: 'u_resolution', type: 'vec2', desc: 'Canvas size (px)' },
                    { name: 'u_mouse', type: 'vec2', desc: 'Mouse position (px)' },
                  ].map((u) => (
                    <Box component="li" key={u.name} sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.72rem', fontFamily: '"JetBrains Mono", monospace', color: colors.accent, fontWeight: 500 }}>{u.name}</Typography>
                      <Typography sx={{ fontSize: '0.62rem', color: colors.textTertiary }}>{u.type}</Typography>
                      <Typography sx={{ fontSize: '0.62rem', color: colors.textSecondary, ml: 'auto' }}>{u.desc}</Typography>
                    </Box>
                  ))}
                </Box>
              </Section>
            </Box>
          )}

          {activeTab === 'solution' && (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <Monaco value={referenceSrc} onChange={() => {}} readOnly errors={[]} />
              </Box>
            </Box>
          )}

          {activeTab === 'submissions' && (
            <Box sx={{ px: 1.5, py: 1 }}>
              {history.length === 0 ? (
                <Typography sx={{ fontSize: '0.78rem', color: colors.textTertiary, py: 2 }}>
                  No submissions yet.
                </Typography>
              ) : (
                history.map((h, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      py: 1, borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    {h.passed
                      ? <CheckCircleOutlineIcon sx={{ fontSize: 13, color: colors.success }} />
                      : <CancelOutlinedIcon sx={{ fontSize: 13, color: colors.danger }} />
                    }
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: h.passed ? colors.success : colors.danger }}>
                      {h.passed ? 'Accepted' : 'Failed'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: colors.textPrimary, fontFamily: '"JetBrains Mono", monospace' }}>
                      {h.score}
                    </Typography>
                    <Typography sx={{ fontSize: '0.62rem', color: colors.textTertiary, ml: 'auto' }}>
                      {new Date(h.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                ))
              )}
            </Box>
          )}
        </Box>
      </Box>

      <DragHandle onDrag={handleLeftDrag} />

      {/* Center */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <Monaco value={src} onChange={setSrc} errors={errors} onJumpToLine={jumpToLineRef} />
        </Box>

        <ErrorConsole errors={errors} onJumpToLine={(line) => jumpToLineRef.current?.(line)} />

        {(resultData || running || submitting) && (
          <Box sx={{ borderTop: `1px solid ${colors.border}`, backgroundColor: colors.surface, px: 2, py: 1.5, maxHeight: 200, overflow: 'auto' }}>
            {(running || submitting) ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={12} sx={{ color: colors.accent }} />
                <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                  {submitting ? submitStage : 'Running test...'}
                </Typography>
              </Box>
            ) : resultData && (
              <ResultPanel data={resultData} />
            )}
          </Box>
        )}

        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 2, py: 0.75,
            borderTop: `1px solid ${colors.border}`,
            backgroundColor: colors.bg,
          }}
        >
          <Button
            variant="outlined"
            size="small"
            startIcon={<PlayArrowIcon sx={{ fontSize: 12 }} />}
            onClick={handleRun}
            disabled={hasCompileError || running}
          >
            Run
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSubmit}
            disabled={submitting || hasCompileError}
          >
            {submitting ? 'Judging...' : 'Submit'}
          </Button>

          <Typography sx={{ ml: 'auto', fontSize: '0.65rem', color: colors.textTertiary, fontFamily: '"JetBrains Mono", monospace' }}>
            GLSL ES 3.0
          </Typography>
        </Box>
      </Box>

      <DragHandle onDrag={handleRightDrag} />

      {/* Right */}
      <Box sx={{ width: rightWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderBottom: `1px solid ${colors.border}`, minHeight: 0 }}>
          <Box sx={{ px: 1.5, py: 0.5, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.62rem', color: colors.textTertiary, fontWeight: 500 }}>YOUR OUTPUT</Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: '#000' }}>
            <LivePreview shaderSrc={debouncedSrc} timeRef={timeRef} onErrors={handleUserErrors} />
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ px: 1.5, py: 0.5, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.62rem', color: colors.textTertiary, fontWeight: 500 }}>REFERENCE</Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: '#000' }}>
            <LivePreview shaderSrc={referenceSrc} timeRef={timeRef} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

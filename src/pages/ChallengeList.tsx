import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Link } from 'react-router-dom';
import { useChallenges } from '../backend/useChallenges';
import { fadeInUp } from '../styles/animations';
import { useColors } from '../hooks/useColors';
import type { Challenge } from '../judge/types';
import type { ColorPalette } from '../theme';

type Difficulty = Challenge['difficulty'];
type SortKey = 'title' | 'difficulty';
type StatusFilter = 'all' | 'solved' | 'unsolved';

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: 'Easy',
  intermediate: 'Medium',
  advanced: 'Hard',
};

function getSolvedSet(): Set<string> {
  const solved = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('ls_history_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const history = JSON.parse(raw) as { passed: boolean }[];
          if (history.some((h) => h.passed)) {
            solved.add(key.replace('ls_history_', ''));
          }
        }
      }
    }
  } catch {}
  return solved;
}

function FilterButton({ label, active, onClick, colors }: { label: string; active: boolean; onClick: () => void; colors: ColorPalette }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        border: `1px solid ${active ? colors.accent : colors.border}`,
        borderRadius: '4px',
        px: 1.5,
        py: 0.5,
        fontSize: '0.75rem',
        fontFamily: 'inherit',
        cursor: 'pointer',
        backgroundColor: active ? colors.surface : 'transparent',
        color: active ? colors.textPrimary : colors.textSecondary,
        transition: 'all 0.15s',
        '&:hover': { backgroundColor: colors.surfaceHover, borderColor: colors.borderHover },
      }}
    >
      {label}
    </Box>
  );
}

export default function ChallengeList() {
  const colors = useColors();
  const { data, loading, error } = useChallenges();
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('difficulty');

  const solvedSet = useMemo(() => getSolvedSet(), []);

  const DIFFICULTY_TEXT_COLOR: Record<Difficulty, string> = {
    beginner: colors.success,
    intermediate: colors.warning,
    advanced: colors.danger,
  };

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (difficultyFilter !== 'all') {
      list = list.filter((c) => c.difficulty === difficultyFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter((c) => statusFilter === 'solved' ? solvedSet.has(c.id) : !solvedSet.has(c.id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sortBy === 'difficulty') {
      sorted.sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] || a.title.localeCompare(b.title));
    } else {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    return sorted;
  }, [data, search, difficultyFilter, statusFilter, sortBy, solvedSet]);

  const setDifficulty = useCallback((v: Difficulty | 'all') => setDifficultyFilter(v), []);
  const setStatus = useCallback((v: StatusFilter) => setStatusFilter(v), []);
  const setSort = useCallback((v: SortKey) => setSortBy(v), []);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 0.5, color: colors.textPrimary }}>
        Challenges
      </Typography>
      <Typography sx={{ color: colors.textSecondary, fontSize: '0.85rem', mb: 4 }}>
        {data ? `${data.length} problems` : 'Loading...'}
      </Typography>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Filter by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: colors.textTertiary }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            width: 200,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.8rem',
              backgroundColor: colors.surface,
              '& fieldset': { borderColor: colors.border },
              '&:hover fieldset': { borderColor: colors.borderHover },
              '&.Mui-focused fieldset': { borderColor: colors.accent },
            },
            '& .MuiInputBase-input': { color: colors.textPrimary },
          }}
        />

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <FilterButton label="All" active={difficultyFilter === 'all'} onClick={() => setDifficulty('all')} colors={colors} />
          <FilterButton label="Easy" active={difficultyFilter === 'beginner'} onClick={() => setDifficulty('beginner')} colors={colors} />
          <FilterButton label="Medium" active={difficultyFilter === 'intermediate'} onClick={() => setDifficulty('intermediate')} colors={colors} />
          <FilterButton label="Hard" active={difficultyFilter === 'advanced'} onClick={() => setDifficulty('advanced')} colors={colors} />
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <FilterButton label="All" active={statusFilter === 'all'} onClick={() => setStatus('all')} colors={colors} />
          <FilterButton label="Solved" active={statusFilter === 'solved'} onClick={() => setStatus('solved')} colors={colors} />
          <FilterButton label="Unsolved" active={statusFilter === 'unsolved'} onClick={() => setStatus('unsolved')} colors={colors} />
        </Box>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.7rem', color: colors.textTertiary, mr: 0.5 }}>Sort:</Typography>
          <FilterButton label="Difficulty" active={sortBy === 'difficulty'} onClick={() => setSort('difficulty')} colors={colors} />
          <FilterButton label="Name" active={sortBy === 'title'} onClick={() => setSort('title')} colors={colors} />
        </Box>
      </Box>

      {error && (
        <Typography sx={{ color: colors.danger, fontSize: '0.85rem', mb: 2 }} role="alert">
          {error.message}
        </Typography>
      )}

      {/* Table header */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 80px 80px',
          gap: 2,
          px: 2,
          py: 1,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {['Title', 'Difficulty', 'Status'].map((h, i) => (
          <Typography
            key={h}
            sx={{
              fontSize: '0.7rem',
              color: colors.textTertiary,
              fontWeight: 600,
              textAlign: i === 2 ? 'center' : 'left',
            }}
          >
            {h}
          </Typography>
        ))}
      </Box>

      {/* Rows */}
      {filtered.map((c, i) => {
        const solved = solvedSet.has(c.id);
        return (
          <Box
            key={c.id}
            component={Link}
            to={`/challenges/${c.slug}`}
            sx={{
              textDecoration: 'none',
              display: 'grid',
              gridTemplateColumns: '1fr 80px 80px',
              gap: 2,
              alignItems: 'center',
              px: 2,
              py: 1.5,
              borderBottom: `1px solid ${colors.border}`,
              transition: 'background-color 0.1s',
              opacity: 0,
              animation: `${fadeInUp} 0.2s ease ${i * 0.03}s forwards`,
              '&:hover': { backgroundColor: colors.surfaceHover },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: colors.textPrimary, mb: 0.25 }}>
                {c.title}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {c.description}
              </Typography>
            </Box>

            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: DIFFICULTY_TEXT_COLOR[c.difficulty],
              }}
            >
              {DIFFICULTY_LABEL[c.difficulty]}
            </Typography>

            <Box sx={{ textAlign: 'center' }}>
              {solved ? (
                <CheckCircleOutlineIcon sx={{ fontSize: 16, color: colors.success }} />
              ) : (
                <Typography sx={{ fontSize: '0.7rem', color: colors.textTertiary }}>--</Typography>
              )}
            </Box>
          </Box>
        );
      })}

      {!loading && filtered.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ color: colors.textSecondary, fontSize: '0.85rem' }}>
            {search || difficultyFilter !== 'all' || statusFilter !== 'all'
              ? 'No challenges match your filters.'
              : 'No challenges available yet.'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Typography,
} from '@mui/material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { Link } from 'react-router-dom';
import { useChallenges } from '../backend/useChallenges';
import type { Challenge } from '../judge/types';

const DIFFICULTY_CONFIG: Record<
  Challenge['difficulty'],
  { color: 'success' | 'warning' | 'error'; icon: React.ReactElement; label: string }
> = {
  beginner: { color: 'success', icon: <StarBorderIcon fontSize="small" />, label: 'Beginner' },
  intermediate: { color: 'warning', icon: <TrendingUpIcon fontSize="small" />, label: 'Intermediate' },
  advanced: { color: 'error', icon: <WhatshotIcon fontSize="small" />, label: 'Advanced' },
};

export default function ChallengeList() {
  const { data, loading, error } = useChallenges();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        LeetShaders
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Pick a challenge. Write a fragment shader that matches the reference.
      </Typography>

      {loading && <Typography>Loading challenges...</Typography>}
      {error && (
        <Typography sx={{ color: 'error.main' }} role="alert">
          Error: {error.message}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 2,
          mt: 2,
        }}
      >
        {(data ?? []).map((c) => {
          const cfg = DIFFICULTY_CONFIG[c.difficulty];
          return (
            <Card
              key={c.id}
              sx={{
                transition: 'transform 0.15s, box-shadow 0.15s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 },
              }}
            >
              <CardActionArea
                component={Link}
                to={`/challenges/${c.slug}`}
                aria-label={`${c.title}, ${cfg.label} difficulty`}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      icon={cfg.icon}
                      label={cfg.label}
                      color={cfg.color}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="h6" component="h2">
                    {c.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {c.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>

      {!loading && (data ?? []).length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">
            No challenges available yet. Check back soon.
          </Typography>
        </Box>
      )}
    </Container>
  );
}

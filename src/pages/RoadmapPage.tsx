import React from 'react';
import { Box, Container, Grid, Paper, Typography, alpha, CircularProgress } from '@mui/material';
import { RoadmapTree } from '../components/RoadmapTree';
import { styled } from '@mui/material/styles';
import { useChallenges, useSolves } from '../backend/useChallenges';

const DashboardSidebar = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  height: 'fit-content',
  borderRadius: '24px',
  background: alpha(theme.palette.background.paper, 0.4),
  backdropFilter: 'blur(20px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  position: 'sticky',
  top: '100px',
}));

const StatCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: '16px',
  background: alpha(theme.palette.primary.main, 0.05),
  marginBottom: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
}));

const RoadmapPage: React.FC = () => {
  const { data: challenges, loading: loadingChallenges } = useChallenges();
  const { solves, loading: loadingSolves } = useSolves();

  if (loadingChallenges || loadingSolves) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#0f172a' }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalChallenges = challenges?.length || 0;
  const solvedCount = challenges?.filter(c => 
    solves.some(s => s.challenge_id === c.id && s.passed)
  ).length || 0;

  const totalProgress = totalChallenges > 0 ? Math.round((solvedCount / totalChallenges) * 100) : 0;

  return (
    <Box sx={{ bgcolor: '#0f172a', minHeight: '100vh', pt: 12, pb: 8 }}>
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Main Roadmap Tree */}
          <Grid item xs={12} md={8}>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h3" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>
                Shader Learning Path
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Master the art of GLSL from scratch. Follow the path, solve challenges, and become a grandmaster.
              </Typography>
            </Box>
            <RoadmapTree />
          </Grid>

          {/* Sidebar Stats */}
          <Grid item xs={12} md={4}>
            <DashboardSidebar elevation={0}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                Your Progress
              </Typography>
              
              <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', mb: 4 }}>
                <CircularProgress
                  variant="determinate"
                  value={totalProgress}
                  size={120}
                  thickness={5}
                  sx={{ color: 'primary.main' }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {solvedCount}/{totalChallenges}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    SOLVED
                  </Typography>
                </Box>
              </Box>

              <StatCard>
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                  Current Streak
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  5 Days 🔥
                </Typography>
              </StatCard>

              <StatCard>
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                  Next Milestone
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Unlock "Textures"
                </Typography>
              </StatCard>
            </DashboardSidebar>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default RoadmapPage;

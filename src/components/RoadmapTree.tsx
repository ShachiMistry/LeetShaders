import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { RoadmapNode } from './RoadmapNode';
import { styled } from '@mui/material/styles';
import { useChallenges, useSolves } from '../backend/useChallenges'; // Assuming these hooks exist or we will create them

const TreeContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '60px',
  padding: theme.spacing(4),
  position: 'relative',
}));

export const RoadmapTree: React.FC = () => {
  const { data: challenges, loading: loadingChallenges } = useChallenges();
  const { solves, loading: loadingSolves } = useSolves();

  if (loadingChallenges || loadingSolves || !challenges) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Group challenges by category and calculate progress
  const categories = [
    'Fundamentals',
    '2D Patterns',
    'SDFs & Shapes',
    'Textures',
    'Advanced Effects'
  ];

  const roadmapNodes = categories.map(cat => {
    const catChallenges = challenges.filter(c => c.category === cat);
    const solvedInCat = catChallenges.filter(c => 
      solves.some(s => s.challenge_id === c.id && s.passed)
    ).length;
    
    const total = catChallenges.length || 0;
    const progress = total > 0 ? Math.round((solvedInCat / total) * 100) : 0;

    return {
      id: cat,
      title: cat,
      solved: solvedInCat,
      total,
      progress,
      status: solvedInCat === total && total > 0 ? 'completed' : 'unlocked'
    };
  });

  return (
    <TreeContainer>
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '80px' }}>
        {roadmapNodes.map((node, index) => (
          <React.Fragment key={node.id}>
            <RoadmapNode
              title={node.title}
              progress={node.progress}
              solved={node.solved}
              total={node.total}
              status={node.status as any}
            />
            {index < roadmapNodes.length - 1 && (
              <Box
                sx={{
                  height: '80px',
                  width: '2px',
                  bgcolor: node.progress === 100 ? 'primary.main' : 'divider',
                  transition: 'all 0.3s ease',
                }}
              />
            )}
          </React.Fragment>
        ))}
      </Box>
    </TreeContainer>
  );
};

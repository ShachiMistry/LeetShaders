import React from 'react';
import { Box, Typography, LinearProgress, Paper, alpha } from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion } from 'framer-motion';

interface RoadmapNodeProps {
  title: string;
  progress: number; // 0 to 100
  total: number;
  solved: number;
  status: 'locked' | 'unlocked' | 'completed';
  onClick?: () => void;
}

const StyledNode = styled(motion.div)(({ theme }) => ({
  cursor: 'pointer',
  width: '240px',
  padding: theme.spacing(2),
  borderRadius: '16px',
  background: alpha(theme.palette.background.paper, 0.8),
  backdropFilter: 'blur(10px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
    borderColor: theme.palette.primary.main,
    boxShadow: `0 12px 48px 0 ${alpha(theme.palette.primary.main, 0.3)}`,
  },
}));

const ProgressWrapper = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1.5),
  position: 'relative',
}));

const StyledLinearProgress = styled(LinearProgress)(({ theme }) => ({
  height: 8,
  borderRadius: 4,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  '& .MuiLinearProgress-bar': {
    borderRadius: 4,
  },
}));

export const RoadmapNode: React.FC<RoadmapNodeProps> = ({
  title,
  progress,
  total,
  solved,
  status,
  onClick,
}) => {
  const isLocked = status === 'locked';

  return (
    <StyledNode
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.95 }}
      onClick={!isLocked ? onClick : undefined}
      style={{ opacity: isLocked ? 0.5 : 1 }}
    >
      <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'text.primary' }}>
        {title}
      </Typography>
      
      <ProgressWrapper>
        <StyledLinearProgress variant="determinate" value={progress} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {progress}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {solved}/{total}
          </Typography>
        </Box>
      </ProgressWrapper>
    </StyledNode>
  );
};

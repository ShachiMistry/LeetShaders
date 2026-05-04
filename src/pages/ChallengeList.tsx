// Editor & UI Lead owns this file. See EDITOR_LEAD.md task 6.

import { Box, Card, CardActionArea, CardContent, Chip, Container, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useChallenges } from '../backend/useChallenges';

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

      {loading ? <Box>Loading challenges...</Box> : null}
      {error ? <Box sx={{ color: 'error.main' }}>Error: {error.message}</Box> : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 2,
          mt: 2,
        }}
      >
        {(data ?? []).map((c) => (
          <Card key={c.id}>
            <CardActionArea component={Link} to={`/challenges/${c.slug}`}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip size="small" label={c.difficulty} />
                </Box>
                <Typography variant="h6">{c.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {c.description}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Container>
  );
}

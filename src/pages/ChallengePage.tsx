// Editor & UI Lead owns this file. See EDITOR_LEAD.md task 2.

import { Box, Button, Container, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import Monaco from '../editor/Monaco';
import LivePreview from '../editor/LivePreview';
import ErrorConsole from '../editor/ErrorConsole';
import { useChallenge } from '../backend/useChallenges';

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

export default function ChallengePage() {
  const { slug = '' } = useParams();
  const { data: challenge, loading } = useChallenge(slug);
  const [src, setSrc] = useState(STARTER);
  const referenceSrc = useMemo(() => challenge?.referenceShaderSrc ?? '', [challenge]);

  if (loading) return <Container sx={{ py: 4 }}>Loading...</Container>;
  if (!challenge) return <Container sx={{ py: 4 }}>Challenge not found.</Container>;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h5" gutterBottom>
        {challenge.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {challenge.description}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: 'minmax(320px, 60vh)',
          gap: 2,
          mb: 2,
        }}
      >
        <Box sx={{ border: '1px solid #2a2f3e' }}>
          <Monaco value={src} onChange={setSrc} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <LivePreview shaderSrc={src} label="Your output" />
          <LivePreview shaderSrc={referenceSrc} label="Reference" />
        </Box>
      </Box>

      <ErrorConsole errors={[]} />

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" color="primary">
          Submit
        </Button>
      </Box>
    </Container>
  );
}

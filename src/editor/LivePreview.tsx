// Editor & UI Lead owns this file. See EDITOR_LEAD.md task 3.
//
// CRITICAL: Do not spin up a second WebGL context. Import the shared pipeline
// from src/judge/pipeline.ts. If something suggests otherwise, push back.

import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';

interface LivePreviewProps {
  shaderSrc: string;
  label?: string;
}

export default function LivePreview({ shaderSrc, label }: LivePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // TODO: wire to pipeline.compileShader + pipeline.render via a debounced
    // (300ms) effect. Use requestAnimationFrame for u_time animation.
    // Share the same time clock with the reference-output preview.
    void shaderSrc;
  }, [shaderSrc]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {label ? <Box sx={{ fontSize: 12, opacity: 0.7 }}>{label}</Box> : null}
      <canvas
        ref={canvasRef}
        width={512}
        height={512}
        style={{ width: '100%', maxWidth: 512, aspectRatio: '1 / 1', background: '#000' }}
      />
    </Box>
  );
}

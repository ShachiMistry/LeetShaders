import { Box, Typography } from '@mui/material';
import { useEffect, useRef, useCallback } from 'react';
import { compileShader, render, CANVAS_SIZE } from '../judge/pipeline';
import type { ShaderError, PipelineError } from '../judge/types';
import { shaderErrorToPipelineErrors } from '../judge/types';

interface LivePreviewProps {
  shaderSrc: string;
  label?: string;
  timeRef?: React.MutableRefObject<number>;
  onErrors?: (errors: PipelineError[]) => void;
}

export default function LivePreview({ shaderSrc, label, timeRef, onErrors }: LivePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const rafRef = useRef<number>(0);
  const srcRef = useRef(shaderSrc);

  srcRef.current = shaderSrc;

  const compileAndNotify = useCallback(
    (src: string) => {
      const result = compileShader(src);
      if ('type' in result) {
        programRef.current = null;
        onErrors?.(shaderErrorToPipelineErrors(result as ShaderError));
      } else {
        programRef.current = result;
        onErrors?.([]);
      }
    },
    [onErrors],
  );

  useEffect(() => {
    compileAndNotify(shaderSrc);
  }, [shaderSrc, compileAndNotify]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);

    function drawFrame() {
      const prog = programRef.current;
      if (prog && ctx) {
        const t = timeRef ? timeRef.current : performance.now() / 1000;
        const pixels = render(prog, {
          u_time: t,
          u_resolution: [CANVAS_SIZE, CANVAS_SIZE],
        });

        // WebGL readPixels returns bottom-up rows, canvas expects top-down.
        for (let y = 0; y < CANVAS_SIZE; y++) {
          const srcRow = (CANVAS_SIZE - 1 - y) * CANVAS_SIZE * 4;
          const dstRow = y * CANVAS_SIZE * 4;
          imageData.data.set(pixels.subarray(srcRow, srcRow + CANVAS_SIZE * 4), dstRow);
        }
        ctx.putImageData(imageData, 0, 0);
      }
      rafRef.current = requestAnimationFrame(drawFrame);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [timeRef]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, minHeight: 0 }}>
      {label ? (
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {label}
        </Typography>
      ) : null}
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{
          width: '100%',
          maxWidth: CANVAS_SIZE,
          aspectRatio: '1 / 1',
          background: '#000',
          borderRadius: 4,
        }}
      />
    </Box>
  );
}

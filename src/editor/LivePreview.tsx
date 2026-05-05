import { useEffect, useRef } from 'react';
import { compileShader, render, CANVAS_SIZE } from '../judge/pipeline';
import type { ShaderError, PipelineError } from '../judge/types';
import { shaderErrorToPipelineErrors } from '../judge/types';

interface LivePreviewProps {
  shaderSrc: string;
  label?: string;
  timeRef?: React.MutableRefObject<number>;
  onErrors?: (errors: PipelineError[]) => void;
}

export default function LivePreview({ shaderSrc, timeRef, onErrors }: LivePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const rafRef = useRef<number>(0);
  const onErrorsRef = useRef(onErrors);
  onErrorsRef.current = onErrors;

  useEffect(() => {
    const result = compileShader(shaderSrc);
    if ('type' in result) {
      onErrorsRef.current?.(shaderErrorToPipelineErrors(result as ShaderError));
    } else {
      programRef.current = result;
      onErrorsRef.current?.([]);
    }
  }, [shaderSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const imageData = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
    let active = true;

    function drawFrame() {
      if (!active) return;
      const prog = programRef.current;
      if (prog && ctx) {
        try {
          const t = timeRef ? timeRef.current : performance.now() / 1000;
          const pixels = render(prog, {
            u_time: t,
            u_resolution: [CANVAS_SIZE, CANVAS_SIZE],
          });

          for (let y = 0; y < CANVAS_SIZE; y++) {
            const srcRow = (CANVAS_SIZE - 1 - y) * CANVAS_SIZE * 4;
            const dstRow = y * CANVAS_SIZE * 4;
            imageData.data.set(pixels.subarray(srcRow, srcRow + CANVAS_SIZE * 4), dstRow);
          }
          ctx.putImageData(imageData, 0, 0);
        } catch {
          // render failed, keep last frame
        }
      }
      rafRef.current = requestAnimationFrame(drawFrame);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [timeRef]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
      }}
    />
  );
}

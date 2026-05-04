import type { MAEResult } from './types';

// Per-channel RGB mean absolute error across all pixels.
// Alpha is ignored — shader output alpha is not part of visual similarity.
export function computeMAE(bufferA: Uint8Array, bufferB: Uint8Array): number {
  if (bufferA.length !== bufferB.length) {
    throw new Error(`Buffer size mismatch: ${bufferA.length} vs ${bufferB.length}`);
  }

  let sum = 0;
  const pixelCount = bufferA.length / 4;

  for (let i = 0; i < bufferA.length; i += 4) {
    sum += Math.abs(bufferA[i]     - bufferB[i]);      // R
    sum += Math.abs(bufferA[i + 1] - bufferB[i + 1]);  // G
    sum += Math.abs(bufferA[i + 2] - bufferB[i + 2]);  // B
  }

  // Normalize to [0, 255] range
  return sum / (pixelCount * 3);
}

// tolerance comes from Challenge.tolerance — hand-tuned per challenge.
export function scoreFromMAE(rawMae: number, tolerance: number): number {
  return Math.max(0, 100 - (rawMae / tolerance) * 100);
}

export function computeMAEResult(
  bufferA: Uint8Array,
  bufferB: Uint8Array,
  tolerance: number,
  blurApplied: boolean = false,
): MAEResult {
  const rawMae = computeMAE(bufferA, bufferB);
  const score = scoreFromMAE(rawMae, tolerance);
  return { score, rawMae, blurApplied };
}

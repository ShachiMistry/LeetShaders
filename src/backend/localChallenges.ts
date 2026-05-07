import type { Challenge } from '../judge/types';

import solidColorJson from '../challenges/solid-color.json';
import solidColorGlsl from '../challenges/solid-color.glsl?raw';

import uvGradientJson from '../challenges/uv-gradient.json';
import uvGradientGlsl from '../challenges/uv-gradient.glsl?raw';

import checkerboardJson from '../challenges/checkerboard.json';
import checkerboardGlsl from '../challenges/checkerboard.glsl?raw';

import circleSdfJson from '../challenges/circle-sdf.json';
import circleSdfGlsl from '../challenges/circle-sdf.glsl?raw';

import radialGradientJson from '../challenges/radial-gradient.json';
import radialGradientGlsl from '../challenges/radial-gradient.glsl?raw';

import boxSdfJson from '../challenges/box-sdf.json';
import boxSdfGlsl from '../challenges/box-sdf.glsl?raw';

import hsvColorWheelJson from '../challenges/hsv-color-wheel.json';
import hsvColorWheelGlsl from '../challenges/hsv-color-wheel.glsl?raw';

import polarPatternJson from '../challenges/polar-pattern.json';
import polarPatternGlsl from '../challenges/polar-pattern.glsl?raw';

import raymarchedSphereJson from '../challenges/raymarched-sphere.json';
import raymarchedSphereGlsl from '../challenges/raymarched-sphere.glsl?raw';

interface ChallengeFile {
  meta: Record<string, unknown>;
  glsl: string;
}

const files: ChallengeFile[] = [
  { meta: solidColorJson, glsl: solidColorGlsl },
  { meta: uvGradientJson, glsl: uvGradientGlsl },
  { meta: checkerboardJson, glsl: checkerboardGlsl },
  { meta: circleSdfJson, glsl: circleSdfGlsl },
  { meta: boxSdfJson, glsl: boxSdfGlsl },
  { meta: radialGradientJson, glsl: radialGradientGlsl },
  { meta: hsvColorWheelJson, glsl: hsvColorWheelGlsl },
  { meta: polarPatternJson, glsl: polarPatternGlsl },
  { meta: raymarchedSphereJson, glsl: raymarchedSphereGlsl },
];

function toChallenge(meta: Record<string, unknown>, glsl: string): Challenge {
  return {
    id: meta.id as string,
    slug: meta.slug as string,
    title: meta.title as string,
    description: meta.description as string,
    difficulty: meta.difficulty as Challenge['difficulty'],
    referenceShaderSrc: glsl,
    tolerance: meta.tolerance as number,
    useBlur: meta.useBlur as boolean,
    hintText: (meta.hintText as string) ?? undefined,
  };
}

export const LOCAL_CHALLENGES: Challenge[] = files.map((f) => toChallenge(f.meta, f.glsl));

export interface Challenge {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  referenceShaderSrc: string;
  tolerance: number;
  useBlur: boolean;
  hintText?: string;
}

export interface JudgeResult {
  maeScore: number;
  llmScore: number | null;
  finalScore: number;
  passed: boolean;
  breakdown: {
    maeRaw: number;
    llmReasoning?: string;
    stageTwoInvoked: boolean;
  };
  renderLatencyMs: number;
  judgeLatencyMs: number;
}

export interface MAEResult {
  score: number;
  rawMae: number;
  blurApplied: boolean;
}

export interface LLMJudgeInput {
  userRender: Uint8Array;
  referenceRender: Uint8Array;
  userShaderSrc: string;
  challenge: Challenge;
}

export interface LLMJudgeOutput {
  score: number;
  reasoning: string;
  flagged: boolean;
}

export type LLMJudgeFn = (input: LLMJudgeInput) => Promise<LLMJudgeOutput>;

export interface ShaderCompileError {
  type: 'compile_error';
  message: string;
  errors: { line: number; message: string }[];
}

export interface ShaderTimeoutError {
  type: 'timeout';
  message: string;
}

export type ShaderError = ShaderCompileError | ShaderTimeoutError;

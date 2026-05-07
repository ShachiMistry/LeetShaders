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
    llmUnavailable?: boolean;
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

export interface ShaderContextLostError {
  type: 'context_lost';
  message: string;
}

export type ShaderError = ShaderCompileError | ShaderTimeoutError | ShaderContextLostError;

export interface PipelineError {
  kind: 'compile-error' | 'link-error' | 'context-lost' | 'timeout';
  line?: number;
  column?: number;
  message: string;
}

export function shaderErrorToPipelineErrors(err: ShaderError): PipelineError[] {
  if (err.type === 'compile_error') {
    if (err.errors.length === 0) {
      return [{ kind: 'compile-error', message: err.message }];
    }
    return err.errors.map((e) => ({
      kind: 'compile-error' as const,
      line: e.line,
      message: e.message,
    }));
  }
  if (err.type === 'timeout') {
    return [{ kind: 'timeout', message: err.message }];
  }
  return [{ kind: 'context-lost', message: err.message }];
}

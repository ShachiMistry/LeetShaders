import type * as Monaco from 'monaco-editor';

let registered = false;

export function registerGLSL(monaco: typeof Monaco): void {
  if (registered) return;
  registered = true;

  monaco.languages.register({ id: 'glsl' });

  monaco.languages.setLanguageConfiguration('glsl', {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
  });

  monaco.languages.setMonarchTokensProvider('glsl', {
    defaultToken: '',
    controlKeywords: [
      'if', 'else', 'for', 'while', 'do', 'return', 'break', 'continue',
      'discard', 'struct', 'const',
      'uniform', 'varying', 'attribute',
      'in', 'out', 'inout',
      'precision', 'lowp', 'mediump', 'highp',
    ],
    typeKeywords: [
      'void', 'bool', 'int', 'uint', 'float', 'double',
      'vec2', 'vec3', 'vec4',
      'bvec2', 'bvec3', 'bvec4',
      'ivec2', 'ivec3', 'ivec4',
      'uvec2', 'uvec3', 'uvec4',
      'mat2', 'mat3', 'mat4', 'mat2x3', 'mat3x2', 'mat3x4', 'mat4x3',
      'sampler2D', 'samplerCube',
    ],
    builtins: [
      'texture', 'texture2D', 'textureCube',
      'mix', 'smoothstep', 'step', 'clamp', 'min', 'max',
      'abs', 'sign', 'floor', 'ceil', 'fract', 'mod',
      'length', 'normalize', 'dot', 'cross', 'reflect', 'refract',
      'pow', 'exp', 'log', 'sqrt',
      'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
      'radians', 'degrees',
    ],
    glVars: [
      'gl_FragCoord', 'gl_FragColor', 'gl_Position',
      'gl_PointCoord', 'gl_FrontFacing',
    ],
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@blockComment'],
        [/#\w+/, 'preprocessor'],
        [/\b\d+\.\d*([eE][+-]?\d+)?[fF]?\b/, 'number.float'],
        [/\b\d+[fF]\b/, 'number.float'],
        [/\b\d+\b/, 'number'],
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              '@controlKeywords': 'keyword',
              '@typeKeywords': 'type',
              '@builtins': 'function',
              '@glVars': 'variable',
              '@default': 'identifier',
            },
          },
        ],
        [/[{}()[\]]/, 'delimiter.bracket'],
        [/[;,.]/, 'delimiter'],
        [/[=+\-*/%<>!&|^~?:]/, 'operator'],
      ],
      blockComment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/./, 'comment'],
      ],
    },
  });
}

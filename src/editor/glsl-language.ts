// Editor & UI Lead owns this file. See EDITOR_LEAD.md task 1.
//
// GLSL is not a built-in Monaco language. Register it once, up front, before
// mounting any editor that requests `language: 'glsl'`.
//
// The tokenizer below is a starter skeleton - complete the keyword, builtin,
// and number-literal lists against the GLSL ES 3.0 spec before shipping.

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
    keywords: [
      'void', 'bool', 'int', 'uint', 'float', 'double',
      'vec2', 'vec3', 'vec4',
      'bvec2', 'bvec3', 'bvec4',
      'ivec2', 'ivec3', 'ivec4',
      'uvec2', 'uvec3', 'uvec4',
      'mat2', 'mat3', 'mat4', 'mat2x3', 'mat3x2', 'mat3x4', 'mat4x3',
      'sampler2D', 'samplerCube',
      'uniform', 'varying', 'attribute',
      'in', 'out', 'inout',
      'precision', 'lowp', 'mediump', 'highp',
      'if', 'else', 'for', 'while', 'do', 'return', 'break', 'continue',
      'discard', 'struct', 'const',
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
        [/\b\d+\.\d*([eE][+-]?\d+)?[fF]?\b/, 'number.float'],
        [/\b\d+[fF]\b/, 'number.float'],
        [/\b\d+\b/, 'number'],
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@builtins': 'support.function',
              '@glVars': 'variable.predefined',
              '@default': 'identifier',
            },
          },
        ],
        [/[{}()[\]]/, '@brackets'],
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

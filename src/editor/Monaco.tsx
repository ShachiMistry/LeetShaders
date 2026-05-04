// Editor & UI Lead owns this file. See EDITOR_LEAD.md task 1.

import Editor, { type OnMount } from '@monaco-editor/react';
import { useCallback } from 'react';
import { registerGLSL } from './glsl-language';

interface MonacoProps {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}

export default function Monaco({ value, onChange, readOnly = false }: MonacoProps) {
  const onMount: OnMount = useCallback((_editor, monaco) => {
    registerGLSL(monaco);
  }, []);

  return (
    <Editor
      language="glsl"
      theme="vs-dark"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={onMount}
      options={{
        readOnly,
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
        wordWrap: 'on',
      }}
    />
  );
}

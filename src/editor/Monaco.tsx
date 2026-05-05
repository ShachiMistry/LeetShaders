import Editor, { type OnMount } from '@monaco-editor/react';
import { useCallback, useRef, useEffect } from 'react';
import type * as MonacoNs from 'monaco-editor';
import { registerGLSL } from './glsl-language';
import type { PipelineError } from '../judge/types';

interface MonacoProps {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  errors?: PipelineError[];
  onJumpToLine?: React.MutableRefObject<((line: number) => void) | null>;
}

export default function Monaco({ value, onChange, readOnly = false, errors, onJumpToLine }: MonacoProps) {
  const editorRef = useRef<MonacoNs.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof MonacoNs | null>(null);

  const onMount: OnMount = useCallback(
    (editor, monaco) => {
      registerGLSL(monaco);
      editorRef.current = editor;
      monacoRef.current = monaco;

      if (onJumpToLine) {
        onJumpToLine.current = (line: number) => {
          editor.revealLineInCenter(line);
          editor.setPosition({ lineNumber: line, column: 1 });
          editor.focus();
        };
      }
    },
    [onJumpToLine],
  );

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const markers: MonacoNs.editor.IMarkerData[] = (errors ?? [])
      .filter((e) => e.kind === 'compile-error' && e.line != null)
      .map((e) => ({
        severity: monaco.MarkerSeverity.Error,
        startLineNumber: e.line!,
        startColumn: e.column ?? 1,
        endLineNumber: e.line!,
        endColumn: e.column != null ? e.column + 1 : model.getLineMaxColumn(e.line!),
        message: e.message,
      }));

    monaco.editor.setModelMarkers(model, 'glsl', markers);
  }, [errors]);

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
        accessibilitySupport: 'on',
      }}
    />
  );
}

import Editor, { type OnMount } from '@monaco-editor/react';
import { useCallback, useRef, useEffect } from 'react';
import type * as MonacoNs from 'monaco-editor';
import { registerGLSL } from './glsl-language';
import { LEETSHADERS_DARK_THEME, LEETSHADERS_LIGHT_THEME, leetshadersDarkTheme, leetshadersLightTheme } from './shaderTheme';
import { useThemeStore } from '../store/themeStore';
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
  const mode = useThemeStore((s) => s.mode);
  const themeName = mode === 'dark' ? LEETSHADERS_DARK_THEME : LEETSHADERS_LIGHT_THEME;

  const onMount: OnMount = useCallback(
    (editor, monaco) => {
      registerGLSL(monaco);
      monaco.editor.defineTheme(LEETSHADERS_DARK_THEME, leetshadersDarkTheme);
      monaco.editor.defineTheme(LEETSHADERS_LIGHT_THEME, leetshadersLightTheme);
      monaco.editor.setTheme(themeName);
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
    [onJumpToLine, themeName],
  );

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    monaco.editor.setTheme(themeName);
  }, [themeName]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const lineCount = model.getLineCount();
    const markers: MonacoNs.editor.IMarkerData[] = (errors ?? [])
      .filter((e) => e.kind === 'compile-error' && e.line != null && e.line > 0 && e.line <= lineCount)
      .map((e) => {
        const line = e.line!;
        let endCol: number;
        try { endCol = e.column != null ? e.column + 1 : model.getLineMaxColumn(line); } catch { endCol = 1; }
        return {
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: line,
          startColumn: e.column ?? 1,
          endLineNumber: line,
          endColumn: endCol,
          message: e.message,
        };
      });

    monaco.editor.setModelMarkers(model, 'glsl', markers);
  }, [errors]);

  return (
    <Editor
      language="glsl"
      theme={themeName}
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

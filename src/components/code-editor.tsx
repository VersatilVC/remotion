'use client';

import { Editor } from '@monaco-editor/react';
import { Card } from './ui/card';

interface CodeEditorProps {
  code: string;
  onChange: (value: string | undefined) => void;
  isStreaming?: boolean;
}

export function CodeEditor({ code, onChange, isStreaming }: CodeEditorProps) {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Generated Code</h3>
          {isStreaming && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs text-zinc-500">Generating...</span>
            </div>
          )}
        </div>
        <span className="text-xs text-zinc-500">TypeScript • React</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          value={code}
          onChange={onChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            readOnly: isStreaming,
          }}
        />
      </div>
    </Card>
  );
}

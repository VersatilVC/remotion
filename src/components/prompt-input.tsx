'use client';

import { useState } from 'react';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';

interface PromptInputProps {
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  initialPrompt?: string;
}

export function PromptInput({
  onGenerate,
  isGenerating,
  initialPrompt = '',
}: PromptInputProps) {
  const [prompt, setPrompt] = useState(initialPrompt);

  const handleSubmit = () => {
    if (prompt.trim() && !isGenerating) {
      onGenerate(prompt);
    }
  };

  return (
    <Card className="p-4">
      <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
        Describe your video or request changes
      </label>
      <Textarea
        placeholder="Make the text bigger and add a smooth fade-out effect at the end..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="min-h-24 text-sm resize-none mb-3"
        disabled={isGenerating}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleSubmit();
          }
        }}
      />
      <div className="flex justify-between items-center">
        <p className="text-xs text-zinc-500">
          Press{' '}
          <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">
            Cmd+Enter
          </kbd>{' '}
          to generate
        </p>
        <Button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isGenerating}
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
        >
          {isGenerating ? 'Generating...' : 'Generate'}
        </Button>
      </div>
    </Card>
  );
}

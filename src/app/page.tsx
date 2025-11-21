'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

const DURATION_OPTIONS = [
  { seconds: 4, frames: 120, label: '4s' },
  { seconds: 6, frames: 180, label: '6s' },
  { seconds: 10, frames: 300, label: '10s' },
  { seconds: 15, frames: 450, label: '15s' },
];

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(120); // Default 4 seconds

  const handleStart = () => {
    if (prompt.trim()) {
      router.push(`/create?prompt=${encodeURIComponent(prompt)}&duration=${duration}`);
    }
  };

  const examplePrompts = [
    'Create a modern marketing video with animated text revealing a product name',
    'Make an animated logo intro with a fade-in effect',
    'Design a countdown timer animation from 10 to 1',
    'Create a social media post animation with sliding text and images',
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 p-4">
      <main className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
            AI Video Creator
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400">
            Turn your ideas into animated videos with AI
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2">
            Powered by Claude & Remotion
          </p>
        </div>

        <Card className="p-8 mb-8 shadow-xl">
          <label className="block text-sm font-medium mb-3 text-zinc-700 dark:text-zinc-300">
            Describe your video
          </label>
          <Textarea
            placeholder="Create a professional marketing video with animated text that says 'Welcome to the Future' with a smooth fade-in effect..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-32 text-base resize-none mb-4"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleStart();
              }
            }}
          />

          {/* Duration Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-zinc-700 dark:text-zinc-300">
              Video Length
            </label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((option) => (
                <Button
                  key={option.frames}
                  onClick={() => setDuration(option.frames)}
                  variant={duration === option.frames ? 'default' : 'outline'}
                  className={
                    duration === option.frames
                      ? 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700'
                      : ''
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Selected: {duration} frames ({duration / 30} seconds at 30fps)
            </p>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-zinc-500">
              Press <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">Cmd+Enter</kbd> to generate
            </p>
            <Button
              onClick={handleStart}
              disabled={!prompt.trim()}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
            >
              Generate Video
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Try these examples:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {examplePrompts.map((example, index) => (
              <Card
                key={index}
                className="p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-zinc-200 dark:border-zinc-800"
                onClick={() => setPrompt(example)}
              >
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {example}
                </p>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-3xl mb-2">🤖</div>
            <h3 className="font-semibold mb-1">AI-Powered</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Claude generates Remotion code from your prompts
            </p>
          </div>
          <div>
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="font-semibold mb-1">Instant Preview</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              See your video come to life in real-time
            </p>
          </div>
          <div>
            <div className="text-3xl mb-2">🎨</div>
            <h3 className="font-semibold mb-1">Fully Customizable</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Edit the code and iterate on your design
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';

interface VideoPreviewProps {
  code: string;
}

export function VideoPreview({ code }: VideoPreviewProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState('');

  const generatePreview = async () => {
    if (!code || code.trim().length === 0) {
      return;
    }

    // Don't regenerate if code hasn't changed
    if (code === lastCode) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewImage(null);

    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview');
      }

      const data = await response.json();
      setPreviewImage(data.image);
      setLastCode(code);
    } catch (err) {
      console.error('Preview error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setIsLoading(false);
    }
  };

  const hasCode = code && code.trim().length > 0;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
        <h3 className="font-semibold text-sm">Video Preview</h3>
        <div className="flex items-center gap-2">
          {isLoading && (
            <Badge variant="secondary" className="text-xs">
              <span className="animate-pulse">Rendering...</span>
            </Badge>
          )}
          {hasCode && !isLoading && (
            <Button
              size="sm"
              variant="outline"
              onClick={generatePreview}
              className="text-xs h-7"
            >
              Generate Preview
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 p-4">
        {error ? (
          <div className="text-center p-4 max-w-md">
            <div className="text-red-500 text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">
              Preview Error
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              {error}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={generatePreview}
            >
              Try Again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <h3 className="text-lg font-semibold mb-2">Rendering Preview...</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              This may take 10-30 seconds
            </p>
          </div>
        ) : previewImage ? (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4">
              <img
                src={previewImage}
                alt="Video preview"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800"
              />
            </div>
            <div className="p-3 text-center border-t bg-zinc-50 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500">
                Preview frame from middle of video (60/120 frames)
              </p>
            </div>
          </div>
        ) : hasCode ? (
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-lg font-semibold mb-2">Code Generated!</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Click "Generate Preview" to see a preview frame of your video
            </p>
            <Button
              onClick={generatePreview}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
            >
              Generate Preview
            </Button>
            <p className="text-xs text-zinc-500 mt-4">
              Preview renders a single frame from your video
            </p>
          </div>
        ) : (
          <div className="text-center text-zinc-500">
            <div className="text-4xl mb-3">📹</div>
            <p className="text-sm font-medium">No code generated yet</p>
            <p className="text-xs mt-1">Enter a prompt to generate your video</p>
          </div>
        )}
      </div>
    </Card>
  );
}

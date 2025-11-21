'use client';

import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';

interface VideoPreviewProps {
  code: string;
  duration?: number;
}

type RenderState = 'idle' | 'rendering' | 'polling' | 'complete' | 'error';

export function VideoPreview({ code, duration = 120 }: VideoPreviewProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState('');

  // Full video rendering state
  const [renderState, setRenderState] = useState<RenderState>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [bucketName, setBucketName] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [configError, setConfigError] = useState(false);

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
        body: JSON.stringify({ code, duration }),
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

  const renderFullVideo = async () => {
    if (!code || code.trim().length === 0) {
      return;
    }

    // Prevent rapid re-renders
    if (renderState === 'rendering' || renderState === 'polling') {
      return;
    }

    setRenderState('rendering');
    setError(null);
    setVideoUrl(null);
    setRenderProgress(0);
    setConfigError(false);

    try {
      // Initiate Lambda render
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, duration }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.configError) {
          setConfigError(true);
        }
        throw new Error(errorData.error || 'Failed to start render');
      }

      const data = await response.json();
      setRenderId(data.renderId);
      setBucketName(data.bucketName);
      setRegion(data.region);

      // Start polling for progress
      setRenderState('polling');
      pollRenderProgress(data.renderId, data.bucketName, data.region);
    } catch (err) {
      console.error('Render error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render video');
      setRenderState('error');
    }
  };

  const pollRenderProgress = async (
    renderId: string,
    bucketName: string,
    region: string
  ) => {
    const pollInterval = 3000; // Poll every 3 seconds
    let attempts = 0;
    const maxAttempts = 120; // 6 minutes max

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError('Render timeout - please try again');
        setRenderState('error');
        return;
      }

      try {
        const response = await fetch(
          `/api/render/progress?renderId=${renderId}&bucketName=${bucketName}&region=${region}`
        );

        if (!response.ok) {
          throw new Error('Failed to get render progress');
        }

        const data = await response.json();

        setRenderProgress(data.overallProgress);

        if (data.done && data.outputFile) {
          setVideoUrl(data.outputFile);
          setRenderState('complete');
          return;
        }

        if (data.fatalErrorEncountered) {
          const errorMsg = typeof data.errors?.[0] === 'string'
            ? data.errors[0]
            : data.errors?.[0]?.message || JSON.stringify(data.errors?.[0]) || 'Render failed';

          // Check if it's a rate limit error
          if (errorMsg.includes('Concurrency limit') || errorMsg.includes('Rate Exceeded')) {
            throw new Error('AWS rate limit reached. Please wait 30-60 seconds and try again, or increase your Lambda concurrency limits.');
          }

          throw new Error(errorMsg);
        }

        attempts++;
        setTimeout(poll, pollInterval);
      } catch (err) {
        console.error('Progress polling error:', err);
        const errorMessage = err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null
          ? JSON.stringify(err)
          : 'Failed to check render progress';
        setError(errorMessage);
        setRenderState('error');
      }
    };

    poll();
  };

  const hasCode = code && code.trim().length > 0;
  const isRenderingVideo = renderState === 'rendering' || renderState === 'polling';

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
          {isRenderingVideo && (
            <Badge variant="secondary" className="text-xs">
              <span className="animate-pulse">
                {renderState === 'rendering' ? 'Starting...' : `${Math.round(renderProgress * 100)}%`}
              </span>
            </Badge>
          )}
          {hasCode && !isLoading && !isRenderingVideo && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={generatePreview}
                className="text-xs h-7"
              >
                Quick Preview
              </Button>
              <Button
                size="sm"
                onClick={renderFullVideo}
                className="text-xs h-7 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
              >
                Render Video
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 p-4 overflow-auto">
        {error ? (
          <div className="text-center p-4 max-w-md">
            <div className="text-red-500 text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">
              {configError ? 'Lambda Not Configured' : error.includes('rate limit') ? 'AWS Rate Limit' : 'Error'}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              {error}
            </p>
            {configError && (
              <p className="text-xs text-zinc-500 mb-4">
                You can still use Quick Preview. See README for Lambda setup instructions.
              </p>
            )}
            {error.includes('rate limit') && (
              <div className="text-xs text-zinc-500 mb-4 space-y-2 text-left bg-zinc-100 dark:bg-zinc-800 p-3 rounded">
                <p className="font-semibold">To fix this:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Wait 5-10 minutes before trying again</li>
                  <li>Only render one video at a time</li>
                  <li>Or increase your AWS Lambda concurrency limits in AWS Console</li>
                </ul>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={configError ? generatePreview : renderFullVideo}
              disabled={error.includes('rate limit')}
            >
              {configError ? 'Try Quick Preview' : error.includes('rate limit') ? 'Wait and Try Again Later' : 'Try Again'}
            </Button>
          </div>
        ) : isRenderingVideo ? (
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {renderState === 'rendering' ? 'Starting Render...' : 'Rendering Video...'}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
              {renderState === 'rendering'
                ? 'Preparing Lambda function'
                : `Progress: ${Math.round(renderProgress * 100)}%`}
            </p>
            <p className="text-xs text-zinc-500">
              This may take 30-60 seconds
            </p>
            {renderState === 'polling' && (
              <div className="mt-4 w-64 mx-auto bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-600 to-violet-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${renderProgress * 100}%` }}
                />
              </div>
            )}
          </div>
        ) : videoUrl ? (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4">
              <video
                src={videoUrl}
                controls
                className="max-w-full max-h-full rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800"
              >
                Your browser does not support video playback.
              </video>
            </div>
            <div className="p-3 text-center border-t bg-zinc-50 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500">
                Full animated video rendered on Lambda
              </p>
            </div>
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
            <div className="p-3 text-center border-t bg-zinc-50 dark:bg-zinc-900 space-y-2">
              <p className="text-xs text-zinc-500">
                Quick preview (single frame at {Math.floor(duration / 2)}/{duration})
              </p>
              <Button
                size="sm"
                onClick={renderFullVideo}
                className="text-xs h-7 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
              >
                Render Full Video
              </Button>
            </div>
          </div>
        ) : hasCode ? (
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-lg font-semibold mb-2">Code Generated!</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Preview a single frame quickly, or render the full animated video
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={generatePreview}
                size="lg"
                variant="outline"
              >
                Quick Preview
              </Button>
              <Button
                onClick={renderFullVideo}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
              >
                Render Full Video
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-4">
              Quick preview: ~10 sec | Full video: ~30-60 sec
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

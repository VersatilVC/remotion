import { useState, useCallback, useRef } from 'react';
import { Shot } from '@/types/shot';

interface RenderQueueItem {
  shot: Shot;
  onProgress?: (progress: number) => void;
  onComplete?: (videoUrl: string) => void;
  onError?: (error: string, isCodeError?: boolean) => void;
  retryCount?: number;
}

export function useSequentialRender() {
  const [isRendering, setIsRendering] = useState(false);
  const [currentRenderingShot, setCurrentRenderingShot] = useState<string | null>(null);
  const [renderProgressMap, setRenderProgressMap] = useState<Map<string, number>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  const queueRef = useRef<RenderQueueItem[]>([]);
  const isProcessingRef = useRef(false);

  const updateProgress = useCallback((shotId: string, progress: number) => {
    setRenderProgressMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(shotId, progress);
      return newMap;
    });
  }, []);

  const updateError = useCallback((shotId: string, error: string) => {
    setErrors((prev) => {
      const newMap = new Map(prev);
      newMap.set(shotId, error);
      return newMap;
    });
  }, []);

  // Detect if error is code-related vs infrastructure-related
  const isCodeRelatedError = (errorMessage: string): boolean => {
    const codeErrorKeywords = [
      'is not a function',
      'is not defined',
      'Cannot read property',
      'Cannot read properties',
      'undefined is not',
      'Unexpected token',
      'SyntaxError',
      'ReferenceError',
      'TypeError',
      'not a valid',
      'Expected',
      'Uncaught',
    ];

    return codeErrorKeywords.some((keyword) =>
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  const renderSingleShot = async (item: RenderQueueItem): Promise<void> => {
    const { shot, onProgress, onComplete, onError } = item;

    try {
      // Initiate render
      const renderResponse = await fetch('/api/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: shot.code,
          duration: shot.duration,
        }),
      });

      if (!renderResponse.ok) {
        const errorData = await renderResponse.json();
        throw new Error(errorData.error || 'Failed to start render');
      }

      const renderData = await renderResponse.json();
      const { renderId, bucketName, region } = renderData;

      // Poll for progress
      const pollInterval = 3000; // 3 seconds
      let attempts = 0;
      const maxAttempts = 120; // 6 minutes max

      const poll = async (): Promise<void> => {
        if (attempts >= maxAttempts) {
          throw new Error('Render timeout');
        }

        const progressResponse = await fetch(
          `/api/render/progress?renderId=${renderId}&bucketName=${bucketName}&region=${region}`
        );

        if (!progressResponse.ok) {
          throw new Error('Failed to get render progress');
        }

        const progressData = await progressResponse.json();

        // Update progress
        const progress = progressData.overallProgress || 0;
        updateProgress(shot.id, progress);
        onProgress?.(progress);

        if (progressData.done && progressData.outputFile) {
          // Render complete
          onComplete?.(progressData.outputFile);
          return;
        }

        if (progressData.fatalErrorEncountered) {
          const errorMsg =
            typeof progressData.errors?.[0] === 'string'
              ? progressData.errors[0]
              : progressData.errors?.[0]?.message ||
                JSON.stringify(progressData.errors?.[0]) ||
                'Render failed';
          throw new Error(errorMsg);
        }

        attempts++;
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        await poll();
      };

      await poll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateError(shot.id, errorMessage);

      // Detect if this is a code-related error
      const isCodeError = isCodeRelatedError(errorMessage);
      console.log(`Shot ${shot.shotNumber} render error:`, {
        isCodeError,
        errorMessage,
      });

      onError?.(errorMessage, isCodeError);
      throw error;
    }
  };

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    setIsRendering(true);

    console.log(`Starting sequential render of ${queueRef.current.length} shots`);

    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];
      setCurrentRenderingShot(item.shot.id);

      console.log(`Rendering shot ${item.shot.shotNumber}...`);

      try {
        await renderSingleShot(item);
        console.log(`Shot ${item.shot.shotNumber} completed successfully`);
        // Remove from queue on success
        queueRef.current.shift();
      } catch (error) {
        console.error(`Error rendering shot ${item.shot.shotNumber}:`, error);
        // Remove from queue even on error to continue with next
        queueRef.current.shift();
      }

      // Delay between renders to avoid rate limiting
      if (queueRef.current.length > 0) {
        console.log(`Waiting 3 seconds before next shot...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    console.log('All shots rendered');
    setCurrentRenderingShot(null);
    setIsRendering(false);
    isProcessingRef.current = false;
  }, []);

  const queueShot = useCallback(
    (
      shot: Shot,
      callbacks?: {
        onProgress?: (progress: number) => void;
        onComplete?: (videoUrl: string) => void;
        onError?: (error: string, isCodeError?: boolean) => void;
      },
      retryCount = 0
    ) => {
      const item: RenderQueueItem = {
        shot,
        ...callbacks,
        retryCount,
      };

      queueRef.current.push(item);

      // NOTE: Don't start processing here - let queueMultipleShots do it
    },
    []
  );

  const queueMultipleShots = useCallback(
    (
      shots: Shot[],
      onAllComplete?: () => void,
      onShotComplete?: (shotId: string, videoUrl: string) => void,
      onShotError?: (shotId: string, error: string, isCodeError?: boolean) => void
    ) => {
      let completedCount = 0;
      const totalShots = shots.length;

      console.log(`Queueing ${totalShots} shots for sequential rendering`);

      // Add all shots to queue first (batch operation)
      shots.forEach((shot) => {
        queueShot(shot, {
          onComplete: (videoUrl) => {
            completedCount++;
            onShotComplete?.(shot.id, videoUrl);
            if (completedCount === totalShots) {
              onAllComplete?.();
            }
          },
          onError: (error, isCodeError) => {
            completedCount++;
            onShotError?.(shot.id, error, isCodeError);
            if (completedCount === totalShots) {
              onAllComplete?.();
            }
          },
        });
      });

      // Start processing ONCE after all shots are queued
      if (!isProcessingRef.current) {
        console.log('Starting queue processor');
        processQueue();
      }
    },
    [queueShot, processQueue]
  );

  const clearQueue = useCallback(() => {
    queueRef.current = [];
  }, []);

  return {
    queueShot,
    queueMultipleShots,
    clearQueue,
    isRendering,
    currentRenderingShot,
    renderProgressMap,
    errors,
    queueLength: queueRef.current.length,
  };
}

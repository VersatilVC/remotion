'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { StoryboardView } from '@/components/storyboard-view';
import { ShotEditorModal } from '@/components/shot-editor-modal';
import { PromptInput } from '@/components/prompt-input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSequentialRender } from '@/hooks/use-sequential-render';
import { Shot, StoryboardResponse, VisualTheme, NarrativeTheme } from '@/types/shot';

type WorkflowStep = 'prompt' | 'storyboard' | 'generating' | 'rendering' | 'complete';

function CreatePageContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams?.get('prompt') || '';

  const [prompt, setPrompt] = useState(initialPrompt);
  const [step, setStep] = useState<WorkflowStep>('prompt');
  const [shots, setShots] = useState<Shot[]>([]);
  const [visualTheme, setVisualTheme] = useState<VisualTheme | null>(null);
  const [narrativeTheme, setNarrativeTheme] = useState<NarrativeTheme | null>(null);
  const [editingShot, setEditingShot] = useState<Shot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [isStitching, setIsStitching] = useState(false);
  const shotRetryCountRef = useRef<Map<string, number>>(new Map());

  const hasGeneratedRef = useRef(false);

  const {
    queueMultipleShots,
    isRendering,
    currentRenderingShot,
    renderProgressMap,
    errors: renderErrors,
  } = useSequentialRender();

  useEffect(() => {
    if (initialPrompt && !hasGeneratedRef.current) {
      hasGeneratedRef.current = true;
      handleGenerateStoryboard(initialPrompt);
    }
  }, [initialPrompt]);

  // Automatically regenerate code for a shot and retry render
  const handleAutoFixAndRetry = async (shotId: string, errorMessage: string) => {
    const shot = shots.find((s) => s.id === shotId);
    if (!shot) return;

    const retryCount = shotRetryCountRef.current.get(shotId) || 0;
    const MAX_RETRIES = 2;

    if (retryCount >= MAX_RETRIES) {
      console.log(`Shot ${shot.shotNumber} exceeded max retry attempts (${MAX_RETRIES})`);
      setShots((prev) =>
        prev.map((s) =>
          s.id === shotId
            ? {
                ...s,
                status: 'error',
                error: `Code error after ${MAX_RETRIES} attempts: ${errorMessage}`,
              }
            : s
        )
      );
      return;
    }

    // Increment retry count
    shotRetryCountRef.current.set(shotId, retryCount + 1);

    console.log(
      `Auto-fixing shot ${shot.shotNumber} (attempt ${retryCount + 1}/${MAX_RETRIES})...`
    );

    // Update status to generating (auto-fixing)
    setShots((prev) =>
      prev.map((s) => (s.id === shotId ? { ...s, status: 'generating', error: undefined } : s))
    );

    try {
      // Build context for autofix
      const shotIndex = shots.findIndex((s) => s.id === shotId);
      const previousShot = shotIndex > 0 ? shots[shotIndex - 1] : null;
      const nextShot = shotIndex < shots.length - 1 ? shots[shotIndex + 1] : null;

      const previousShotContext = previousShot
        ? {
            shotNumber: previousShot.shotNumber,
            keyMessage: previousShot.keyMessage || '',
            description: previousShot.description,
          }
        : undefined;

      const nextShotContext = nextShot
        ? {
            shotNumber: nextShot.shotNumber,
            keyMessage: nextShot.keyMessage || '',
            description: nextShot.description,
          }
        : undefined;

      const response = await fetch('/api/generate-shot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shotDescription: `${shot.description}\n\nIMPORTANT: The previous code generated an error during rendering:\n"${errorMessage}"\n\nPlease fix this error and generate corrected code.`,
          visualElements: shot.visualElements,
          duration: shot.duration,
          shotNumber: shot.shotNumber,
          totalShots: shots.length,
          previousCode: shot.code,
          visualTheme,
          narrativeTheme,
          narrativeRole: shot.narrativeRole,
          narrativeConnection: shot.narrativeConnection,
          keyMessage: shot.keyMessage,
          emotionalTone: shot.emotionalTone,
          previousShotContext,
          nextShotContext,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate shot');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let accumulatedCode = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'code') {
                accumulatedCode += data.content;
              } else if (data.type === 'error') {
                throw new Error(data.content);
              } else if (data.type === 'done') {
                // Update shot with fixed code
                setShots((prev) =>
                  prev.map((s) =>
                    s.id === shotId
                      ? { ...s, code: accumulatedCode, status: 'code_ready' }
                      : s
                  )
                );

                // Automatically retry render with fixed code
                console.log(`Auto-retrying render for shot ${shot.shotNumber}...`);
                const updatedShot = { ...shot, code: accumulatedCode };
                handleRetryRender(updatedShot);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error auto-fixing shot ${shot.shotNumber}:`, err);
      setShots((prev) =>
        prev.map((s) =>
          s.id === shotId
            ? {
                ...s,
                status: 'error',
                error: err instanceof Error ? err.message : 'Failed to auto-fix',
              }
            : s
        )
      );
    }
  };

  // Generate storyboard from prompt
  const handleGenerateStoryboard = async (userPrompt: string) => {
    setIsGeneratingStoryboard(true);
    setError(null);
    setShots([]);

    try {
      const response = await fetch('/api/storyboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: userPrompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate storyboard');
      }

      const storyboard: StoryboardResponse = await response.json();

      // Store visual theme if provided
      if (storyboard.visualTheme) {
        setVisualTheme(storyboard.visualTheme);
        console.log('Visual theme:', storyboard.visualTheme);
      }

      // Store narrative theme if provided
      if (storyboard.narrativeTheme) {
        setNarrativeTheme(storyboard.narrativeTheme);
        console.log('Narrative theme:', storyboard.narrativeTheme);
      }

      // Convert storyboard response to Shot objects
      const newShots: Shot[] = storyboard.shots.map((shotData) => ({
        id: `shot-${shotData.shotNumber}-${Date.now()}`,
        shotNumber: shotData.shotNumber,
        description: shotData.description,
        visualElements: shotData.visualElements,
        duration: shotData.suggestedDuration * 30, // Convert seconds to frames
        status: 'pending',
        narrativeRole: shotData.narrativeRole,
        narrativeConnection: shotData.narrativeConnection,
        keyMessage: shotData.keyMessage,
        emotionalTone: shotData.emotionalTone,
      }));

      setShots(newShots);
      setStep('storyboard');
      setPrompt(userPrompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate storyboard');
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  // Generate code for all shots
  const handleGenerateAllCode = async () => {
    setIsGeneratingCode(true);
    setError(null);

    const totalShots = shots.length;

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];

      // Build previous and next shot context for narrative flow
      const previousShot = i > 0 ? shots[i - 1] : null;
      const nextShot = i < shots.length - 1 ? shots[i + 1] : null;

      const previousShotContext = previousShot
        ? {
            shotNumber: previousShot.shotNumber,
            keyMessage: previousShot.keyMessage || '',
            description: previousShot.description,
          }
        : undefined;

      const nextShotContext = nextShot
        ? {
            shotNumber: nextShot.shotNumber,
            keyMessage: nextShot.keyMessage || '',
            description: nextShot.description,
          }
        : undefined;

      // Update status to generating
      setShots((prev) =>
        prev.map((s) => (s.id === shot.id ? { ...s, status: 'generating' } : s))
      );

      try {
        const response = await fetch('/api/generate-shot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shotDescription: shot.description,
            visualElements: shot.visualElements,
            duration: shot.duration,
            shotNumber: shot.shotNumber,
            totalShots,
            visualTheme,
            narrativeTheme,
            narrativeRole: shot.narrativeRole,
            narrativeConnection: shot.narrativeConnection,
            keyMessage: shot.keyMessage,
            emotionalTone: shot.emotionalTone,
            previousShotContext,
            nextShotContext,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate code for shot ${shot.shotNumber}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let accumulatedCode = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'code') {
                  accumulatedCode += data.content;
                } else if (data.type === 'error') {
                  throw new Error(data.content);
                } else if (data.type === 'done') {
                  // Update shot with code
                  setShots((prev) =>
                    prev.map((s) =>
                      s.id === shot.id
                        ? { ...s, code: accumulatedCode, status: 'code_ready' }
                        : s
                    )
                  );
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error generating code for shot ${shot.shotNumber}:`, err);
        setShots((prev) =>
          prev.map((s) =>
            s.id === shot.id
              ? {
                  ...s,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Unknown error',
                }
              : s
          )
        );
      }
    }

    setIsGeneratingCode(false);
    setStep('generating');
  };

  // Render all shots sequentially
  const handleRenderAll = () => {
    const shotsToRender = shots.filter((s) => s.status === 'code_ready' && s.code);

    if (shotsToRender.length === 0) {
      setError('No shots ready to render');
      return;
    }

    // Mark all as rendering
    setShots((prev) =>
      prev.map((s) =>
        shotsToRender.find((sr) => sr.id === s.id) ? { ...s, status: 'rendering' } : s
      )
    );

    setStep('rendering');

    queueMultipleShots(
      shotsToRender,
      () => {
        // All renders complete
        setStep('complete');
      },
      (shotId, videoUrl) => {
        // Single shot complete - reset retry count
        shotRetryCountRef.current.delete(shotId);
        setShots((prev) =>
          prev.map((s) =>
            s.id === shotId ? { ...s, status: 'complete', videoUrl } : s
          )
        );
      },
      (shotId, errorMsg, isCodeError) => {
        // Single shot error
        if (isCodeError) {
          // Automatically fix and retry
          console.log(`Detected code error in shot ${shotId}, triggering auto-fix...`);
          handleAutoFixAndRetry(shotId, errorMsg);
        } else {
          // Infrastructure error - just mark as error
          setShots((prev) =>
            prev.map((s) =>
              s.id === shotId ? { ...s, status: 'error', error: errorMsg } : s
            )
          );
        }
      }
    );
  };

  // Retry rendering a single failed shot
  const handleRetryRender = (shot: Shot) => {
    if (!shot.code) {
      setError('No code available to render');
      return;
    }

    // Mark as rendering
    setShots((prev) =>
      prev.map((s) => (s.id === shot.id ? { ...s, status: 'rendering', error: undefined } : s))
    );

    queueMultipleShots(
      [shot],
      () => {
        console.log('Retry render complete');
      },
      (shotId, videoUrl) => {
        shotRetryCountRef.current.delete(shotId);
        setShots((prev) =>
          prev.map((s) =>
            s.id === shotId ? { ...s, status: 'complete', videoUrl } : s
          )
        );
      },
      (shotId, errorMsg, isCodeError) => {
        if (isCodeError) {
          console.log(`Detected code error in retry, triggering auto-fix...`);
          handleAutoFixAndRetry(shotId, errorMsg);
        } else {
          setShots((prev) =>
            prev.map((s) =>
              s.id === shotId ? { ...s, status: 'error', error: errorMsg } : s
            )
          );
        }
      }
    );
  };

  // Stitch final video
  const handleStitchFinal = async () => {
    const completedShots = shots.filter((s) => s.status === 'complete' && s.code);

    if (completedShots.length === 0) {
      setError('No completed shots to stitch');
      return;
    }

    setIsStitching(true);
    setError(null);

    try {
      const response = await fetch('/api/stitch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shots: completedShots }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to stitch video');
      }

      const data = await response.json();
      setFinalVideoUrl(data.videoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stitch video');
    } finally {
      setIsStitching(false);
    }
  };

  // Edit shot
  const handleEditShot = (shot: Shot) => {
    setEditingShot(shot);
  };

  // Delete shot
  const handleDeleteShot = (shotId: string) => {
    setShots((prev) => {
      const newShots = prev.filter((s) => s.id !== shotId);
      // Renumber shots
      return newShots.map((s, index) => ({ ...s, shotNumber: index + 1 }));
    });
  };

  // Regenerate shot with edit prompt
  const handleRegenerateShot = async (shotId: string, editPrompt: string) => {
    const shot = shots.find((s) => s.id === shotId);
    if (!shot) return;

    setEditingShot(null);

    // Update status
    setShots((prev) =>
      prev.map((s) => (s.id === shotId ? { ...s, status: 'generating' } : s))
    );

    try {
      // Build context for regeneration
      const shotIndex = shots.findIndex((s) => s.id === shotId);
      const previousShot = shotIndex > 0 ? shots[shotIndex - 1] : null;
      const nextShot = shotIndex < shots.length - 1 ? shots[shotIndex + 1] : null;

      const previousShotContext = previousShot
        ? {
            shotNumber: previousShot.shotNumber,
            keyMessage: previousShot.keyMessage || '',
            description: previousShot.description,
          }
        : undefined;

      const nextShotContext = nextShot
        ? {
            shotNumber: nextShot.shotNumber,
            keyMessage: nextShot.keyMessage || '',
            description: nextShot.description,
          }
        : undefined;

      const response = await fetch('/api/generate-shot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shotDescription: `${shot.description}\n\nEdit: ${editPrompt}`,
          visualElements: shot.visualElements,
          duration: shot.duration,
          shotNumber: shot.shotNumber,
          totalShots: shots.length,
          previousCode: shot.code,
          visualTheme,
          narrativeTheme,
          narrativeRole: shot.narrativeRole,
          narrativeConnection: shot.narrativeConnection,
          keyMessage: shot.keyMessage,
          emotionalTone: shot.emotionalTone,
          previousShotContext,
          nextShotContext,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate shot');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let accumulatedCode = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'code') {
                accumulatedCode += data.content;
              } else if (data.type === 'error') {
                throw new Error(data.content);
              } else if (data.type === 'done') {
                setShots((prev) =>
                  prev.map((s) =>
                    s.id === shotId
                      ? { ...s, code: accumulatedCode, status: 'code_ready' }
                      : s
                  )
                );
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error regenerating shot:', err);
      setShots((prev) =>
        prev.map((s) =>
          s.id === shotId
            ? {
                ...s,
                status: 'error',
                error: err instanceof Error ? err.message : 'Unknown error',
              }
            : s
        )
      );
    }
  };

  // Unified workflow - single button to generate and render
  const canCreateVideo = step === 'storyboard' && shots.length > 0 && !isGeneratingCode && !isRendering;
  const canStitch = shots.every((s) => s.status === 'complete') && shots.length > 0;
  const isProcessing = isGeneratingCode || isRendering;

  // Combined function to generate code and render automatically
  const handleCreateVideo = async () => {
    setStep('generating');
    setError(null);

    // Generate all code first
    await handleGenerateAllCode();

    // After code generation, automatically start rendering
    // This will be triggered by the useEffect below
  };

  // Watch for when code generation completes, then auto-render
  const [autoRenderTriggered, setAutoRenderTriggered] = useState(false);

  useEffect(() => {
    if (!isGeneratingCode && !isRendering && !autoRenderTriggered && shots.length > 0) {
      const allCodeReady = shots.every((s) => s.status === 'code_ready' || s.status === 'complete' || s.status === 'error');
      const someCodeReady = shots.some((s) => s.status === 'code_ready');

      if (someCodeReady && allCodeReady && step === 'generating') {
        setAutoRenderTriggered(true);
        handleRenderAll();
      }
    }
  }, [isGeneratingCode, shots]);

  // Reset auto-render trigger when storyboard changes
  useEffect(() => {
    if (step === 'storyboard') {
      setAutoRenderTriggered(false);
    }
  }, [step]);

  // Handle description update
  const handleUpdateDescription = (shotId: string, newDescription: string) => {
    setShots((prev) =>
      prev.map((s) => (s.id === shotId ? { ...s, description: newDescription } : s))
    );
  };

  // Handle reorder
  const handleReorderShots = (reorderedShots: Shot[]) => {
    setShots(reorderedShots);
  };

  // Hide individual workflow buttons
  const canApprove = false;
  const canGenerateCode = false;
  const canRender = false;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
              Multi-Shot Video Creator
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Create professional videos shot by shot
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/">← Back to Home</a>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {/* Prompt Input */}
        {(step === 'prompt' || step === 'storyboard') && (
          <div className="mb-6">
            <PromptInput
              onGenerate={handleGenerateStoryboard}
              isGenerating={isGeneratingStoryboard}
              initialPrompt={prompt}
            />
            {error && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Storyboard View */}
        {shots.length > 0 && (
          <>
            <StoryboardView
              shots={shots}
              onEditShot={handleEditShot}
              onDeleteShot={handleDeleteShot}
              onRegenerateShot={(shot) => setEditingShot(shot)}
              onRetryRender={handleRetryRender}
              onApproveStoryboard={canCreateVideo ? handleCreateVideo : undefined}
              onGenerateAll={undefined}
              onRenderAll={undefined}
              onStitchFinal={canStitch ? handleStitchFinal : undefined}
              onReorderShots={handleReorderShots}
              onUpdateDescription={handleUpdateDescription}
              renderProgressMap={renderProgressMap}
              isGeneratingCode={isGeneratingCode}
              isRendering={isRendering}
              isStitching={isStitching}
              canApprove={canCreateVideo}
              canGenerateCode={false}
              canRender={false}
              canStitch={canStitch}
            />
            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </>
        )}

        {/* Final Video Result */}
        {finalVideoUrl && (
          <Card className="mt-6 p-6">
            <h2 className="text-xl font-semibold mb-4">Final Video</h2>
            <div className="relative bg-zinc-100 dark:bg-zinc-900 rounded-lg overflow-hidden aspect-video">
              <video
                src={finalVideoUrl}
                controls
                className="w-full h-full object-contain"
              >
                Your browser does not support video playback.
              </video>
            </div>
            <div className="mt-4 flex gap-2">
              <Button asChild>
                <a href={finalVideoUrl} download>
                  Download Video
                </a>
              </Button>
              <Button variant="outline" onClick={() => setFinalVideoUrl(null)}>
                Create Another
              </Button>
            </div>
          </Card>
        )}

        {/* Loading States */}
        {isGeneratingStoryboard && (
          <Card className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Generating Storyboard...</h3>
            <p className="text-sm text-zinc-500">
              Creating shot breakdown from your prompt
            </p>
          </Card>
        )}
      </div>

      {/* Shot Editor Modal */}
      {editingShot && (
        <ShotEditorModal
          shot={editingShot}
          onClose={() => setEditingShot(null)}
          onSave={handleRegenerateShot}
        />
      )}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreatePageContent />
    </Suspense>
  );
}

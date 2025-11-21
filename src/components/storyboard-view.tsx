'use client';

import { useState } from 'react';
import { Shot } from '@/types/shot';
import { ShotCard } from './shot-card';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

interface StoryboardViewProps {
  shots: Shot[];
  onEditShot?: (shot: Shot) => void;
  onDeleteShot?: (shotId: string) => void;
  onRegenerateShot?: (shot: Shot) => void;
  onRetryRender?: (shot: Shot) => void;
  onApproveStoryboard?: () => void;
  onGenerateAll?: () => void;
  onRenderAll?: () => void;
  onStitchFinal?: () => void;
  onReorderShots?: (reorderedShots: Shot[]) => void;
  onUpdateDescription?: (shotId: string, newDescription: string) => void;
  renderProgressMap?: Map<string, number>;
  isGeneratingCode?: boolean;
  isRendering?: boolean;
  isStitching?: boolean;
  canApprove?: boolean;
  canGenerateCode?: boolean;
  canRender?: boolean;
  canStitch?: boolean;
}

export function StoryboardView({
  shots,
  onEditShot,
  onDeleteShot,
  onRegenerateShot,
  onRetryRender,
  onApproveStoryboard,
  onGenerateAll,
  onRenderAll,
  onStitchFinal,
  onReorderShots,
  onUpdateDescription,
  renderProgressMap,
  isGeneratingCode = false,
  isRendering = false,
  isStitching = false,
  canApprove = false,
  canGenerateCode = false,
  canRender = false,
  canStitch = false,
}: StoryboardViewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const totalShots = shots.length;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const reordered = [...shots];
    const [draggedShot] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, draggedShot);

    // Update shot numbers
    const renumbered = reordered.map((shot, index) => ({
      ...shot,
      shotNumber: index + 1,
    }));

    onReorderShots?.(renumbered);
    setDraggedIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...shots];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    const renumbered = reordered.map((shot, idx) => ({
      ...shot,
      shotNumber: idx + 1,
    }));
    onReorderShots?.(renumbered);
  };

  const handleMoveDown = (index: number) => {
    if (index === shots.length - 1) return;
    const reordered = [...shots];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    const renumbered = reordered.map((shot, idx) => ({
      ...shot,
      shotNumber: idx + 1,
    }));
    onReorderShots?.(renumbered);
  };

  // Calculate code generation progress
  const codeGenerationProgress = totalShots > 0
    ? shots.reduce((sum, shot) => {
        if (shot.status === 'pending') return sum + 0;
        if (shot.status === 'generating') return sum + 0.5;
        return sum + 1; // code_ready, rendering, complete, error
      }, 0) / totalShots
    : 0;

  // Calculate rendering progress
  const renderingProgress = totalShots > 0
    ? shots.reduce((sum, shot) => {
        if (shot.status === 'complete') return sum + 1;
        if (shot.status === 'rendering') {
          const shotProgress = renderProgressMap?.get(shot.id) || 0;
          return sum + shotProgress;
        }
        return sum + 0;
      }, 0) / totalShots
    : 0;

  // Overall progress depends on current phase
  const overallProgress = isGeneratingCode
    ? codeGenerationProgress
    : isRendering
    ? renderingProgress
    : shots.filter((s) => s.status === 'complete').length / totalShots;

  const totalDuration = shots.reduce((sum, shot) => sum + shot.duration, 0);
  const totalDurationSeconds = Math.round((totalDuration / 30) * 10) / 10;

  return (
    <div className="space-y-4">
      {/* Header Card with Progress */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">
              Storyboard ({totalShots} {totalShots === 1 ? 'shot' : 'shots'})
            </h2>
            <p className="text-sm text-zinc-500">
              Total duration: {totalDurationSeconds}s ({totalDuration} frames)
            </p>
          </div>

          <div className="flex gap-2">
            {canApprove && onApproveStoryboard && (
              <Button
                onClick={onApproveStoryboard}
                disabled={isGeneratingCode || isRendering}
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
              >
                {isGeneratingCode ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Generating Code...
                  </span>
                ) : isRendering ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Rendering Videos...
                  </span>
                ) : (
                  'Create Video'
                )}
              </Button>
            )}

            {canGenerateCode && onGenerateAll && (
              <Button
                onClick={onGenerateAll}
                disabled={isGeneratingCode}
                size="sm"
                variant="default"
              >
                {isGeneratingCode ? 'Generating Code...' : 'Generate All Code'}
              </Button>
            )}

            {canRender && onRenderAll && (
              <Button
                onClick={onRenderAll}
                disabled={isRendering}
                size="sm"
                variant="default"
              >
                {isRendering ? 'Rendering...' : 'Render All Shots'}
              </Button>
            )}

            {canStitch && onStitchFinal && (
              <Button
                onClick={onStitchFinal}
                disabled={isStitching}
                size="sm"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isStitching ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Stitching Final Video...
                  </span>
                ) : (
                  'Create Final Video'
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Overall Progress */}
        {(isGeneratingCode || isRendering || overallProgress > 0) && (
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>
                {isGeneratingCode && `Generating code... ${Math.round(codeGenerationProgress * totalShots)}/${totalShots} shots`}
                {isRendering && `Rendering shots... ${Math.round(renderingProgress * totalShots)}/${totalShots} complete`}
                {!isGeneratingCode && !isRendering && `${shots.filter((s) => s.status === 'complete').length}/${totalShots} completed`}
              </span>
              <span>{Math.round(overallProgress * 100)}%</span>
            </div>
            <Progress value={overallProgress * 100} />
          </div>
        )}
      </Card>

      {/* Shots Grid */}
      {shots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shots.map((shot, index) => (
            <div
              key={shot.id}
              draggable={canApprove || shot.status === 'pending'}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className={`relative ${
                draggedIndex === index ? 'opacity-50' : ''
              } ${canApprove || shot.status === 'pending' ? 'cursor-move' : ''}`}
            >
              <ShotCard
                shot={shot}
                onEdit={onEditShot}
                onDelete={onDeleteShot}
                onRegenerate={onRegenerateShot}
                onRetryRender={onRetryRender}
                onUpdateDescription={onUpdateDescription}
                renderProgress={renderProgressMap?.get(shot.id)}
              />
              {/* Reorder buttons */}
              {(canApprove || shot.status === 'pending') && onReorderShots && (
                <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="h-6 w-6 p-0 shadow-lg"
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === shots.length - 1}
                    className="h-6 w-6 p-0 shadow-lg"
                  >
                    ↓
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold mb-2">No shots yet</h3>
          <p className="text-sm text-zinc-500">
            Enter a prompt above to generate your storyboard
          </p>
        </Card>
      )}
    </div>
  );
}

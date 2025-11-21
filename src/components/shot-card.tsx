'use client';

import { useState } from 'react';
import { Shot } from '@/types/shot';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Textarea } from './ui/textarea';

interface ShotCardProps {
  shot: Shot;
  onEdit?: (shot: Shot) => void;
  onDelete?: (shotId: string) => void;
  onRegenerate?: (shot: Shot) => void;
  onRetryRender?: (shot: Shot) => void;
  onUpdateDescription?: (shotId: string, newDescription: string) => void;
  renderProgress?: number; // 0-1 for rendering progress
}

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-zinc-500', variant: 'secondary' as const },
  generating: { label: 'Generating...', color: 'bg-blue-500', variant: 'default' as const },
  code_ready: { label: 'Ready', color: 'bg-green-500', variant: 'default' as const },
  rendering: { label: 'Rendering...', color: 'bg-purple-500', variant: 'default' as const },
  complete: { label: 'Complete', color: 'bg-green-600', variant: 'default' as const },
  error: { label: 'Error', color: 'bg-red-500', variant: 'destructive' as const },
};

export function ShotCard({ shot, onEdit, onDelete, onRegenerate, onRetryRender, onUpdateDescription, renderProgress }: ShotCardProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(shot.description);
  const statusInfo = statusConfig[shot.status];
  const durationInSeconds = Math.round((shot.duration / 30) * 10) / 10;

  const handleSaveDescription = () => {
    if (editedDescription.trim() && editedDescription !== shot.description) {
      onUpdateDescription?.(shot.id, editedDescription);
    }
    setIsEditingDescription(false);
  };

  const handleCancelEdit = () => {
    setEditedDescription(shot.description);
    setIsEditingDescription(false);
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Preview/Video Section */}
      <div className="relative bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 aspect-video flex items-center justify-center">
        {shot.videoUrl ? (
          <video
            src={shot.videoUrl}
            controls
            className="w-full h-full object-cover"
          >
            Your browser does not support video playback.
          </video>
        ) : shot.thumbnailUrl ? (
          <img
            src={shot.thumbnailUrl}
            alt={`Shot ${shot.shotNumber} preview`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center p-4">
            <div className="text-4xl mb-2">🎬</div>
            <p className="text-sm text-zinc-500">
              {shot.status === 'pending' && 'Awaiting generation'}
              {shot.status === 'generating' && 'Generating code...'}
              {shot.status === 'code_ready' && 'Code ready to render'}
              {shot.status === 'rendering' && 'Rendering...'}
              {shot.status === 'error' && 'Error occurred'}
            </p>
          </div>
        )}

        {/* Shot Number Badge */}
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-semibold">
          Shot {shot.shotNumber}
        </div>

        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <Badge variant={statusInfo.variant} className="backdrop-blur-sm">
            {shot.status === 'generating' || shot.status === 'rendering' ? (
              <span className="animate-pulse">{statusInfo.label}</span>
            ) : (
              statusInfo.label
            )}
          </Badge>
        </div>

        {/* Rendering Progress Bar */}
        {shot.status === 'rendering' && renderProgress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/40 backdrop-blur-sm">
            <Progress value={renderProgress * 100} className="h-1" />
            <p className="text-xs text-white text-center mt-1">
              {Math.round(renderProgress * 100)}%
            </p>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Duration */}
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="text-xs">
            {durationInSeconds}s ({shot.duration} frames)
          </Badge>
        </div>

        {/* Description */}
        {isEditingDescription ? (
          <div className="mb-3 space-y-2">
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="text-sm resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveDescription}
                className="flex-1 text-xs"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelEdit}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-1">
              {shot.description}
            </p>
            {onUpdateDescription && shot.status === 'pending' && (
              <button
                onClick={() => setIsEditingDescription(true)}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Edit description
              </button>
            )}
          </div>
        )}

        {/* Visual Elements */}
        {shot.visualElements && shot.visualElements.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              Visual Elements:
            </p>
            <div className="flex flex-wrap gap-1">
              {shot.visualElements.slice(0, 3).map((element, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {element.length > 20 ? element.substring(0, 20) + '...' : element}
                </Badge>
              ))}
              {shot.visualElements.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{shot.visualElements.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {shot.status === 'error' && shot.error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">
            {shot.error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {shot.status === 'complete' && onEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(shot)}
              className="flex-1 text-xs"
            >
              Edit
            </Button>
          )}

          {shot.status === 'error' && shot.code && onRetryRender && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onRetryRender(shot)}
              className="flex-1 text-xs bg-orange-600 hover:bg-orange-700"
            >
              Retry Render
            </Button>
          )}

          {shot.status === 'error' && onRegenerate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRegenerate(shot)}
              className="flex-1 text-xs"
            >
              Regenerate Code
            </Button>
          )}

          {shot.status === 'code_ready' && onRegenerate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRegenerate(shot)}
              className="flex-1 text-xs"
            >
              Regenerate
            </Button>
          )}

          {onDelete && shot.status !== 'rendering' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(shot.id)}
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Delete
            </Button>
          )}

          {shot.videoUrl && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(shot.videoUrl, '_blank')}
              className="text-xs"
            >
              Open
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

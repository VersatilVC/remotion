'use client';

import { useState } from 'react';
import { Shot } from '@/types/shot';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';

interface ShotEditorModalProps {
  shot: Shot;
  onClose: () => void;
  onSave: (shotId: string, editPrompt: string) => void;
  isRegenerating?: boolean;
}

export function ShotEditorModal({
  shot,
  onClose,
  onSave,
  isRegenerating = false,
}: ShotEditorModalProps) {
  const [editPrompt, setEditPrompt] = useState('');
  const durationInSeconds = Math.round((shot.duration / 30) * 10) / 10;

  const handleSave = () => {
    if (editPrompt.trim()) {
      onSave(shot.id, editPrompt);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-semibold">
              Edit Shot {shot.shotNumber}
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              {durationInSeconds}s ({shot.duration} frames)
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Description */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Current Description
            </label>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
              {shot.description}
            </p>
          </div>

          {/* Visual Elements */}
          {shot.visualElements && shot.visualElements.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-2">
                Visual Elements
              </label>
              <div className="flex flex-wrap gap-2">
                {shot.visualElements.map((element, index) => (
                  <Badge key={index} variant="secondary">
                    {element}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Video Preview */}
          {shot.videoUrl && (
            <div>
              <label className="block text-sm font-semibold mb-2">
                Current Video
              </label>
              <div className="relative bg-zinc-100 dark:bg-zinc-900 rounded-lg overflow-hidden aspect-video">
                <video
                  src={shot.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                >
                  Your browser does not support video playback.
                </video>
              </div>
            </div>
          )}

          {/* Edit Prompt */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              What would you like to change?
            </label>
            <Textarea
              placeholder="Make the text bigger and change the background color to blue..."
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              className="min-h-32 resize-none"
              disabled={isRegenerating}
            />
            <p className="text-xs text-zinc-500 mt-1">
              Describe the changes you want to make to this shot
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t p-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isRegenerating}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!editPrompt.trim() || isRegenerating}
            className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate Shot'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

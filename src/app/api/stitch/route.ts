import { NextRequest, NextResponse } from 'next/server';
import { renderMediaOnLambda } from '@remotion/lambda/client';
import { deploySite, getOrCreateBucket } from '@remotion/lambda';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { Shot } from '@/types/shot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    const { shots } = await request.json();

    if (!shots || !Array.isArray(shots) || shots.length === 0) {
      return NextResponse.json({ error: 'Shots array is required' }, { status: 400 });
    }

    // Validate environment variables
    const region = process.env.REMOTION_AWS_REGION;
    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;

    if (!region || !functionName) {
      return NextResponse.json(
        {
          error: 'Lambda not configured. Please set REMOTION_AWS_REGION and REMOTION_LAMBDA_FUNCTION_NAME environment variables.',
          configError: true,
        },
        { status: 500 }
      );
    }

    // Get or create S3 bucket
    console.log('Getting or creating S3 bucket for stitching...');
    const { bucketName } = await getOrCreateBucket({
      region: region as any,
    });

    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remotion-stitch-'));

    // Sort shots by shot number
    const sortedShots = [...shots].sort((a: Shot, b: Shot) => a.shotNumber - b.shotNumber);

    // Generate individual shot component files
    const shotComponents: string[] = [];
    for (let i = 0; i < sortedShots.length; i++) {
      const shot = sortedShots[i];
      const componentFile = path.join(tempDir, `Shot${i + 1}.tsx`);

      // Clean up code
      let cleanCode = shot.code.trim();
      if (cleanCode.startsWith('```')) {
        const lines = cleanCode.split('\n');
        lines.shift();
        if (lines[lines.length - 1].trim() === '```') {
          lines.pop();
        }
        cleanCode = lines.join('\n');
      }

      // Extract component name or use default
      const componentNameMatch = cleanCode.match(/export default function (\w+)/);
      const originalName = componentNameMatch ? componentNameMatch[1] : `VideoComponent${i + 1}`;
      const newName = `Shot${i + 1}Component`;

      // Replace component name
      cleanCode = cleanCode.replace(
        /export default function \w+/,
        `export default function ${newName}`
      );

      await fs.writeFile(componentFile, cleanCode);
      shotComponents.push(newName);
    }

    // Create the master composition using Series with crossfade transitions
    const entryPoint = path.join(tempDir, 'index.tsx');
    const TRANSITION_FRAMES = 15; // 0.5 second crossfade at 30fps

    const masterCompositionCode = `
import React from 'react';
import { Composition, registerRoot, Series, useCurrentFrame, AbsoluteFill, interpolate, Easing } from 'remotion';
${sortedShots
  .map((_, i) => `import Shot${i + 1}Component from './Shot${i + 1}';`)
  .join('\n')}

// Wrapper component for fade in/out transitions
const TransitionWrapper: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
  transitionFrames: number;
}> = ({ children, durationInFrames, fadeIn = false, fadeOut = false, transitionFrames }) => {
  const frame = useCurrentFrame();

  let opacity = 1;

  if (fadeIn && frame < transitionFrames) {
    opacity = interpolate(
      frame,
      [0, transitionFrames],
      [0, 1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }
    );
  }

  if (fadeOut && frame > durationInFrames - transitionFrames) {
    opacity = interpolate(
      frame,
      [durationInFrames - transitionFrames, durationInFrames],
      [1, 0],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }
    );
  }

  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
};

const FinalComposition: React.FC = () => {
  const TRANSITION_FRAMES = ${TRANSITION_FRAMES};

  return (
    <Series>
${sortedShots
  .map(
    (shot: Shot, i) => {
      const isFirst = i === 0;
      const isLast = i === sortedShots.length - 1;
      const offset = i === 0 ? 0 : -TRANSITION_FRAMES;

      return `      <Series.Sequence durationInFrames={${shot.duration}} ${offset !== 0 ? `offset={${offset}}` : ''}>
        <TransitionWrapper
          durationInFrames={${shot.duration}}
          fadeIn={${!isFirst}}
          fadeOut={${!isLast}}
          transitionFrames={TRANSITION_FRAMES}
        >
          <Shot${i + 1}Component />
        </TransitionWrapper>
      </Series.Sequence>`;
    }
  )
  .join('\n')}
    </Series>
  );
};

export const RemotionRoot: React.FC = () => {
  // Calculate total duration accounting for crossfade overlaps
  const TRANSITION_FRAMES = ${TRANSITION_FRAMES};
  const shotDurations = ${JSON.stringify(sortedShots.map((s: Shot) => s.duration))};
  const totalDuration = shotDurations.reduce((sum: number, dur: number) => sum + dur, 0) - (TRANSITION_FRAMES * ${sortedShots.length - 1});

  return (
    <>
      <Composition
        id="Final"
        component={FinalComposition}
        durationInFrames={totalDuration}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

registerRoot(RemotionRoot);
`;

    await fs.writeFile(entryPoint, masterCompositionCode);

    // Create package.json
    const packageJsonPath = path.join(tempDir, 'package.json');
    const packageJson = {
      name: 'remotion-stitch',
      version: '1.0.0',
      dependencies: {
        remotion: '^4.0.0',
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
    };
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('Deploying stitched composition to S3...');
    const { serveUrl } = await deploySite({
      entryPoint,
      region: region as any,
      bucketName,
      siteName: `stitch-${Date.now()}`,
    });
    console.log('Stitched composition deployed:', serveUrl);

    console.log('Initiating Lambda render for final video...');
    const { renderId, bucketName: renderBucketName } = await renderMediaOnLambda({
      region: region as any,
      functionName,
      serveUrl,
      composition: 'Final',
      codec: 'h264',
      inputProps: {},
    });
    console.log('Final video render started:', renderId);

    // Poll for completion
    const pollInterval = 3000;
    const maxAttempts = 200; // 10 minutes
    let attempts = 0;

    const poll = async (): Promise<string> => {
      if (attempts >= maxAttempts) {
        throw new Error('Render timeout');
      }

      const progressResponse = await fetch(
        `${request.nextUrl.origin}/api/render/progress?renderId=${renderId}&bucketName=${renderBucketName}&region=${region}`
      );

      if (!progressResponse.ok) {
        throw new Error('Failed to get render progress');
      }

      const progressData = await progressResponse.json();

      console.log('Stitch progress:', {
        done: progressData.done,
        progress: progressData.overallProgress,
      });

      if (progressData.done && progressData.outputFile) {
        return progressData.outputFile;
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
      return poll();
    };

    const videoUrl = await poll();

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      videoUrl,
      renderId,
    });
  } catch (error) {
    console.error('Error stitching video:', error);

    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stitch video' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderStill, getCompositions } from '@remotion/renderer';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    const { code, duration = 120 } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remotion-'));
    const componentFile = path.join(tempDir, 'Video.tsx');
    const entryPoint = path.join(tempDir, 'index.tsx');

    let cleanCode = code.trim();
    if (cleanCode.startsWith('```')) {
      const lines = cleanCode.split('\n');
      lines.shift();
      if (lines[lines.length - 1].trim() === '```') {
        lines.pop();
      }
      cleanCode = lines.join('\n');
    }

    const componentNameMatch = cleanCode.match(/export default function (\w+)/);
    const componentName = componentNameMatch ? componentNameMatch[1] : 'VideoComponent';

    // Write the component to Video.tsx
    await fs.writeFile(componentFile, cleanCode);

    // Create the entry point with registerRoot
    const entryPointContent = `
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import ${componentName} from './Video';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Preview"
        component={${componentName}}
        durationInFrames={${duration}}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

registerRoot(RemotionRoot);
`;

    await fs.writeFile(entryPoint, entryPointContent);

    console.log('Bundling component...');
    const bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });

    console.log('Getting compositions...');
    const compositions = await getCompositions(bundleLocation, { inputProps: {} });

    const composition = compositions.find((c) => c.id === 'Preview');
    if (!composition) {
      throw new Error('Preview composition not found');
    }

    console.log('Rendering still frame...');
    const stillPath = path.join(tempDir, 'preview.png');
    const previewFrame = Math.floor(duration / 2);

    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: stillPath,
      frame: previewFrame,
      inputProps: {},
    });

    const imageBuffer = await fs.readFile(stillPath);
    const base64Image = imageBuffer.toString('base64');

    await fs.rm(tempDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${base64Image}`,
    });
  } catch (error) {
    console.error('Error generating preview:', error);

    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate preview' },
      { status: 500 }
    );
  }
}

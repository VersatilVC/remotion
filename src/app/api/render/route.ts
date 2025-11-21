import { NextRequest, NextResponse } from 'next/server';
import { renderMediaOnLambda } from '@remotion/lambda/client';
import { deploySite, getOrCreateBucket } from '@remotion/lambda';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Lambda render initiation

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    const { code, duration = 120 } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // Validate environment variables
    const region = process.env.REMOTION_AWS_REGION;
    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;

    if (!region || !functionName) {
      return NextResponse.json(
        {
          error: 'Lambda not configured. Please set REMOTION_AWS_REGION and REMOTION_LAMBDA_FUNCTION_NAME environment variables.',
          configError: true
        },
        { status: 500 }
      );
    }

    // Get or create S3 bucket
    console.log('Getting or creating S3 bucket...');
    const { bucketName } = await getOrCreateBucket({
      region: region as any,
    });

    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remotion-'));
    const componentFile = path.join(tempDir, 'Video.tsx');
    const entryPoint = path.join(tempDir, 'index.tsx');
    const packageJsonPath = path.join(tempDir, 'package.json');

    // Clean up code fences if present
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
        id="Main"
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

    // Create a minimal package.json
    const packageJson = {
      name: 'remotion-project',
      version: '1.0.0',
      dependencies: {
        'remotion': '^4.0.0',
        'react': '^18.0.0',
        'react-dom': '^18.0.0'
      }
    };
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('Deploying site to S3...');
    const { serveUrl } = await deploySite({
      entryPoint,
      region: region as any,
      bucketName,
      siteName: `site-${Date.now()}`,
    });
    console.log('Site deployed:', serveUrl);

    console.log('Initiating Lambda render...');
    const { renderId, bucketName: renderBucketName } = await renderMediaOnLambda({
      region: region as any,
      functionName,
      serveUrl,
      composition: 'Main',
      codec: 'h264',
      inputProps: {},
    });
    console.log('Lambda render started:', renderId);

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      renderId,
      bucketName: renderBucketName,
      region,
    });
  } catch (error) {
    console.error('Error initiating Lambda render:', error);

    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate render' },
      { status: 500 }
    );
  }
}

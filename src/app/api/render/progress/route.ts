import { NextRequest, NextResponse } from 'next/server';
import { getRenderProgress } from '@remotion/lambda/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const renderId = searchParams.get('renderId');
    const bucketName = searchParams.get('bucketName');
    const region = searchParams.get('region');

    if (!renderId || !bucketName || !region) {
      return NextResponse.json(
        { error: 'Missing required parameters: renderId, bucketName, region' },
        { status: 400 }
      );
    }

    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
    if (!functionName) {
      return NextResponse.json(
        { error: 'REMOTION_LAMBDA_FUNCTION_NAME not configured' },
        { status: 500 }
      );
    }

    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region: region as any,
    });

    console.log('Render progress:', {
      done: progress.done,
      overallProgress: progress.overallProgress,
      fatalErrorEncountered: progress.fatalErrorEncountered,
      hasErrors: !!progress.errors,
      errorCount: progress.errors?.length
    });

    return NextResponse.json({
      done: progress.done,
      overallProgress: progress.overallProgress,
      outputFile: progress.outputFile,
      fatalErrorEncountered: progress.fatalErrorEncountered,
      errors: progress.errors,
    });
  } catch (error) {
    console.error('Error getting render progress:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get render progress' },
      { status: 500 }
    );
  }
}

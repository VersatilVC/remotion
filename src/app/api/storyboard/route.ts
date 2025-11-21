import { NextRequest, NextResponse } from 'next/server';
import { ClaudeClient } from '@/lib/ai/claude-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const client = new ClaudeClient(apiKey);

    console.log('Generating storyboard for prompt:', prompt);
    const storyboard = await client.generateStoryboard(prompt);

    console.log('Storyboard generated:', {
      shotCount: storyboard.shots.length,
      totalDuration: storyboard.totalDuration
    });

    return NextResponse.json(storyboard);
  } catch (error) {
    console.error('Error generating storyboard:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate storyboard',
      },
      { status: 500 }
    );
  }
}

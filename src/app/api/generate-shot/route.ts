import { NextRequest, NextResponse } from 'next/server';
import { ClaudeClient } from '@/lib/ai/claude-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const {
      shotDescription,
      visualElements,
      duration,
      shotNumber,
      totalShots,
      previousCode,
      visualTheme,
      narrativeTheme,
      narrativeRole,
      narrativeConnection,
      keyMessage,
      emotionalTone,
      previousShotContext,
      nextShotContext,
    } = await request.json();

    if (!shotDescription || !visualElements || !duration || !shotNumber || !totalShots) {
      return NextResponse.json(
        { error: 'Missing required parameters: shotDescription, visualElements, duration, shotNumber, totalShots' },
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

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log(`Generating code for shot ${shotNumber}/${totalShots}`);

          for await (const chunk of client.generateShotCode(
            shotDescription,
            visualElements,
            duration,
            shotNumber,
            totalShots,
            previousCode,
            visualTheme,
            narrativeTheme,
            narrativeRole,
            narrativeConnection,
            keyMessage,
            emotionalTone,
            previousShotContext,
            nextShotContext
          )) {
            const data = JSON.stringify({
              type: 'code',
              content: chunk,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // Send done signal
          const doneData = JSON.stringify({
            type: 'done',
            content: '',
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          const errorData = JSON.stringify({
            type: 'error',
            content: error instanceof Error ? error.message : 'Unknown error',
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in generate-shot API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate shot code',
      },
      { status: 500 }
    );
  }
}

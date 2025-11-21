import { NextRequest, NextResponse } from 'next/server';
import { ClaudeClient } from '@/lib/ai/claude-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { prompt, duration = 120, previousCode } = await request.json();

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

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of client.generateRemotionCode(
            prompt,
            previousCode,
            duration
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
    console.error('Error in generate API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate code',
      },
      { status: 500 }
    );
  }
}

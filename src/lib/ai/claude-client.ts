import Anthropic from '@anthropic-ai/sdk';
import { REMOTION_SYSTEM_PROMPT } from './remotion-prompt';
import { STORYBOARD_SYSTEM_PROMPT, buildStoryboardPrompt } from './storyboard-prompt';
import { StoryboardResponse, VisualTheme, NarrativeTheme } from '@/types/shot';

export class ClaudeClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
    });
  }

  async *generateRemotionCode(
    prompt: string,
    previousCode?: string,
    duration: number = 120
  ): AsyncGenerator<string> {
    const systemPrompt = REMOTION_SYSTEM_PROMPT;

    const durationInSeconds = duration / 30;
    const durationInfo = `\n\nIMPORTANT: The video must be EXACTLY ${duration} frames (${durationInSeconds} seconds at 30fps). Use durationInFrames: ${duration} in your composition.`;

    const userPrompt = previousCode
      ? `Here is the current Remotion component code:\n\n\`\`\`tsx\n${previousCode}\n\`\`\`\n\nPlease modify it according to this request: ${prompt}${durationInfo}\n\nReturn ONLY the updated component code, no explanations.`
      : `Create a Remotion video component for: ${prompt}${durationInfo}\n\nReturn ONLY the component code, no explanations.`;

    const stream = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      stream: true,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }

  async generateRemotionCodeSync(
    prompt: string,
    previousCode?: string
  ): Promise<string> {
    let fullCode = '';
    for await (const chunk of this.generateRemotionCode(prompt, previousCode)) {
      fullCode += chunk;
    }
    return fullCode;
  }

  /**
   * Generate a storyboard (shot breakdown) from a user prompt
   */
  async generateStoryboard(prompt: string): Promise<StoryboardResponse> {
    const userPrompt = buildStoryboardPrompt(prompt);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: STORYBOARD_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse storyboard JSON from response');
    }

    const storyboard = JSON.parse(jsonMatch[0]) as StoryboardResponse;
    return storyboard;
  }

  /**
   * Generate Remotion code for a specific shot in the storyboard
   */
  async *generateShotCode(
    shotDescription: string,
    visualElements: string[],
    duration: number,
    shotNumber: number,
    totalShots: number,
    previousCode?: string,
    visualTheme?: VisualTheme,
    narrativeTheme?: NarrativeTheme,
    narrativeRole?: string,
    narrativeConnection?: string,
    keyMessage?: string,
    emotionalTone?: string,
    previousShotContext?: { shotNumber: number; keyMessage: string; description: string },
    nextShotContext?: { shotNumber: number; keyMessage: string; description: string }
  ): AsyncGenerator<string> {
    const durationInSeconds = duration / 30;
    const visualElementsList = visualElements.map((el, i) => `${i + 1}. ${el}`).join('\n');

    const shotContext = `This is shot ${shotNumber} of ${totalShots} in a multi-shot video sequence.`;

    // Build narrative consistency context
    const narrativeConsistencyContext = narrativeTheme
      ? `\n\nNARRATIVE CONSISTENCY REQUIREMENTS (CRITICAL):
This shot is part of a complete story with a unified narrative arc. You MUST maintain narrative coherence:

**Core Message**: ${narrativeTheme.coreMessage}
This is the overall message the entire video communicates.

**Story Arc**: ${narrativeTheme.storyArc}
This shot fits within this narrative structure.

**Emotional Journey**: ${narrativeTheme.emotionalJourney}
Viewer emotions should progress through this journey.

**This Shot's Narrative Role**: ${narrativeRole || 'Advance the story'}
${narrativeConnection ? `**Connection to Previous Shot**: ${narrativeConnection}` : ''}

**Key Message of This Shot**: ${keyMessage || 'Continue the narrative'}
This is what viewers should take away from THIS specific shot.

**Emotional Tone**: ${emotionalTone || 'Continue the emotional progression'}
The emotion this shot should evoke.

${previousShotContext ? `**Previous Shot Context (Shot ${previousShotContext.shotNumber})**:
Message: "${previousShotContext.keyMessage}"
Description: ${previousShotContext.description}
→ Your shot should BUILD ON this, not repeat it.` : ''}

${nextShotContext ? `**Next Shot Preview (Shot ${nextShotContext.shotNumber})**:
Message: "${nextShotContext.keyMessage}"
Description: ${nextShotContext.description}
→ Your shot should SET UP for this transition.` : ''}

**Narrative Style**: ${narrativeTheme.narrativeStyle}
**Tonality**: ${narrativeTheme.tonality}

CRITICAL: Your visual content, text, and animations must all serve the narrative. Each element should advance the story and evoke the intended emotion. Don't just make it look good - make it tell the story.`
      : '';

    // Build visual consistency context
    const visualConsistencyContext = visualTheme
      ? `\n\nVISUAL CONSISTENCY REQUIREMENTS (CRITICAL):
This shot is part of a ${totalShots}-shot video with a unified visual theme. You MUST maintain consistency:

**Color Palette (STRICT)**: Use ONLY these exact colors: ${visualTheme.colors.join(', ')}
Color scheme: ${visualTheme.colorDescription}
DO NOT use any colors outside this palette. These hex codes are mandatory.

**Typography**: ${visualTheme.typography}
Keep font style consistent with other shots. Sizes can vary but style must match.

**Animation Style**: ${visualTheme.animationStyle}
Match this energy level and animation approach exactly.

**Background Style**: ${visualTheme.backgroundStyle}
Continue this background treatment approach.

${visualTheme.visualAnchors && visualTheme.visualAnchors.length > 0 ? `**Visual Anchors (Must Include)**: ${visualTheme.visualAnchors.join(', ')}
These visual elements should persist across shots for continuity.` : ''}

DO NOT introduce random new colors or styles. Maintain visual coherence with the other shots in this sequence.`
      : '';

    const userPrompt = previousCode
      ? `Here is the current Remotion component code:\n\n\`\`\`tsx\n${previousCode}\n\`\`\`\n\nPlease modify it according to this request:\n\nShot Description: ${shotDescription}\n\nVisual Elements:\n${visualElementsList}\n\nDuration: EXACTLY ${duration} frames (${durationInSeconds} seconds at 30fps)\n\n${shotContext}${narrativeConsistencyContext}${visualConsistencyContext}\n\nReturn ONLY the updated component code, no explanations.`
      : `Create a Remotion video component for:\n\nShot Description: ${shotDescription}\n\nVisual Elements:\n${visualElementsList}\n\nDuration: EXACTLY ${duration} frames (${durationInSeconds} seconds at 30fps)\n\n${shotContext}${narrativeConsistencyContext}${visualConsistencyContext}\n\nFocus on making this shot tell its part of the story effectively while maintaining visual and narrative consistency with the overall sequence. Return ONLY the component code, no explanations.`;

    const stream = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: REMOTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      stream: true,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }

  /**
   * Generate shot code synchronously
   */
  async generateShotCodeSync(
    shotDescription: string,
    visualElements: string[],
    duration: number,
    shotNumber: number,
    totalShots: number,
    previousCode?: string,
    visualTheme?: VisualTheme,
    narrativeTheme?: NarrativeTheme,
    narrativeRole?: string,
    narrativeConnection?: string,
    keyMessage?: string,
    emotionalTone?: string,
    previousShotContext?: { shotNumber: number; keyMessage: string; description: string },
    nextShotContext?: { shotNumber: number; keyMessage: string; description: string }
  ): Promise<string> {
    let fullCode = '';
    for await (const chunk of this.generateShotCode(
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
      fullCode += chunk;
    }
    return fullCode;
  }
}

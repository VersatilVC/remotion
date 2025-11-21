# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered video creation application that converts natural language prompts into animated videos using Claude AI and Remotion. Users describe a video in plain English, and the AI generates Remotion React code that creates the animation.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with TypeScript
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS v4)
- **AI**: Anthropic Claude API (Sonnet 4.5) for code generation
- **Video Engine**: Remotion for programmatic video generation
- **Code Editor**: Monaco Editor for code editing
- **Video Preview**: @remotion/player for browser-based preview

## Common Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

## Architecture

### Key Directories

- `src/app/` - Next.js app router pages and API routes
  - `page.tsx` - Landing page with prompt input
  - `create/page.tsx` - Main creation interface (3-panel layout)
  - `api/generate/route.ts` - Streaming API for AI code generation
- `src/components/` - Reusable React components
  - `code-editor.tsx` - Monaco Editor wrapper
  - `video-preview.tsx` - Remotion Player wrapper
  - `prompt-input.tsx` - Prompt textarea component
  - `ui/` - shadcn/ui components
- `src/lib/` - Utilities and clients
  - `ai/claude-client.ts` - Claude API client with streaming
  - `ai/remotion-prompt.ts` - System prompt for Remotion code generation
- `src/types/` - TypeScript type definitions

### Data Flow

1. User enters prompt on landing page → navigates to `/create?prompt=...`
2. Create page sends prompt to `/api/generate` (POST with streaming)
3. API route uses `ClaudeClient` to stream generated code back
4. Frontend accumulates streamed code and updates Monaco Editor in real-time
5. `VideoPreview` component compiles code and renders with Remotion Player
6. User can edit code manually or send follow-up prompts to iterate

### AI Code Generation

The AI uses a specialized Remotion system prompt (`src/lib/ai/remotion-prompt.ts`) that teaches Claude:
- Remotion React component structure
- Using `useCurrentFrame()` for animations
- Animation helpers: `interpolate()`, `spring()`, `Sequence`, `Series`
- Deterministic rendering (no `Math.random()`)
- Component should be self-contained TypeScript/React

Generated code is streamed via Server-Sent Events (SSE) for real-time feedback.

### Video Preview

The `VideoPreview` component:
- Takes generated code as a string prop
- Dynamically imports it as a React component using blob URLs
- Renders it with `@remotion/player`
- Handles errors gracefully
- Default composition: 1920x1080, 30fps, 120 frames (4 seconds)

## Environment Variables

Required in `.env.local`:
```
ANTHROPIC_API_KEY=your_api_key_here
```

Get an API key from: https://console.anthropic.com/

## Development Notes

### Adding New Features

- **New shadcn components**: Run `npx shadcn@latest add <component>`
- **Remotion helpers**: Import from 'remotion' package
- **API routes**: Use Next.js 15 App Router conventions (`route.ts`)
- **Streaming**: Use `ReadableStream` with Server-Sent Events format

### Code Generation Best Practices

When modifying the AI prompt or generation logic:
- Keep system prompt focused on Remotion-specific patterns
- Ensure generated code is self-contained (no external imports beyond Remotion)
- Strip markdown code fences from generated code before rendering
- Handle streaming errors gracefully with user-friendly messages

### Styling

- Uses Tailwind CSS v4 with shadcn/ui
- Dark mode supported via `dark:` classes
- Responsive design: mobile uses tabs, desktop shows side-by-side panels
- Gradient accents: `from-blue-600 to-violet-600`

## Known Limitations

- Video preview uses dynamic imports which may not work with all Remotion features
- No server-side video rendering yet (preview only)
- No video export/download functionality yet
- Generated code must be client-safe (no Node.js APIs)

## Future Enhancements

- Server-side video rendering with `@remotion/renderer`
- Video export as MP4
- Remotion Lambda integration for cloud rendering
- Save/load projects
- Gallery of example videos
- More sophisticated prompt engineering for better code quality

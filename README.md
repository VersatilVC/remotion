# AI Video Creator

Transform your ideas into animated videos using AI. Simply describe what you want, and Claude AI will generate Remotion code to create professional animated videos.

## Features

- 🤖 **AI-Powered**: Claude Sonnet 4.5 generates Remotion code from natural language
- ⚡ **Real-time Streaming**: Watch code generate in real-time with instant preview
- 🎨 **Live Editor**: Edit generated code with Monaco Editor (VS Code editor)
- 📺 **Instant Preview**: See your video in the browser with Remotion Player
- 🔄 **Iterative**: Make changes with follow-up prompts or manual editing
- 🌙 **Dark Mode**: Beautiful UI with light and dark mode support
- 📱 **Responsive**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript
- **UI**: shadcn/ui, Tailwind CSS v4, Radix UI
- **AI**: Anthropic Claude API (Sonnet 4.5)
- **Video**: Remotion (programmatic video generation)
- **Editor**: Monaco Editor

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Anthropic API key ([get one here](https://console.anthropic.com/))

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` and add your Anthropic API key:
   ```env
   ANTHROPIC_API_KEY=your_api_key_here
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Creating a Video

1. On the landing page, enter a description of your video
2. Click "Generate Video" or press `Cmd+Enter` / `Ctrl+Enter`
3. Watch the AI generate Remotion code in real-time
4. See your video preview update automatically

### Editing and Iterating

- **Manual editing**: Edit the generated code directly in Monaco Editor
- **AI iterations**: Enter a new prompt like "Make the text bigger and add a glow effect"

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add `ANTHROPIC_API_KEY` environment variable
4. Deploy

## License

MIT

---

Built with ❤️ using Claude Code and Remotion

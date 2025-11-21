export type ShotStatus =
  | 'pending'      // Not yet processed
  | 'generating'   // AI generating code
  | 'code_ready'   // Code generated, ready to render
  | 'rendering'    // Currently rendering on Lambda
  | 'complete'     // Rendered successfully
  | 'error';       // Error occurred

export interface Shot {
  id: string;
  shotNumber: number;
  description: string;
  visualElements: string[];
  duration: number; // in frames (at 30fps)
  code?: string; // Remotion component code
  status: ShotStatus;
  videoUrl?: string; // S3 URL of rendered video
  thumbnailUrl?: string; // Preview thumbnail
  renderId?: string; // Lambda render ID
  error?: string; // Error message if status is 'error'
  narrativeRole?: string; // This shot's role in the story
  narrativeConnection?: string; // How this connects to previous shot
  keyMessage?: string; // Main message/takeaway
  emotionalTone?: string; // Emotion this shot should evoke
}

export interface Storyboard {
  id: string;
  prompt: string;
  shots: Shot[];
  totalDuration: number; // Total duration in frames
  createdAt: Date;
}

export interface VisualTheme {
  colors: string[]; // Array of hex codes
  colorDescription: string; // Description of color scheme
  typography: string; // Typography style (e.g., "modern bold sans-serif")
  animationStyle: string; // Animation approach (e.g., "smooth and professional")
  backgroundStyle: string; // Background treatment (e.g., "gradient backgrounds")
  visualAnchors?: string[]; // Persistent visual elements that must appear in all shots
}

export interface NarrativeTheme {
  coreMessage: string; // The main message/purpose (e.g., "Launch innovative AI product")
  storyArc: string; // Narrative structure (e.g., "Problem → Solution → Call to Action")
  emotionalJourney: string; // Emotional progression (e.g., "Curiosity → Excitement → Action")
  narrativeStyle: string; // Storytelling approach (e.g., "Bold, direct, inspiring")
  tonality: string; // Voice and tone (e.g., "Professional yet approachable")
}

export interface StoryboardResponse {
  visualTheme?: VisualTheme; // Visual consistency theme for all shots
  narrativeTheme?: NarrativeTheme; // Narrative consistency theme for story flow
  shots: Array<{
    shotNumber: number;
    description: string;
    visualElements: string[];
    suggestedDuration: number; // in seconds
    narrativeRole?: string; // This shot's role in story (e.g., "Setup the problem", "Present the solution")
    narrativeConnection?: string; // How this shot builds on the previous (e.g., "Reveals solution to problem established in Shot 1")
    keyMessage?: string; // The main message/takeaway of this shot (e.g., "Our AI saves you 10 hours per week")
    emotionalTone?: string; // The emotion this shot should evoke (e.g., "Excitement", "Relief", "Curiosity")
  }>;
  totalDuration: number; // in seconds
}

export interface FinalComposition {
  id: string;
  storyboardId: string;
  videoUrl?: string;
  renderId?: string;
  status: 'pending' | 'rendering' | 'complete' | 'error';
  error?: string;
}

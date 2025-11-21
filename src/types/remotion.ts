export interface RemotionComposition {
  id: string;
  component: React.ComponentType<any>;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

export interface VideoPreviewProps {
  code: string;
  compositionId: string;
}

export interface RenderOptions {
  compositionId: string;
  code: string;
  outputLocation?: string;
}

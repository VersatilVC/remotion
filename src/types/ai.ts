export interface GenerateRequest {
  prompt: string;
  previousCode?: string;
  iterationContext?: string;
}

export interface GenerateResponse {
  code: string;
  compositionId: string;
  error?: string;
}

export interface StreamChunk {
  type: 'code' | 'error' | 'done';
  content: string;
}

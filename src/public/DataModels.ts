// Data models for API requests and responses

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  style?: string;
  n?: number;
}

export interface ImageGenerationResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

export interface ObjectGenerationRequest {
  prompt: string;
  schema: string;
  model?: string;
}

export interface ObjectGenerationResponse {
  content: string;
  parsedData?: any;
}

export interface PlayerInfo {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  level?: number;
  experience?: number;
}

export interface JWTExchangeRequest {
  jwt: string;
}

export interface JWTExchangeResponse {
  success: boolean;
  playerToken?: string;
  expiresAt?: number;
  error?: string;
}

export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code?: number;
  };
}

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

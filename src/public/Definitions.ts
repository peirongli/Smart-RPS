// Public interfaces and classes for DeveloperWorks JavaScript SDK

export interface AIResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class AIResultImpl<T = any> implements AIResult<T> {
  constructor(
    public success: boolean,
    public data?: T,
    public error?: string,
    public message?: string
  ) {}

  static success<T>(data: T, message?: string): AIResult<T> {
    return new AIResultImpl(true, data, undefined, message);
  }

  static failure<T>(error: string, message?: string): AIResult<T> {
    return new AIResultImpl(false, undefined, error, message);
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface ChatConfigBase {
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
}

export interface ChatConfig extends ChatConfigBase {
  messages: ChatMessage[];
  stream?: boolean;
}

export interface ChatStreamConfig extends ChatConfigBase {
  messages: ChatMessage[];
  stream: true;
}

export interface StreamingCallback {
  onMessage?: (message: string) => void;
  onComplete?: (fullMessage: string) => void;
  onError?: (error: string) => void;
}

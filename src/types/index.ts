// Common type definitions for DeveloperWorks JavaScript SDK

export interface SchemaEntry {
  name: string;
  description: string;
  jsonSchema: string;
}

export interface ConversationSaveData {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  characterDesign: string;
  lastUpdated: number;
}

export interface NetworkConfig {
  baseUrl: string;
  timeoutSeconds: number;
  maxRetryCount: number;
  retryDelaySeconds: number;
}

export interface AuthConfig {
  gameId: string;
  useOversea: boolean;
  developerToken?: string; // Optional developer token for testing
}

export interface SDKConfig {
  defaultChatModel: string;
  defaultImageModel: string;
  network: NetworkConfig;
  auth: AuthConfig;
  enableDebugLogs: boolean;
}

export interface Logger {
  log(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface EventEmitter {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

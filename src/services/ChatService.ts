import { IChatProvider } from '../providers/IProvider';
import { ChatConfig, ChatStreamConfig, StreamingCallback } from '../public/Definitions';

export class ChatService {
  private _chatProvider: IChatProvider;

  constructor(chatProvider: IChatProvider) {
    this._chatProvider = chatProvider;
  }

  async requestAsync(config: ChatConfig): Promise<any> {
    try {
      if (!this.validateConfig(config)) {
        throw new Error('Invalid chat configuration');
      }

      return await this._chatProvider.chatCompletionAsync(config);
    } catch (error) {
      throw new Error(`Chat request failed: ${error}`);
    }
  }

  async requestStreamAsync(config: ChatStreamConfig, callback: StreamingCallback): Promise<void> {
    try {
      if (!this.validateConfig(config)) {
        throw new Error('Invalid chat configuration');
      }

      if (!config.stream) {
        throw new Error('Stream must be true for streaming requests');
      }

      await this._chatProvider.chatCompletionStreamAsync(config, callback);
    } catch (error) {
      throw new Error(`Streaming chat request failed: ${error}`);
    }
  }

  getAvailableModels(): string[] {
    return [
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-32k',
      'gpt-4.1-mini'
    ];
  }

  validateConfig(config: ChatConfig): boolean {
    if (!config.model || !config.messages || !Array.isArray(config.messages)) {
      return false;
    }

    if (config.messages.length === 0) {
      return false;
    }

    for (const message of config.messages) {
      if (!message.role || !message.content) {
        return false;
      }
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      return false;
    }

    if (config.max_tokens !== undefined && config.max_tokens <= 0) {
      return false;
    }

    if (config.top_p !== undefined && (config.top_p < 0 || config.top_p > 1)) {
      return false;
    }

    return true;
  }

  createSystemMessage(content: string): any {
    return {
      role: 'system',
      content: content
    };
  }

  createUserMessage(content: string, name?: string): any {
    const message: any = {
      role: 'user',
      content: content
    };
    
    if (name) {
      message.name = name;
    }
    
    return message;
  }

  createAssistantMessage(content: string, name?: string): any {
    const message: any = {
      role: 'assistant',
      content: content
    };
    
    if (name) {
      message.name = name;
    }
    
    return message;
  }

  createToolMessage(content: string, toolCallId: string): any {
    return {
      role: 'tool',
      content: content,
      tool_call_id: toolCallId
    };
  }

  buildConversationContext(messages: any[]): string {
    return messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  }

  estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  truncateMessagesToTokenLimit(messages: any[], maxTokens: number): any[] {
    let totalTokens = 0;
    const truncatedMessages = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.estimateTokenCount(message.content);
      
      if (totalTokens + messageTokens <= maxTokens) {
        truncatedMessages.unshift(message);
        totalTokens += messageTokens;
      } else {
        break;
      }
    }

    return truncatedMessages;
  }
}

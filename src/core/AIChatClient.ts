import { IChatProvider } from '../providers/IProvider.js';
import { AIResult, ChatMessage, ChatConfig, StreamingCallback } from '../public/Definitions.js';
import { SchemaLibrary } from './SchemaLibrary.js';
import { AIChatProvider } from '../providers/ai/AIChatProvider.js';
import { AuthManager } from '../auth/AuthManager.js';

export class AIChatClient {
  private _chatProvider: IChatProvider;
  private _schemaLibrary: SchemaLibrary;
  private _defaultModel: string;

  constructor(authManager: AuthManager, baseUrl?: string, defaultModel?: string) {
    this._chatProvider = new AIChatProvider(authManager, baseUrl);
    this._schemaLibrary = this.loadDefaultSchemaLibrary();
    this._defaultModel = defaultModel || 'gpt-4.1-mini';
  }

  async textGenerationAsync(prompt: string, options?: any): Promise<AIResult<string>> {
    try {
      //messages是一个包含用户输入的数组
      const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
      ];

      const config: ChatConfig = {
        model: this._defaultModel,
        messages,
        ...options
      };

      const response = await this._chatProvider.chatCompletionAsync(config);
      
      if (response && response.choices && response.choices.length > 0) {
        const content = response.choices[0].message.content;
        return AIResultImpl.success(content);
      } else {
        return AIResultImpl.failure('No response content received');
      }
    } catch (error) {
      return AIResultImpl.failure(`Text generation failed: ${error}`);
    }
  }

  async textChatStreamAsync(prompt: string, callback: StreamingCallback): Promise<void> {
    try {
      const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
      ];

      const config: ChatConfig = {
        model: this._defaultModel,
        messages,
        stream: true
      };

      await this._chatProvider.chatCompletionStreamAsync(config, callback);
    } catch (error) {
      if (callback.onError) {
        callback.onError(`Streaming failed: ${error}`);
      }
    }
  }

  async generateStructuredAsync(
    prompt: string, 
    schemaLibrary: SchemaLibrary, 
    schemaName: string
  ): Promise<AIResult<any>> {
    try {
      const schema = schemaLibrary.getParsedSchema(schemaName);
      if (!schema) {
        return AIResultImpl.failure(`Schema '${schemaName}' not found`);
      }

      const systemPrompt = `You are a helpful AI assistant. Please respond to the user's request and format your response as valid JSON according to this schema: ${schema.jsonSchema}`;
      
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      const config: ChatConfig = {
        model: this._defaultModel,
        messages,
        temperature: 0.1
      };

      const response = await this._chatProvider.chatCompletionAsync(config);
      
      if (response && response.choices && response.choices.length > 0) {
        const content = response.choices[0].message.content;
        
        try {
          // 清理Markdown代码块格式并提取JSON
          const cleanedContent = this.cleanJsonFromMarkdown(content);
          const parsedData = JSON.parse(cleanedContent);
          return AIResultImpl.success(parsedData);
        } catch (parseError) {
          return AIResultImpl.failure(`Failed to parse JSON response: ${parseError}`);
        }
      } else {
        return AIResultImpl.failure('No response content received');
      }
    } catch (error) {
      return AIResultImpl.failure(`Structured generation failed: ${error}`);
    }
  }

  private loadDefaultSchemaLibrary(): SchemaLibrary {
    return new SchemaLibrary();
  }

  /**
   * 从Markdown代码块中提取JSON内容
   * 处理 ```json ... ``` 格式
   */
  private cleanJsonFromMarkdown(content: string): string {
    // 移除开头的换行符和 ```json 或 ``` 标记
    let cleaned = content.replace(/^\s*```(?:json)?\s*/i, '');
    
    // 移除结尾的 ``` 标记
    cleaned = cleaned.replace(/\s*```\s*$/i, '');
    
    // 移除可能的语言标识符
    cleaned = cleaned.replace(/^\s*```(?:json|javascript|js)\s*/i, '');
    
    // 移除多余的空行和空格
    cleaned = cleaned.trim();
    
    return cleaned;
  }

  get schemaLibrary(): SchemaLibrary {
    return this._schemaLibrary;
  }
}

// Import AIResultImpl for use
import { AIResultImpl } from '../public/Definitions.js';

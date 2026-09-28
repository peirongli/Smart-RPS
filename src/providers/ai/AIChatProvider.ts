import { AuthManager } from '../../auth/AuthManager';
import { IChatProvider } from '../IProvider.js';
import { AIResult, ChatMessage, ChatConfig, StreamingCallback } from '../../public/Definitions.js';
import { ChatCompletionRequest, ChatCompletionResponse } from '../../public/DataModels';

export class AIChatProvider implements IChatProvider {
  private _authManager: AuthManager;
  private _baseUrl: string;

  constructor(authManager: AuthManager, baseUrl?: string) {
    this._authManager = authManager;
    this._baseUrl = baseUrl || 'https://developerworks.agentlandlab.com';
  }

  isReady(): boolean {
    return this._authManager.isReady();
  }

  async chatCompletionAsync(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const authToken = this._authManager.getAuthToken();//从这里获取Token
      if (!authToken) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${this._baseUrl}/ai/${this._authManager.gameId}/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(90000) // 90 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Chat completion failed: ${error}`);
    }
  }

  async chatCompletionStreamAsync(request: ChatCompletionRequest, callback: StreamingCallback): Promise<void> {
    try {
      const authToken = this._authManager.getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${this._baseUrl}/ai/${this._authManager.gameId}/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ ...request, stream: true }),
        signal: AbortSignal.timeout(90000) // 90 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullMessage = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            if (callback.onComplete) {
              callback.onComplete(fullMessage);
            }
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                if (callback.onComplete) {
                  callback.onComplete(fullMessage);
                }
                return;
              }

              try {
                const parsed = JSON.parse(data);//将 ​JSON 格式的字符串转换成对应的 ​JavaScript 对象或值
                
                // 支持自定义的 text-delta 格式
                if (parsed.type === 'text-delta' && parsed.delta) {
                  const content = parsed.delta;
                  fullMessage += content;
                  
                  if (callback.onMessage) {
                    callback.onMessage(content);
                  }
                }
                // 也支持标准的 OpenAI 格式
                else if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  const content = parsed.choices[0].delta.content;
                  fullMessage += content;
                  
                  if (callback.onMessage) {
                    callback.onMessage(content);
                  }
                }
              } catch (parseError) {
                // Ignore parse errors for incomplete JSON chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (callback.onError) {
        callback.onError(`Streaming failed: ${error}`);
      }
    }
  }
}

import { AIResult, StreamingCallback } from '../public/Definitions.js';
import { ConversationSaveData } from '../types/index.js';
import { AIChatClient } from './AIChatClient.js';

export class NPCClient {
  private _chatClient: AIChatClient;
  private _characterDesign: string;
  private _conversationHistory: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: number;
  }> = [];

  constructor(chatClient: AIChatClient, characterDesign: string) {
    this._chatClient = chatClient;
    this._characterDesign = characterDesign;
    
    // Add character design as system message
    this._conversationHistory.push({
      role: 'system',
      content: characterDesign,
      timestamp: Date.now()
    });
  }

  async talk(message: string): Promise<AIResult<string>> {
    try {
      // Add user message to history
      this._conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: Date.now()
      });

      // Build conversation context
      const context = this.buildConversationContext();
      
      // Get AI response
      const result = await this._chatClient.textGenerationAsync(context);
      
      if (result.success && result.data) {
        // Add AI response to history
        this._conversationHistory.push({
          role: 'assistant',
          content: result.data,
          timestamp: Date.now()
        });

        // Save conversation history
        this.saveHistory();
        
        return result;
      } else {
        return result;
      }
    } catch (error) {
      return AIResultImpl.failure(`NPC conversation failed: ${error}`);
    }
  }

  async talkStructured(
    message: string, 
    schemaLibrary: any, 
    schemaName: string
  ): Promise<AIResult<any>> {
    try {
      // Add user message to history
      this._conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: Date.now()
      });

      // Build conversation context
      const context = this.buildConversationContext();
      
      // Get structured AI response
      const result = await this._chatClient.generateStructuredAsync(
        context, 
        schemaLibrary, 
        schemaName
      );
      
      if (result.success && result.data) {
        // Extract the actual response content
        const responseContent = this.extractTalkFromStructuredResponse(result.data);
        
        // Add AI response to history
        this._conversationHistory.push({
          role: 'assistant',
          content: responseContent,
          timestamp: Date.now()
        });

        // Save conversation history
        this.saveHistory();
        
        return result;
      } else {
        return result;
      }
    } catch (error) {
      return AIResultImpl.failure(`Structured NPC conversation failed: ${error}`);
    }
  }

  async talkStream(message: string, callback: StreamingCallback): Promise<void> {
    try {
      // Add user message to history
      this._conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: Date.now()
      });

      // Build conversation context
      const context = this.buildConversationContext();
      
      let fullMessage = '';
      
      await this._chatClient.textChatStreamAsync(context, {
        onMessage: (messageChunk: string) => {
          fullMessage += messageChunk;
          if (callback.onMessage) {
            callback.onMessage(messageChunk);
          }
        },
        onComplete: (completeMessage: string) => {
          // Add AI response to history
          this._conversationHistory.push({
            role: 'assistant',
            content: completeMessage,
            timestamp: Date.now()
          });

          // Save conversation history
          this.saveHistory();
          
          if (callback.onComplete) {
            callback.onComplete(completeMessage);
          }
        },
        onError: (error: string) => {
          if (callback.onError) {
            callback.onError(error);
          }
        }
      });
    } catch (error) {
      if (callback.onError) {
        callback.onError(`Streaming NPC conversation failed: ${error}`);
      }
    }
  }

  setSystemPrompt(prompt: string): void {
    this._characterDesign = prompt;
    
    // Update the first system message
    if (this._conversationHistory.length > 0 && this._conversationHistory[0].role === 'system') {
      this._conversationHistory[0].content = prompt;
    } else {
      // Insert at beginning if no system message exists
      this._conversationHistory.unshift({
        role: 'system',
        content: prompt,
        timestamp: Date.now()
      });
    }
  }

  private buildConversationContext(): string {
    // Build context from conversation history
    const recentMessages = this._conversationHistory.slice(-10); // Last 10 messages
    return recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  }

  private extractTalkFromStructuredResponse(data: any): string {
    // Try to extract a meaningful response from structured data
    if (typeof data === 'string') {
      return data;
    }
    
    if (data.response) {
      return data.response;
    }
    
    if (data.content) {
      return data.content;
    }
    
    if (data.message) {
      return data.message;
    }
    
    // Fallback to JSON string
    return JSON.stringify(data);
  }

  private saveHistory(): void {
    try {
      const saveData: ConversationSaveData = {
        messages: this._conversationHistory,
        characterDesign: this._characterDesign,
        lastUpdated: Date.now()
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('npc_conversation_history', JSON.stringify(saveData));
      }
    } catch (error) {
      console.warn('Failed to save conversation history:', error);
    }
  }

  private loadHistory(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('npc_conversation_history');
        if (saved) {
          const saveData: ConversationSaveData = JSON.parse(saved);
          this._conversationHistory = saveData.messages;
          this._characterDesign = saveData.characterDesign;
        }
      }
    } catch (error) {
      console.warn('Failed to load conversation history:', error);
    }
  }

  clearHistory(): void {
    this._conversationHistory = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('npc_conversation_history');
    }
  }

  get characterDesign(): string {
    return this._characterDesign;
  }

  get conversationHistory(): Array<{role: string, content: string, timestamp: number}> {
    return [...this._conversationHistory];
  }
}

// Import AIResultImpl for use
import { AIResultImpl } from '../public/Definitions.js';

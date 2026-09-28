import { AuthManager } from '../../auth/AuthManager';
import { IObjectProvider } from '../IProvider';
import { ObjectGenerationRequest, ObjectGenerationResponse } from '../../public/DataModels';

export class AIObjectProvider implements IObjectProvider {
  private _authManager: AuthManager;
  private _baseUrl: string = 'https://developerworks.agentlandlab.com';

  constructor(authManager: AuthManager) {
    this._authManager = authManager;
  }

  isReady(): boolean {
    return this._authManager.isReady();
  }

  async generateObjectAsync(request: ObjectGenerationRequest): Promise<ObjectGenerationResponse> {
    try {
      const authToken = this._authManager.getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token available');
      }

      // Parse schema if it's a string
      let schemaObject;
      try {
        schemaObject = typeof request.schema === 'string' 
          ? JSON.parse(request.schema) 
          : request.schema;
      } catch (parseError) {
        throw new Error(`Invalid schema format: ${parseError}`);
      }

      // Prepare the request body for /v1/generateObject endpoint
      // IMPORTANT: schema must be passed as a top-level parameter
      const requestBody = {
        model: request.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant. Please respond to the user's request and format your response as valid JSON according to the provided schema.`
          },
          {
            role: 'user',
            content: request.prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
        schema: schemaObject  // Schema as a top-level parameter (required by the API)
      };

      const response = await fetch(`${this._baseUrl}/ai/${this._authManager.gameId}/v1/generateObject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(90000) // 90 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const apiResponse = await response.json();
      
      // The /v1/generateObject endpoint returns { object: {...}, finishReason, usage, ... }
      // Priority 1: Check for the new format with direct object
      if (apiResponse.object) {
        return {
          content: JSON.stringify(apiResponse.object),
          parsedData: apiResponse.object
        };
      }
      
      // Priority 2: Fallback to OpenAI-style format (for backward compatibility)
      if (apiResponse.choices && apiResponse.choices.length > 0) {
        const content = apiResponse.choices[0].message.content;
        
        try {
          // Try to parse as JSON (may contain markdown code blocks)
          const cleaned = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
          const parsedData = JSON.parse(cleaned);
          return {
            content: content,
            parsedData: parsedData
          };
        } catch (parseError) {
          return {
            content: content,
            parsedData: null
          };
        }
      }
      
      throw new Error('No valid response content received from API');
    } catch (error) {
      throw new Error(`Object generation failed: ${error}`);
    }
  }

  validateRequest(request: ObjectGenerationRequest): boolean {
    if (!request.prompt || request.prompt.trim().length === 0) {
      return false;
    }

    if (!request.schema || request.schema.trim().length === 0) {
      return false;
    }

    try {
      JSON.parse(request.schema);
    } catch (error) {
      return false;
    }

    return true;
  }

  validateSchema(schema: string): boolean {
    try {
      const parsed = JSON.parse(schema);
      return typeof parsed === 'object' && parsed !== null;
    } catch (error) {
      return false;
    }
  }
}

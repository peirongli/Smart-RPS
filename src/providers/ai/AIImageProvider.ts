import { AuthManager } from '../../auth/AuthManager';
import { IImageProvider } from '../IProvider.js';
import { AIResult } from '../../public/Definitions.js';
import { ImageGenerationRequest, ImageGenerationResponse } from '../../public/DataModels.js';

export class AIImageProvider implements IImageProvider {
  private _authManager: AuthManager;
  private _baseUrl: string;

  constructor(authManager: AuthManager, baseUrl?: string) {
    this._authManager = authManager;
    this._baseUrl = baseUrl || 'https://developerworks.agentlandlab.com';
  }

  isReady(): boolean {
    return this._authManager.isReady();
  }

  async generateImageAsync(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      const authToken = this._authManager.getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${this._baseUrl}/ai/${this._authManager.gameId}/v1/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(90000) // 90 second timeout for image generation
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Image generation failed: ${error}`);
    }
  }

  validateRequest(request: ImageGenerationRequest): boolean {
    if (!request.prompt || request.prompt.trim().length === 0) {
      return false;
    }

    if (request.size && !this.isValidSize(request.size)) {
      return false;
    }

    if (request.quality && !this.isValidQuality(request.quality)) {
      return false;
    }

    if (request.style && !this.isValidStyle(request.style)) {
      return false;
    }

    if (request.n && (request.n < 1 || request.n > 10)) {
      return false;
    }

    return true;
  }

  private isValidSize(size: string): boolean {
    const validSizes = ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'];
    return validSizes.includes(size);
  }

  private isValidQuality(quality: string): boolean {
    const validQualities = ['standard', 'hd'];
    return validQualities.includes(quality);
  }

  private isValidStyle(style: string): boolean {
    const validStyles = ['vivid', 'natural'];
    return validStyles.includes(style);
  }
}

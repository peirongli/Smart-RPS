import { IImageProvider } from '../providers/IProvider.js';
import { AIResult } from '../public/Definitions.js';
import { ImageGenerationRequest, ImageGenerationResponse } from '../public/DataModels.js';
import { AIImageProvider } from '../providers/ai/AIImageProvider.js';
import { AuthManager } from '../auth/AuthManager.js';

export interface ImageGenerationOptions {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  style?: string;
  n?: number;
}

export interface GeneratedImage {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

export class AIImageClient {
  private _imageProvider: IImageProvider;
  private _defaultModel: string;

  constructor(authManager: AuthManager, baseUrl?: string, defaultModel?: string) {
    this._imageProvider = new AIImageProvider(authManager, baseUrl);
    this._defaultModel = defaultModel || 'Kolors';
  }

  async generateImageAsync(options: ImageGenerationOptions): Promise<AIResult<GeneratedImage[]>> {
    try {
      const request: ImageGenerationRequest = {
        prompt: options.prompt,
        model: options.model || this._defaultModel,
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        style: options.style || 'natural',
        n: options.n || 1
      };

      const response = await this._imageProvider.generateImageAsync(request);
      
      if (response && response.data && Array.isArray(response.data)) {
        return AIResultImpl.success(response.data);
      } else {
        return AIResultImpl.failure('Invalid image generation response');
      }
    } catch (error) {
      return AIResultImpl.failure(`Image generation failed: ${error}`);
    }
  }

  async generateImageBase64Async(options: ImageGenerationOptions): Promise<AIResult<string>> {
    try {
      const result = await this.generateImageAsync(options);
      
      if (result.success && result.data && result.data.length > 0) {
        const image = result.data[0];
        if (image.b64_json) {
          return AIResultImpl.success(image.b64_json);
        } else {
          return AIResultImpl.failure('No base64 data in response');
        }
      } else {
        // 如果result失败，返回失败结果，但需要转换类型
        return AIResultImpl.failure(result.error || 'Image generation failed');
      }
    } catch (error) {
      return AIResultImpl.failure(`Base64 image generation failed: ${error}`);
    }
  }

  async generateImagesAsync(options: ImageGenerationOptions): Promise<AIResult<GeneratedImage[]>> {
    try {
      const result = await this.generateImageAsync(options);
      return result;
    } catch (error) {
      return AIResultImpl.failure(`Multiple image generation failed: ${error}`);
    }
  }

  // Utility methods for base64 image processing
  static async base64ToImage(base64String: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `data:image/png;base64,${base64String}`;
    });
  }

  static async base64ToBlob(base64String: string, mimeType: string = 'image/png'): Promise<Blob> {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  static async base64ToFile(base64String: string, filename: string, mimeType: string = 'image/png'): Promise<File> {
    const blob = await this.base64ToBlob(base64String, mimeType);
    return new File([blob], filename, { type: mimeType });
  }

  static async downloadImage(url: string, filename: string): Promise<void> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadLink.href);
    } catch (error) {
      throw new Error(`Failed to download image: ${error}`);
    }
  }
}

// Import AIResultImpl for use
import { AIResultImpl } from '../public/Definitions.js';

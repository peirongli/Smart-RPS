// Provider interfaces for AI services

export interface IProvider {
  isReady(): boolean;
}

export interface IChatProvider extends IProvider {
  chatCompletionAsync(request: any): Promise<any>;
  chatCompletionStreamAsync(request: any, callback: any): Promise<void>;
}

export interface IImageProvider extends IProvider {
  generateImageAsync(request: any): Promise<any>;
}

export interface IObjectProvider extends IProvider {
  generateObjectAsync(request: any): Promise<any>;
}

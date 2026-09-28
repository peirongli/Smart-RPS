import { SDKConfig } from '../types/index.js';
import { AuthManager } from '../auth/AuthManager.js';
import { AuthFlowManager } from '../auth/AuthFlowManager.js';
import { AIChatProvider } from '../providers/ai/AIChatProvider.js';
import { AIImageProvider } from '../providers/ai/AIImageProvider.js';
import { AIObjectProvider } from '../providers/ai/AIObjectProvider.js';
import { AIChatClient } from './AIChatClient.js';
import { AIImageClient } from './AIImageClient.js';
import { NPCClient } from './NPCClient.js';
import { PlayerClient } from './PlayerClient.js';

export class DeveloperWorksSDK {
  private static _instance: DeveloperWorksSDK | null = null;
  
  private _config: SDKConfig | null = null;
  private _authManager: AuthManager;
  private _playerClient: PlayerClient | null = null;
  private _authFlowManager: AuthFlowManager | null = null;
  private _isInitialized: boolean = false;

  private constructor() {
    this._authManager = new AuthManager();
  }

  static get Instance(): DeveloperWorksSDK {
    if (!DeveloperWorksSDK._instance) {
      DeveloperWorksSDK._instance = new DeveloperWorksSDK();
    }
    return DeveloperWorksSDK._instance;
  }

  async initializeAsync(config: SDKConfig): Promise<boolean> {
    try {
      this._config = config;
      
      // Setup authentication with game ID and optional developer token
      this._authManager.setup(config.auth.gameId, config.auth.developerToken);
      
      // Initialize authentication
      const authSuccess = await this._authManager.authenticateAsync(config.auth);
      if (!authSuccess) {
        console.log('[DeveloperWorks SDK] Authentication required. Use startAuthFlow() to begin user authentication.');
      }

      this._isInitialized = true;
      
      if (config.enableDebugLogs) {
        console.log('DeveloperWorks SDK initialized successfully');
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize DeveloperWorks SDK:', error);
      return false;
    }
  }

  /**
   * Start the authentication flow for user login
   */
  async startAuthFlow(callbacks?: {
    onLoading?: (isLoading: boolean) => void;
    onError?: (error: string) => void;
    onSuccess?: () => void;
    onCodeSent?: (sessionId: string) => void;
    onVerificationComplete?: (globalToken: string) => void;
  }): Promise<boolean> {
    if (!this._isInitialized) {
      throw new Error('SDK not initialized. Call initializeAsync first.');
    }

    // Create player client if not exists
    if (!this._playerClient) {
      this._playerClient = new PlayerClient(this._config?.network?.baseUrl);
    }

    // Create auth flow manager
    this._authFlowManager = new AuthFlowManager(this._authManager, this._playerClient, callbacks);
    
    // Start the authentication flow
    return await this._authFlowManager.startAuthFlow();
  }

  /**
   * Send verification code for authentication
   */
  async sendVerificationCode(identifier: string, type: 'email' | 'phone', callbacks?: {
    onLoading?: (isLoading: boolean) => void;
    onError?: (error: string) => void;
    onCodeSent?: (sessionId: string) => void;
  }): Promise<boolean> {
    if (!this._playerClient) {
      throw new Error('PlayerClient not available. Call startAuthFlow first.');
    }

    if (!this._authFlowManager) {
      throw new Error('AuthFlowManager not available. Call startAuthFlow first.');
    }

    // Update callbacks if provided, without recreating the instance
    if (callbacks) {
      this._authFlowManager.updateCallbacks(callbacks);
    }

    return await this._authFlowManager.sendVerificationCodeAsync(identifier, type);
  }

  /**
   * Verify code and complete authentication
   */
  async verifyCode(code: string, callbacks?: {
    onLoading?: (isLoading: boolean) => void;
    onError?: (error: string) => void;
    onSuccess?: () => void;
    onVerificationComplete?: (globalToken: string) => void;
  }): Promise<boolean> {
    if (!this._playerClient) {
      throw new Error('PlayerClient not available. Call startAuthFlow first.');
    }

    if (!this._authFlowManager) {
      throw new Error('AuthFlowManager not available. Call startAuthFlow first.');
    }

    // Update callbacks if provided, without recreating the instance
    if (callbacks) {
      this._authFlowManager.updateCallbacks(callbacks);
    }

    return await this._authFlowManager.verifyCodeAsync(code);
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  get config(): SDKConfig | null {
    return this._config;
  }

  get authManager(): AuthManager {
    return this._authManager;
  }

  get playerClient(): PlayerClient | null {
    return this._playerClient;
  }

  static get Factory() {
    return {
      CreateChatClient: () => {
        if (!DeveloperWorksSDK.Instance.isInitialized) {
          throw new Error('SDK not initialized. Call initializeAsync first.');
        }
        const baseUrl = DeveloperWorksSDK.Instance._config?.network?.baseUrl;
        const defaultModel = DeveloperWorksSDK.Instance._config?.defaultChatModel;
        return new AIChatClient(DeveloperWorksSDK.Instance._authManager, baseUrl, defaultModel);
      },
      
      CreateImageClient: () => {
        if (!DeveloperWorksSDK.Instance.isInitialized) {
          throw new Error('SDK not initialized. Call initializeAsync first.');
        }
        const baseUrl = DeveloperWorksSDK.Instance._config?.network?.baseUrl;
        const defaultModel = DeveloperWorksSDK.Instance._config?.defaultImageModel;
        return new AIImageClient(DeveloperWorksSDK.Instance._authManager, baseUrl, defaultModel);
      },
      
      CreatePlayerClient: () => {
        if (!DeveloperWorksSDK.Instance.isInitialized) {
          throw new Error('SDK not initialized. Call initializeAsync first.');
        }
        const baseUrl = DeveloperWorksSDK.Instance._config?.network?.baseUrl;
        return new PlayerClient(baseUrl, DeveloperWorksSDK.Instance._authManager);
      },
      
      CreateObjectProvider: () => {
        if (!DeveloperWorksSDK.Instance.isInitialized) {
          throw new Error('SDK not initialized. Call initializeAsync first.');
        }
        return new AIObjectProvider(DeveloperWorksSDK.Instance._authManager);
      },

      CreateAuthFlowManager: (callbacks?: {
        onLoading?: (isLoading: boolean) => void;
        onError?: (error: string) => void;
        onSuccess?: () => void;
        onCodeSent?: (sessionId: string) => void;
        onVerificationComplete?: (globalToken: string) => void;
      }) => {
        if (!DeveloperWorksSDK.Instance.isInitialized) {
          throw new Error('SDK not initialized. Call initializeAsync first.');
        }
        if (!DeveloperWorksSDK.Instance._playerClient) {
          throw new Error('PlayerClient not available. Call startAuthFlow first.');
        }
        const baseUrl = DeveloperWorksSDK.Instance._config?.network?.baseUrl;
        return new AuthFlowManager(DeveloperWorksSDK.Instance._authManager, DeveloperWorksSDK.Instance._playerClient, callbacks);
      }
    };
  }

  static get Populate() {
    return {
      NPCClient: (chatClient: any, characterDesign: string) => {
        return new NPCClient(chatClient, characterDesign);
      }
    };
  }
}

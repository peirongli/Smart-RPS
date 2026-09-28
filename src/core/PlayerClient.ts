import { AIResult } from '../public/Definitions.js';
import { PlayerInfo, JWTExchangeRequest, JWTExchangeResponse, ApiResult } from '../public/DataModels.js';

export interface ExchangeResponse {
  success: boolean;
  playerToken?: string;
  expiresAt?: string;
  error?: string;
}

export class PlayerClient {
  private _jwtToken: string | null = null;
  private _playerToken: string | null = null;
  private _playerInfo: PlayerInfo | null = null;
  private _baseUrl: string;
  private _lastExchangeResponse: ExchangeResponse | null = null;

  constructor(baseUrl?: string, authManager?: any) {
    this._baseUrl = baseUrl || 'https://developerworks.agentlandlab.com';
    // Load saved player token from AuthManager
    this.loadPlayerToken(authManager);
  }

  async initializeAsync(jwtToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      this._jwtToken = jwtToken;
      
      // Exchange JWT for player token
      const exchangeResult = await this.exchangeJWTForPlayerTokenAsync();
      if (exchangeResult) {
        return { success: true };
      } else {
        return { success: false, error: 'Failed to exchange JWT for player token' };
      }
    } catch (error) {
      console.error('PlayerClient initialization failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async exchangeJWTForPlayerTokenAsync(): Promise<boolean> {
    try {
      if (!this._jwtToken) {
        throw new Error('JWT token not set');
      }

      const request: JWTExchangeRequest = {
        jwt: this._jwtToken
      };

      const response = await this.postRequestAsync<JWTExchangeResponse>(
        '/api/external/exchange-jwt',
        request
      );

      if (response.success && response.data) {
        this._playerToken = response.data.playerToken || null;
        this._lastExchangeResponse = {
          success: true,
          playerToken: response.data.playerToken,
          expiresAt: response.data.expiresAt?.toString()
        };
        return true;
      } else {
        this._lastExchangeResponse = {
          success: false,
          error: response.error || 'Exchange failed'
        };
        return false;
      }
    } catch (error) {
      console.error('JWT exchange failed:', error);
      this._lastExchangeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      return false;
    }
  }

  async getPlayerInfoAsync(): Promise<AIResult<PlayerInfo>> {
    try {
      if (!this._playerToken) {
        return AIResultImpl.failure('Player token not available');
      }

      const response = await this.getRequestAsync<PlayerInfo>('/api/external/player-info');
      
      if (response.success && response.data) {
        this._playerInfo = response.data;
        return AIResultImpl.success(response.data);
      } else {
        return AIResultImpl.failure(`Failed to get player info: ${response.error}`);
      }
    } catch (error) {
      return AIResultImpl.failure(`Get player info failed: ${error}`);
    }
  }

  hasValidPlayerToken(): boolean {
    const hasToken = this._playerToken !== null;
    console.log(`[PlayerClient] hasValidPlayerToken: ${hasToken}, token: ${this._playerToken ? this._playerToken.substring(0, 20) + '...' : 'null'}`);
    return hasToken;
  }

  private loadPlayerToken(authManager?: any): void {
    // Try to load from AuthManager first
    if (authManager && authManager.getAuthToken) {
      const token = authManager.getAuthToken();
      if (token && !authManager.isDeveloperToken()) {
        this._playerToken = token;
        console.log('[PlayerClient] Loaded player token from AuthManager');
        return;
      }
    }
    
    // Fallback to localStorage (browser environment)
    if (typeof window !== 'undefined' && window.localStorage) {
      const token = localStorage.getItem('DW_SDK_PlayerToken');
      if (token) {
        this._playerToken = token;
        console.log('[PlayerClient] Loaded player token from storage');
      } else {
        console.log('[PlayerClient] No player token found in storage');
      }
    } else {
      console.log('[PlayerClient] localStorage not available and no AuthManager provided');
    }
  }

  getCachedPlayerInfo(): PlayerInfo | null {
    return this._playerInfo;
  }

  getPlayerToken(): string | null {
    return this._playerToken;
  }

  setPlayerToken(token: string): void {
    this._playerToken = token;
  }

  get lastExchangeResponse(): ExchangeResponse | null {
    return this._lastExchangeResponse;
  }

  // New methods for authentication flow
  async sendVerificationCodeAsync(identifier: string, type: 'email' | 'phone'): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      const request = {
        identifier: identifier,
        type: type
      };

      const response = await this.postRequestAsync<{ success: boolean; sessionId?: string }>(
        '/api/auth/send-code',
        request
      );

      if (response.success && response.data && response.data.sessionId) {
        return { success: true, sessionId: response.data.sessionId };
      } else {
        return { success: false, error: response.error || 'Failed to send verification code' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async verifyCodeAsync(sessionId: string, code: string): Promise<{ success: boolean; globalToken?: string; error?: string }> {
    try {
      const request = {
        sessionId: sessionId,
        code: code
      };

      const response = await this.postRequestAsync<{ success: boolean; globalToken?: string }>(
        '/api/auth/verify-code',
        request
      );

      if (response.success && response.data && response.data.globalToken) {
        return { success: true, globalToken: response.data.globalToken };
      } else {
        return { success: false, error: response.error || 'Verification failed' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getReachabilityAsync(): Promise<{ success: boolean; region?: string; error?: string }> {
    try {
      const response = await this.getRequestAsync<{ country: string; region: string; city: string }>(
        '/api/reachability'
      );

      if (response.success && response.data) {
        return { success: true, region: response.data.region };
      } else {
        return { success: false, error: response.error || 'Failed to get reachability info' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async postRequestAsync<T>(endpoint: string, data: any): Promise<ApiResult<T>> {
    try {
      const response = await fetch(`${this._baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._playerToken || this._jwtToken}`
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getRequestAsync<T>(endpoint: string): Promise<ApiResult<T>> {
    try {
      const response = await fetch(`${this._baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this._playerToken || this._jwtToken}`
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Import AIResultImpl for use
import { AIResultImpl } from '../public/Definitions.js';

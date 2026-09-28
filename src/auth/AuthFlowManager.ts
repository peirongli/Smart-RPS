import { AuthManager } from './AuthManager.js';
import { PlayerClient } from '../core/PlayerClient.js';

export interface AuthFlowCallbacks {
  onLoading?: (isLoading: boolean) => void;
  onError?: (error: string) => void;
  onSuccess?: () => void;
  onCodeSent?: (sessionId: string) => void;
  onVerificationComplete?: (globalToken: string) => void;
}

export interface SendCodeRequest {
  identifier: string;
  type: 'email' | 'phone';
}

export interface SendCodeResponse {
  success: boolean;
  sessionId?: string;
}

export interface VerifyCodeRequest {
  sessionId: string;
  code: string;
}

export interface VerifyCodeResponse {
  success: boolean;
  userId?: string;
  globalToken?: string;
}

export interface ReachabilityResponse {
  country: string;
  region: string;
  city: string;
}

export class AuthFlowManager {
  private _authManager: AuthManager;
  private _playerClient: PlayerClient;
  private _baseUrl: string;
  private _currentSessionId: string | null = null;
  private _callbacks: AuthFlowCallbacks;

  constructor(authManager: AuthManager, playerClient: PlayerClient, callbacks: AuthFlowCallbacks = {}) {
    this._authManager = authManager;
    this._playerClient = playerClient;
    this._baseUrl = authManager.baseUrl;
    this._callbacks = callbacks;
  }

  /**
   * Start the complete authentication flow
   */
  async startAuthFlow(): Promise<boolean> {
    try {
      this._notifyLoading(true);
      this._notifyError('');

      // Check if we already have a valid token
      if (this._authManager.isTokenValid()) {
        this._notifySuccess();
        return true;
      }

      // Get reachability info to determine default auth type
      const reachability = await this._getReachabilityAsync();
      const defaultType = reachability?.region === 'CN' ? 'phone' : 'email';

      console.log(`[AuthFlowManager] Default auth type: ${defaultType}`);
      
      return false; // Indicate that UI interaction is needed
    } catch (error) {
      this._notifyError(`Authentication flow failed: ${error}`);
      return false;
    } finally {
      this._notifyLoading(false);
    }
  }

  /**
   * Send verification code to the specified identifier
   */
  async sendVerificationCodeAsync(identifier: string, type: 'email' | 'phone'): Promise<boolean> {
    try {
      this._notifyLoading(true);
      this._notifyError('');

      if (!identifier || (type !== 'email' && type !== 'phone')) {
        this._notifyError('Please enter a valid email or phone number.');
        return false;
      }

      const request: SendCodeRequest = {
        identifier: identifier,
        type: type
      };

      const response = await this._makeRequest<SendCodeResponse>(
        '/api/auth/send-code',
        'POST',
        request
      );

      if (response.success && response.data) {
        // Check if the API returned success and sessionId
        if (response.data.success && response.data.sessionId) {
          this._currentSessionId = response.data.sessionId;
          this._notifyCodeSent(response.data.sessionId);
          console.log(`[AuthFlowManager] Verification code sent. Session ID: ${response.data.sessionId}`);
          return true;
        } else if (response.data.sessionId) {
          // Handle case where API doesn't return success field but has sessionId
          this._currentSessionId = response.data.sessionId;
          this._notifyCodeSent(response.data.sessionId);
          console.log(`[AuthFlowManager] Verification code sent. Session ID: ${response.data.sessionId}`);
          return true;
        } else {
          console.log('[AuthFlowManager] API response missing sessionId:', response.data);
          this._notifyError('Failed to send verification code. Please check your input and try again.');
          return false;
        }
      } else {
        console.log('[AuthFlowManager] API request failed:', response);
        this._notifyError('Failed to send verification code. Please check your input and try again.');
        return false;
      }
    } catch (error) {
      this._notifyError(`Network error. Please try again.`);
      return false;
    } finally {
      this._notifyLoading(false);
    }
  }

  /**
   * Verify the code and complete authentication
   */
  async verifyCodeAsync(code: string): Promise<boolean> {
    try {
      this._notifyLoading(true);
      this._notifyError('');

      if (!this._currentSessionId) {
        this._notifyError('Session expired. Please request a new code.');
        return false;
      }

      if (!code || code.length < 6) {
        this._notifyError('Please enter a valid 6-digit code.');
        return false;
      }

      const request: VerifyCodeRequest = {
        sessionId: this._currentSessionId,
        code: code
      };

      const response = await this._makeRequest<VerifyCodeResponse>(
        '/api/auth/verify-code',
        'POST',
        request
      );

      if (response.success && response.data && response.data.globalToken) {
        this._notifyVerificationComplete(response.data.globalToken);
        
        // Exchange global token for player token
        const exchangeResult = await this._exchangeGlobalTokenForPlayerToken(response.data.globalToken);
        
        if (exchangeResult) {
          this._notifySuccess();
          return true;
        } else {
          this._notifyError('Final authentication step failed.');
          return false;
        }
      } else {
        this._notifyError('Invalid verification code.');
        return false;
      }
    } catch (error) {
      this._notifyError(`Network error. Please try again.`);
      return false;
    } finally {
      this._notifyLoading(false);
    }
  }

  /**
   * Get reachability information to determine default auth type
   */
  private async _getReachabilityAsync(): Promise<ReachabilityResponse | null> {
    try {
      const response = await this._makeRequest<ReachabilityResponse>(
        '/api/reachability',
        'GET'
      );

      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      console.error('[AuthFlowManager] Failed to get reachability info:', error);
    }
    return null;
  }

  /**
   * Exchange global token for player token
   */
  private async _exchangeGlobalTokenForPlayerToken(globalToken: string): Promise<boolean> {
    try {
      const initResult = await this._playerClient.initializeAsync(globalToken);
      
      if (initResult.success) {
        const playerToken = this._playerClient.getPlayerToken();
        const lastResponse = this._playerClient.lastExchangeResponse;
        
        if (playerToken && lastResponse?.expiresAt) {
          // Save to localStorage (static method)
          AuthManager.savePlayerToken(playerToken, lastResponse.expiresAt);
          
          // Also update the AuthManager instance state
          const expiryDate = new Date(lastResponse.expiresAt).getTime();
          this._authManager.savePlayerToken(playerToken, expiryDate);
          
          console.log('[AuthFlowManager] JWT exchanged for Player Token and saved successfully.');
          return true;
        }
      }
      
      console.error('[AuthFlowManager] Failed to exchange JWT for Player Token:', initResult.error);
      return false;
    } catch (error) {
      console.error('[AuthFlowManager] Exchange failed:', error);
      return false;
    }
  }

  /**
   * Make HTTP request to the API
   */
  private async _makeRequest<T>(endpoint: string, method: 'GET' | 'POST', data?: any): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const url = `${this._baseUrl}${endpoint}`;
      const options: RequestInit = {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      };

      if (data && method === 'POST') {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);

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

  /**
   * Notify callbacks
   */
  private _notifyLoading(isLoading: boolean): void {
    if (this._callbacks.onLoading) {
      this._callbacks.onLoading(isLoading);
    }
  }

  private _notifyError(error: string): void {
    if (this._callbacks.onError && error) {
      this._callbacks.onError(error);
    }
  }

  private _notifySuccess(): void {
    if (this._callbacks.onSuccess) {
      this._callbacks.onSuccess();
    }
  }

  private _notifyCodeSent(sessionId: string): void {
    if (this._callbacks.onCodeSent) {
      this._callbacks.onCodeSent(sessionId);
    }
  }

  private _notifyVerificationComplete(globalToken: string): void {
    if (this._callbacks.onVerificationComplete) {
      this._callbacks.onVerificationComplete(globalToken);
    }
  }

  /**
   * Update callbacks without recreating the instance
   */
  updateCallbacks(callbacks: AuthFlowCallbacks): void {
    this._callbacks = { ...this._callbacks, ...callbacks };
  }

  /**
   * Get current session ID
   */
  get currentSessionId(): string | null {
    return this._currentSessionId;
  }

  /**
   * Reset the flow state
   */
  reset(): void {
    this._currentSessionId = null;
  }
}

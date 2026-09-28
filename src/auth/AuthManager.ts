import { AuthConfig } from '../types';

export class AuthManager {
  private _developerToken: string | null = null;
  private _playerToken: string | null = null;
  private _tokenExpiry: number | null = null;
  private _gameId: string | null = null;
  private _useOversea: boolean = false;
  private _baseUrl: string = 'https://developerworks.agentlandlab.com';

  // Storage keys aligned with Unity version
  private static readonly PlayerTokenKey = 'DW_SDK_PlayerToken';
  private static readonly TokenExpiryKey = 'DW_SDK_TokenExpiry';

  constructor() {}

  setup(gameId: string, developerToken?: string): void {
    this._gameId = gameId;
    if (developerToken) {
      this._developerToken = developerToken;
    }
    console.log(`[Developerworks SDK] Initializing authentication with the following game id: ${gameId}`);
  }

  async authenticateAsync(config: AuthConfig): Promise<boolean> {
    try {
      this._gameId = config.gameId;
      this._useOversea = config.useOversea;
      
      // If using a developer token, authentication is always considered successful
      if (this.isDeveloperToken()) {
        console.log('[Developerworks SDK] Using developer token. Authentication successful.');
        return true;
      }

      // Load existing player token
      this.loadPlayerToken();

      if (this.isTokenValid()) {
        console.log('[Developerworks SDK] Existing valid player token found.');
        return true;
      }

      console.log('[Developerworks SDK] No valid player token found. Authentication required.');
      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  getAuthToken(): string | null {
    return this._playerToken || this._developerToken;
  }

  isDeveloperToken(): boolean {
    return this._developerToken !== null;
  }

  isTokenValid(): boolean {
    // Developer tokens are always considered valid
    if (this.isDeveloperToken()) {
      return true;
    }

    // Check player token
    if (!this._playerToken) {
      return false;
    }

    // Check expiry for Player Tokens
    if (!this._tokenExpiry) {
      return false;
    }

    if (Date.now() > this._tokenExpiry) {
      console.log('[Developerworks SDK] Player token has expired.');
      this.clearPlayerToken(); // Clean up expired token
      return false;
    }

    return true;
  }

  // Aligned with Unity version - handles ISO 8601 date strings
  static savePlayerToken(token: string, expiresAtString: string): void {
    // The API returns null for never-expiring tokens. We'll store a far-future date.
    // Otherwise, we parse the ISO 8601 date string.
    let expiryDate: number;
    if (!expiresAtString) {
      expiryDate = Date.now() + (100 * 365 * 24 * 60 * 60 * 1000); // 100 years from now
    } else {
      expiryDate = new Date(expiresAtString).getTime();
    }

    // Save to localStorage in browser environment
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(AuthManager.PlayerTokenKey, token);
      localStorage.setItem(AuthManager.TokenExpiryKey, expiryDate.toString());
    }
    
    console.log('[Developerworks SDK] New player token saved successfully.');
  }

  savePlayerToken(token: string, expiry: number): void {
    this._playerToken = token;
    this._tokenExpiry = expiry;
    
    // Save to localStorage in browser environment
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(AuthManager.PlayerTokenKey, token);
      localStorage.setItem(AuthManager.TokenExpiryKey, expiry.toString());
    }
  }

  static clearPlayerToken(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(AuthManager.PlayerTokenKey);
      localStorage.removeItem(AuthManager.TokenExpiryKey);
    }
  }

  clearPlayerToken(): void {
    this._playerToken = null;
    this._tokenExpiry = null;
    
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(AuthManager.PlayerTokenKey);
      localStorage.removeItem(AuthManager.TokenExpiryKey);
    }
  }

  private loadPlayerToken(): void {
    // Do not overwrite a developer token
    if (this.isDeveloperToken()) return;

    if (typeof window !== 'undefined' && window.localStorage) {
      const token = localStorage.getItem(AuthManager.PlayerTokenKey);
      const expiry = localStorage.getItem(AuthManager.TokenExpiryKey);
      
      if (token && expiry) {
        this._playerToken = token;
        this._tokenExpiry = parseInt(expiry, 10);
      }
    }
  }

  isReady(): boolean {
    return this._developerToken !== null || this._playerToken !== null;
  }

  get gameId(): string | null {
    return this._gameId;
  }

  get baseUrl(): string {
    return this._baseUrl;
  }
}

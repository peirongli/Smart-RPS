// Main entry point for DeveloperWorks JavaScript SDK
// Re-exports all public classes and interfaces

// Core SDK
export { DeveloperWorksSDK } from './core/DeveloperWorksSDK.js';
export { AIChatClient } from './core/AIChatClient.js';
export { AIImageClient } from './core/AIImageClient.js';
export { NPCClient } from './core/NPCClient.js';
export { PlayerClient } from './core/PlayerClient.js';
export { SchemaLibrary } from './core/SchemaLibrary.js';

// Authentication
export { AuthManager } from './auth/AuthManager.js';
export { AuthFlowManager } from './auth/AuthFlowManager.js';

// Providers
export { AIChatProvider } from './providers/ai/AIChatProvider.js';
export { AIImageProvider } from './providers/ai/AIImageProvider.js';
export { AIObjectProvider } from './providers/ai/AIObjectProvider.js';

// Services
export { ChatService } from './services/ChatService.js';

// Public interfaces and types
export * from './public/Definitions.js';
export * from './public/DataModels.js';
export * from './types/index.js';

// Default export
export { DeveloperWorksSDK as default } from './core/DeveloperWorksSDK.js';

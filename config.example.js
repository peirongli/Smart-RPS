// 游戏配置示例文件
// 复制此文件为 config.js 并填入你的实际配置

export default {
  // 认证配置
  auth: {
    gameId: '你的游戏ID',                    // 从 DeveloperWorks 控制台获取
    developerToken: '你的开发者令牌'          // 可选，用于测试
  },
  
  // 网络配置
  network: {
    baseUrl: 'https://developerworks.agentlandlab.com',
    timeoutSeconds: 30,
    maxRetryCount: 3,
    retryDelaySeconds: 1
  },
  
  // AI 模型配置
  defaultChatModel: 'gpt-4.1-mini',     // 聊天模型
  enableDebugLogs: true                      // 启用调试日志
};
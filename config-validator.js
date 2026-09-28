/**
 * DeveloperWorks JavaScript SDK 配置验证工具
 * 
 * 使用方法：
 * const { validateConfig } = require('./config-validator.js');
 * const isValid = validateConfig(config);
 */

/**
 * 验证SDK配置
 * @param {Object} config - 配置对象
 * @returns {Object} 验证结果 { isValid: boolean, errors: string[], warnings: string[] }
 */
function validateConfig(config) {
  const errors = [];
  const warnings = [];
  
  // 检查配置对象是否存在
  if (!config) {
    errors.push('配置对象不能为空');
    return { isValid: false, errors, warnings };
  }
  
  // 检查必需参数
  if (!config.auth) {
    errors.push('缺少必需参数: auth');
  } else if (!config.auth.gameId) {
    errors.push('缺少必需参数: auth.gameId');
  } else if (typeof config.auth.gameId !== 'string') {
    errors.push('auth.gameId 必须是字符串类型');
  } else if (!config.auth.gameId.startsWith('dw_pk_')) {
    errors.push('auth.gameId 格式错误，应以 "dw_pk_" 开头');
  }
  
  // 检查可选参数
  if (config.defaultChatModel && !['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4.1-mini'].includes(config.defaultChatModel)) {
    warnings.push('defaultChatModel 建议使用: gpt-3.5-turbo, gpt-4, gpt-4-turbo, gpt-4.1-mini');
  }
  
  if (config.defaultImageModel && !['dall-e-3', 'dall-e-2'].includes(config.defaultImageModel)) {
    warnings.push('defaultImageModel 建议使用: dall-e-3, dall-e-2');
  }
  
  // 检查网络配置
  if (config.network) {
    if (config.network.timeoutSeconds && (config.network.timeoutSeconds < 5 || config.network.timeoutSeconds > 300)) {
      warnings.push('network.timeoutSeconds 建议在 5-300 秒之间');
    }
    
    if (config.network.maxRetryCount && (config.network.maxRetryCount < 0 || config.network.maxRetryCount > 10)) {
      warnings.push('network.maxRetryCount 建议在 0-10 之间');
    }
    
    if (config.network.retryDelaySeconds && (config.network.retryDelaySeconds < 0 || config.network.retryDelaySeconds > 10)) {
      warnings.push('network.retryDelaySeconds 建议在 0-10 秒之间');
    }
  }
  
  // 检查调试日志
  if (config.enableDebugLogs === true) {
    warnings.push('生产环境建议设置 enableDebugLogs: false');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 打印验证结果
 * @param {Object} result - 验证结果
 */
function printValidationResult(result) {
  console.log('🔍 配置验证结果:');
  
  if (result.isValid) {
    console.log('✅ 配置验证通过！');
  } else {
    console.log('❌ 配置验证失败！');
  }
  
  if (result.errors.length > 0) {
    console.log('\n❌ 错误:');
    result.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
  }
  
  if (result.warnings.length > 0) {
    console.log('\n⚠️ 警告:');
    result.warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
  }
  
  return result.isValid;
}

/**
 * 验证并打印结果
 * @param {Object} config - 配置对象
 * @returns {boolean} 是否有效
 */
function validateAndPrint(config) {
  const result = validateConfig(config);
  return printValidationResult(result);
}

module.exports = {
  validateConfig,
  printValidationResult,
  validateAndPrint
};

// 如果直接运行此文件，则验证示例配置
if (require.main === module) {
  console.log('🧪 运行配置验证示例...\n');
  
  // 示例1：有效配置
  console.log('示例1: 有效配置');
  const validConfig = {
    auth: {
      gameId: 'dw_pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    },
    defaultChatModel: 'gpt-4.1-mini',
    enableDebugLogs: true
  };
  validateAndPrint(validConfig);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 示例2：无效配置
  console.log('示例2: 无效配置');
  const invalidConfig = {
    auth: {
      gameId: 'invalid_key'
    },
    defaultChatModel: 'invalid_model',
    network: {
      timeoutSeconds: 1000
    }
  };
  validateAndPrint(invalidConfig);
}

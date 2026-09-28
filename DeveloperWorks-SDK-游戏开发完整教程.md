# DeveloperWorks SDK 游戏开发完整教程

## 🎮 从零开始用 DeveloperWorks SDK 开发 AI 游戏

本教程将手把手教你如何使用 DeveloperWorks JavaScript SDK 从头开始开发一个完整的 AI 驱动游戏。即使你是编程小白，也能跟着这个教程成功创建属于自己的游戏！

---

## 📋 目录

1. [准备工作](#准备工作)
2. [SDK 简介](#sdk-简介)
3. [环境搭建](#环境搭建)
4. [第一个项目：Hello AI](#第一个项目hello-ai)
5. [用户认证系统](#用户认证系统)
6. [AI 聊天功能](#ai-聊天功能)
7. [AI 图像生成](#ai-图像生成)
8. [智能 NPC 系统](#智能-npc-系统)
9. [完整游戏示例：魔法世界](#完整游戏示例魔法世界)
10. [部署和发布](#部署和发布)
11. [常见问题解答](#常见问题解答)

---

## 🚀 准备工作

### 你需要什么？

1. **电脑**：Windows、Mac 或 Linux 都可以
2. **代码编辑器**：推荐 VS Code（免费）
3. **Node.js**：版本 16 或更高
4. **DeveloperWorks 账号**：用于获取 API 密钥

### 获取 API 密钥

1. 访问 [DeveloperWorks 控制台](https://developerworks.agentlandlab.com)
2. 注册并登录
3. 创建新项目，获取：
   - `gameId`（游戏ID，用于标识你的游戏）
   - `developerToken`（开发者令牌，用于测试）

---

## 🎯 SDK 简介

### DeveloperWorks SDK 能做什么？

- **🤖 AI 聊天**：与 AI 进行自然对话
- **🎨 图像生成**：用文字描述生成游戏图片
- **👥 智能 NPC**：创建有记忆的游戏角色
- **🔐 用户认证**：安全的玩家登录系统
- **📊 结构化数据**：生成游戏任务、道具等

### 核心组件

```
DeveloperWorksSDK
├── AuthManager        # 认证管理
├── AIChatClient       # AI 对话
├── AIImageClient      # 图像生成
├── NPCClient          # NPC 系统
├── PlayerClient       # 玩家管理
└── SchemaLibrary      # 结构化数据
```

---

## 💻 环境搭建

### 1. 安装 Node.js

访问 [nodejs.org](https://nodejs.org) 下载并安装 Node.js（选择 LTS 版本）

验证安装：
```bash
node --version  # 应该显示 v16.x.x 或更高
npm --version   # 应该显示包管理器版本
```

### 2. 安装 VS Code

访问 [code.visualstudio.com](https://code.visualstudio.com) 下载并安装

推荐安装的插件：
- JavaScript (ES6) code snippets
- Prettier - Code formatter
- Auto Rename Tag

### 3. 创建项目文件夹

```bash
mkdir my-ai-game
cd my-ai-game
```

### 4. 获取 SDK

将 `DeveloperWorks-JavaScriptSDK` 文件夹复制到你的项目目录中，或者：

```bash
# 如果有 npm 包（假设）
npm install developerworks-javascript-sdk
```

---

## 🌟 第一个项目：Hello AI

让我们创建第一个简单的 AI 对话程序！

### 1. 创建项目结构

```
my-ai-game/
├── DeveloperWorks-JavaScriptSDK/  # SDK 文件夹
├── config.js                      # 配置文件
├── hello-ai.js                    # 主程序
└── package.json                   # 项目配置
```

### 2. 创建 package.json

```bash
npm init -y
```

然后编辑 `package.json`，添加：

```json
{
  "name": "my-ai-game",
  "version": "1.0.0",
  "type": "module",
  "description": "我的第一个AI游戏",
  "main": "hello-ai.js",
  "scripts": {
    "start": "node hello-ai.js",
    "dev": "node --watch hello-ai.js"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

### 3. 创建配置文件 (config.js)

```javascript
// config.js - 游戏配置
export default {
  auth: {
    gameId: '你的游戏ID',                  // 从控制台获取
    developerToken: '你的开发者令牌'        // 从控制台获取（测试用）
  },
  network: {
    baseUrl: 'https://developerworks.agentlandlab.com',
    timeoutSeconds: 30,
    maxRetryCount: 3,
    retryDelaySeconds: 1
  },
  defaultChatModel: 'gpt-4.1-mini',   // AI 聊天模型
  defaultImageModel: 'Kolors',             // AI 图像模型
  enableDebugLogs: true                    // 启用调试日志
};
```

### 4. 创建主程序 (hello-ai.js)

```javascript
// hello-ai.js - 我的第一个AI程序
import { DeveloperWorksSDK } from './DeveloperWorks-JavaScriptSDK/dist/index.js';
import config from './config.js';
import readline from 'readline';

// 创建输入接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 询问用户输入的函数
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function startHelloAI() {
  try {
    console.log('🎮 欢迎来到我的第一个AI游戏！');
    console.log('🚀 正在初始化AI系统...\n');

    // 1. 初始化SDK
    await DeveloperWorksSDK.Instance.initializeAsync(config);
    console.log('✅ AI系统初始化成功！\n');

    // 2. 创建AI聊天客户端
    const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
    console.log('🤖 AI助手已准备就绪！\n');

    // 3. 开始对话循环
    console.log('💬 你可以和AI聊天了！输入 "退出" 结束对话\n');
    
    while (true) {
      // 获取用户输入
      const userInput = await askQuestion('你: ');
      
      // 检查是否要退出
      if (userInput === '退出' || userInput === 'exit') {
        console.log('👋 再见！感谢体验我的AI游戏！');
        break;
      }

      // 发送给AI并获取回复
      console.log('🤖 AI思考中...');
      const result = await chatClient.textGenerationAsync(userInput);
      
      if (result.success) {
        console.log(`AI: ${result.data}\n`);
      } else {
        console.log(`❌ 出错了: ${result.error}\n`);
      }
    }

  } catch (error) {
    console.error('❌ 程序出错:', error);
  } finally {
    rl.close();
  }
}

// 启动程序
startHelloAI();
```

### 5. 运行你的第一个AI程序！

```bash
node hello-ai.js
```

你应该会看到：
```
🎮 欢迎来到我的第一个AI游戏！
🚀 正在初始化AI系统...

✅ AI系统初始化成功！

🤖 AI助手已准备就绪！

💬 你可以和AI聊天了！输入 "退出" 结束对话

你: 
```

现在你可以和AI聊天了！试试输入：
- "你好"
- "给我讲个笑话"
- "帮我想一个游戏角色名字"

---

## 🔐 用户认证系统

在真正的游戏中，我们需要用户登录系统。让我们创建一个完整的认证流程！

### 1. 创建认证程序 (auth-demo.js)

```javascript
// auth-demo.js - 用户认证演示
import { DeveloperWorksSDK } from './DeveloperWorks-JavaScriptSDK/dist/index.js';
import readline from 'readline';

// 配置（不包含开发者令牌，使用真实认证）
const config = {
  auth: {
    gameId: '你的游戏ID'
    // 注意：这里没有 developerToken
  },
  network: {
    baseUrl: 'https://developerworks.agentlandlab.com',
    timeoutSeconds: 30,
    maxRetryCount: 3,
    retryDelaySeconds: 1
  },
  defaultChatModel: 'gpt-4.1-mini',
  defaultImageModel: 'Kolors',
  enableDebugLogs: true
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function userLogin() {
  try {
    console.log('🎮 欢迎来到游戏世界！');
    console.log('🔐 请先登录您的账号\n');

    // 1. 初始化SDK
    console.log('⚙️ 初始化游戏系统...');
    await DeveloperWorksSDK.Instance.initializeAsync(config);
    console.log('✅ 系统初始化完成！\n');

    // 2. 检查是否已经登录
    const authManager = DeveloperWorksSDK.Instance.authManager;
    if (authManager.isTokenValid()) {
      console.log('✅ 检测到已登录的账号，欢迎回来！');
      return true;
    }

    // 3. 开始登录流程
    console.log('🚀 开始登录流程...');
    const authStarted = await DeveloperWorksSDK.Instance.startAuthFlow({
      onLoading: (isLoading) => {
        if (isLoading) {
          console.log('⏳ 系统处理中...');
        }
      },
      onError: (error) => {
        if (error) {
          console.log(`❌ 错误: ${error}`);
        }
      },
      onSuccess: () => {
        console.log('🎉 登录成功！');
      },
      onCodeSent: (sessionId) => {
        console.log('📧 验证码已发送！');
      },
      onVerificationComplete: (globalToken) => {
        console.log('✅ 账号验证完成！');
      }
    });

    if (!authStarted) {
      console.log('✅ 检测到有效登录状态！');
      return true;
    }

    // 4. 选择登录方式
    console.log('\n📋 请选择登录方式：');
    console.log('1. 📧 邮箱登录');
    console.log('2. 📱 手机号登录');
    
    const loginType = await askQuestion('请输入选择 (1 或 2): ');
    const isEmail = loginType === '1';
    const type = isEmail ? 'email' : 'phone';
    
    // 5. 输入邮箱或手机号
    const prompt = isEmail ? '📧 请输入您的邮箱地址: ' : '📱 请输入您的手机号: ';
    const identifier = await askQuestion(prompt);
    
    // 6. 发送验证码
    console.log(`📤 正在发送验证码到您的${isEmail ? '邮箱' : '手机'}...`);
    const codeSent = await DeveloperWorksSDK.Instance.sendVerificationCode(identifier, type, {
      onLoading: (isLoading) => {
        if (isLoading) {
          console.log('⏳ 正在发送验证码...');
        }
      },
      onError: (error) => {
        if (error) {
          console.log(`❌ 发送失败: ${error}`);
        }
      },
      onCodeSent: (sessionId) => {
        console.log('✅ 验证码发送成功！');
      }
    });

    if (!codeSent) {
      console.log('❌ 验证码发送失败，请稍后重试');
      return false;
    }

    // 7. 输入验证码
    const code = await askQuestion('🔐 请输入收到的验证码: ');
    
    console.log('🔍 正在验证...');
    const verified = await DeveloperWorksSDK.Instance.verifyCode(code, {
      onLoading: (isLoading) => {
        if (isLoading) {
          console.log('⏳ 验证中...');
        }
      },
      onError: (error) => {
        if (error) {
          console.log(`❌ 验证失败: ${error}`);
        }
      },
      onSuccess: () => {
        console.log('🎉 验证成功！');
      },
      onVerificationComplete: (globalToken) => {
        console.log('✅ 登录完成！');
      }
    });

    if (verified) {
      console.log('\n🎮 登录成功！欢迎来到游戏世界！');
      
      // 8. 获取玩家信息
      const playerClient = DeveloperWorksSDK.Factory.CreatePlayerClient();
      if (playerClient.hasValidPlayerToken()) {
        const playerInfo = await playerClient.getPlayerInfoAsync();
        if (playerInfo.success) {
          console.log('👤 玩家信息:', playerInfo.data);
        }
      }
      
      return true;
    } else {
      console.log('❌ 登录失败，请重试');
      return false;
    }

  } catch (error) {
    console.error('❌ 登录过程出错:', error);
    return false;
  }
}

async function startAuthDemo() {
  const loginSuccess = await userLogin();
  
  if (loginSuccess) {
    console.log('\n🎉 现在您可以使用所有游戏功能了！');
    
    // 演示登录后的功能
    const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
    const result = await chatClient.textGenerationAsync('欢迎我进入游戏世界！');
    
    if (result.success) {
      console.log(`\n🤖 游戏AI: ${result.data}`);
    }
  }
  
  rl.close();
}

// 启动认证演示
startAuthDemo();
```

### 2. 运行认证演示

```bash
node auth-demo.js
```

按照提示完成登录流程，体验真实的用户认证系统！

---

## 💬 AI 聊天功能

现在让我们创建一个更高级的 AI 聊天系统，支持不同的对话模式！

### 1. 创建高级聊天程序 (advanced-chat.js)

```javascript
// advanced-chat.js - 高级AI聊天系统
import { DeveloperWorksSDK, SchemaLibrary } from './DeveloperWorks-JavaScriptSDK/dist/index.js';
import config from './config.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

class AdvancedChatSystem {
  constructor() {
    this.chatClient = null;
    this.schemaLibrary = new SchemaLibrary();
    this.setupSchemas();
  }

  // 设置结构化数据模板
  setupSchemas() {
    // 游戏角色模板
    this.schemaLibrary.addSchema('character', {
      name: 'character',
      description: '游戏角色信息',
      jsonSchema: JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string', description: '角色名字' },
          class: { type: 'string', description: '职业' },
          level: { type: 'number', description: '等级' },
          skills: { 
            type: 'array', 
            items: { type: 'string' },
            description: '技能列表'
          },
          background: { type: 'string', description: '背景故事' }
        },
        required: ['name', 'class', 'level']
      })
    });

    // 游戏任务模板
    this.schemaLibrary.addSchema('quest', {
      name: 'quest',
      description: '游戏任务',
      jsonSchema: JSON.stringify({
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题' },
          description: { type: 'string', description: '任务描述' },
          difficulty: { 
            type: 'string', 
            enum: ['简单', '中等', '困难', '史诗'],
            description: '难度等级'
          },
          reward: { type: 'string', description: '奖励' },
          steps: {
            type: 'array',
            items: { type: 'string' },
            description: '任务步骤'
          }
        },
        required: ['title', 'description', 'difficulty']
      })
    });

    // 游戏道具模板
    this.schemaLibrary.addSchema('item', {
      name: 'item',
      description: '游戏道具',
      jsonSchema: JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string', description: '道具名称' },
          type: { 
            type: 'string',
            enum: ['武器', '防具', '消耗品', '材料', '特殊'],
            description: '道具类型'
          },
          rarity: {
            type: 'string',
            enum: ['普通', '稀有', '史诗', '传说'],
            description: '稀有度'
          },
          effect: { type: 'string', description: '道具效果' },
          value: { type: 'number', description: '价值' }
        },
        required: ['name', 'type', 'rarity']
      })
    });
  }

  async initialize() {
    console.log('🎮 初始化高级AI聊天系统...');
    await DeveloperWorksSDK.Instance.initializeAsync(config);
    this.chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
    console.log('✅ 系统初始化完成！\n');
  }

  async normalChat() {
    console.log('💬 进入普通聊天模式 (输入 "返回" 回到主菜单)\n');
    
    while (true) {
      const input = await askQuestion('你: ');
      
      if (input === '返回') break;
      
      console.log('🤖 AI思考中...');
      const result = await this.chatClient.textGenerationAsync(input);
      
      if (result.success) {
        console.log(`AI: ${result.data}\n`);
      } else {
        console.log(`❌ 出错了: ${result.error}\n`);
      }
    }
  }

  async streamChat() {
    console.log('⚡ 进入实时聊天模式 (输入 "返回" 回到主菜单)\n');
    
    while (true) {
      const input = await askQuestion('你: ');
      
      if (input === '返回') break;
      
      console.log('🤖 AI: ');
      
      await this.chatClient.textChatStreamAsync(input, {
        onMessage: (message) => {
          process.stdout.write(message);
        },
        onComplete: (fullMessage) => {
          console.log('\n');
        },
        onError: (error) => {
          console.log(`\n❌ 出错了: ${error}\n`);
        }
      });
    }
  }

  async structuredChat() {
    console.log('📊 进入结构化生成模式\n');
    console.log('可用模板:');
    console.log('1. 📝 生成游戏角色');
    console.log('2. 🎯 生成游戏任务');
    console.log('3. ⚔️ 生成游戏道具');
    console.log('4. 🔙 返回主菜单');
    
    while (true) {
      const choice = await askQuestion('\n请选择 (1-4): ');
      
      if (choice === '4') break;
      
      let prompt = '';
      let schemaName = '';
      
      switch (choice) {
        case '1':
          prompt = await askQuestion('描述你想要的角色 (例如: 一个强大的法师): ');
          schemaName = 'character';
          break;
        case '2':
          prompt = await askQuestion('描述你想要的任务 (例如: 一个寻找宝藏的任务): ');
          schemaName = 'quest';
          break;
        case '3':
          prompt = await askQuestion('描述你想要的道具 (例如: 一把火焰剑): ');
          schemaName = 'item';
          break;
        default:
          console.log('❌ 无效选择');
          continue;
      }
      
      console.log('🔮 AI正在生成...');
      const result = await this.chatClient.generateStructuredAsync(
        prompt,
        this.schemaLibrary,
        schemaName
      );
      
      if (result.success) {
        console.log('✅ 生成成功！');
        console.log(JSON.stringify(result.data, null, 2));
      } else {
        console.log(`❌ 生成失败: ${result.error}`);
      }
    }
  }

  async showMenu() {
    while (true) {
      console.log('\n🎮 高级AI聊天系统');
      console.log('================');
      console.log('1. 💬 普通聊天');
      console.log('2. ⚡ 实时聊天');
      console.log('3. 📊 结构化生成');
      console.log('4. 🚪 退出');
      
      const choice = await askQuestion('\n请选择功能 (1-4): ');
      
      switch (choice) {
        case '1':
          await this.normalChat();
          break;
        case '2':
          await this.streamChat();
          break;
        case '3':
          await this.structuredChat();
          break;
        case '4':
          console.log('👋 再见！');
          return;
        default:
          console.log('❌ 无效选择，请重新输入');
      }
    }
  }
}

async function startAdvancedChat() {
  const chatSystem = new AdvancedChatSystem();
  
  try {
    await chatSystem.initialize();
    await chatSystem.showMenu();
  } catch (error) {
    console.error('❌ 系统出错:', error);
  } finally {
    rl.close();
  }
}

// 启动高级聊天系统
startAdvancedChat();
```

### 2. 运行高级聊天系统

```bash
node advanced-chat.js
```

体验不同的聊天模式：
- **普通聊天**：基础的问答对话
- **实时聊天**：AI 逐字输出，更自然
- **结构化生成**：生成游戏数据（角色、任务、道具）

---

## 🎮 高级技巧：游戏中使用 /v1/generateObject 接口

在实时游戏开发中，有时需要更精确的结构化数据生成控制。这时可以直接调用 `/v1/generateObject` 接口。

### 1. 创建游戏物品生成器 (game-item-generator.js)

这个示例展示如何在游戏中实时生成装备、武器等物品：

```javascript
// game-item-generator.js - 游戏物品生成系统
import { DeveloperWorksSDK } from './DeveloperWorks-JavaScriptSDK/dist/index.js';
import config from './config.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

class GameItemGenerator {
  constructor() {
    this.authManager = null;
    this.config = null;
  }

  async initialize() {
    console.log('🎮 初始化游戏物品生成系统...');
    await DeveloperWorksSDK.Instance.initializeAsync(config);
    this.authManager = DeveloperWorksSDK.Instance.authManager;
    this.config = config;
    console.log('✅ 系统初始化完成！\n');
  }

  // 定义武器的 JSON Schema
  getWeaponSchema() {
    return {
      type: 'object',
      properties: {
        name: { type: 'string', description: '武器名称' },
        type: { 
          type: 'string', 
          enum: ['sword', 'bow', 'staff', 'dagger', 'axe'],
          description: '武器类型'
        },
        rarity: { 
          type: 'string', 
          enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
          description: '稀有度'
        },
        stats: {
          type: 'object',
          properties: {
            damage: { type: 'number', minimum: 10, maximum: 100 },
            attackSpeed: { type: 'number', minimum: 0.5, maximum: 3.0 },
            critChance: { type: 'number', minimum: 0, maximum: 1 },
            durability: { type: 'number', minimum: 50, maximum: 500 }
          },
          required: ['damage', 'attackSpeed']
        },
        specialAbility: { 
          type: 'string', 
          description: '特殊能力描述' 
        },
        lore: { 
          type: 'string', 
          description: '武器背景故事' 
        }
      },
      required: ['name', 'type', 'rarity', 'stats']
    };
  }

  // 定义护甲的 JSON Schema
  getArmorSchema() {
    return {
      type: 'object',
      properties: {
        name: { type: 'string', description: '护甲名称' },
        slot: { 
          type: 'string', 
          enum: ['helmet', 'chest', 'gloves', 'boots'],
          description: '装备槽位'
        },
        rarity: { 
          type: 'string', 
          enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
          description: '稀有度'
        },
        stats: {
          type: 'object',
          properties: {
            defense: { type: 'number', minimum: 5, maximum: 80 },
            magicResist: { type: 'number', minimum: 0, maximum: 50 },
            health: { type: 'number', minimum: 0, maximum: 200 },
            weight: { type: 'number', minimum: 1, maximum: 50 }
          },
          required: ['defense']
        },
        setBonus: { 
          type: 'string', 
          description: '套装加成（如果是套装的一部分）' 
        },
        description: { type: 'string' }
      },
      required: ['name', 'slot', 'rarity', 'stats']
    };
  }

  // 核心方法：使用 /v1/generateObject 生成物品
  async generateItem(itemType, materials, playerLevel) {
    const authToken = this.authManager.getAuthToken();
    const baseUrl = this.config.network.baseUrl;
    const publishableKey = this.config.auth.publishableKey;

    // 根据物品类型选择对应的 schema
    const schema = itemType === 'weapon' 
      ? this.getWeaponSchema() 
      : this.getArmorSchema();

    // 构建提示词
    const prompt = `
玩家等级: ${playerLevel}
可用材料: ${materials.join(', ')}
任务: 根据玩家等级和材料，设计一个平衡且有趣的${itemType === 'weapon' ? '武器' : '护甲'}。
要求:
1. 属性要符合玩家等级（等级${playerLevel}适用）
2. 材料应该影响物品的属性和稀有度
3. 给予有创意的特殊能力或背景故事
    `.trim();

    try {
      console.log('🔮 AI 正在锻造物品...');

      const response = await fetch(`${baseUrl}/ai/${publishableKey}/v1/generateObject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          model: this.config.defaults?.chatModel || 'gpt-4.1-mini',
          messages: [
            { 
              role: 'system', 
              content: '你是一个专业的游戏装备设计师，擅长根据材料和等级设计平衡的装备。'
            },
            { 
              role: 'user', 
              content: prompt
            }
          ],
          temperature: 0.7,  // 稍高的温度以获得更有创意的结果
          max_tokens: 800,
          schema: schema  // ⚠️ 关键：schema 作为顶级参数
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // ✅ 优先从 data.object 获取结果
      if (data.object) {
        return {
          success: true,
          item: data.object,
          usage: data.usage,
          model: data.model
        };
      }

      // 降级处理：尝试从 choices 中解析
      if (data.choices?.[0]?.message?.content) {
        const content = data.choices[0].message.content;
        const cleaned = content.replace(/^\s*```(?:json)?\s*/i, '')
                               .replace(/\s*```\s*$/i, '')
                               .trim();
        const item = JSON.parse(cleaned);
        return {
          success: true,
          item: item
        };
      }

      throw new Error('无法从 API 响应中提取物品数据');

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 展示生成的武器
  displayWeapon(weapon) {
    console.log('\n⚔️ ===== 新武器 =====');
    console.log(`🏷️  名称: ${weapon.name}`);
    console.log(`🔧  类型: ${weapon.type}`);
    console.log(`💎  稀有度: ${weapon.rarity}`);
    console.log('\n📊 属性:');
    console.log(`   ⚡ 伤害: ${weapon.stats.damage}`);
    console.log(`   🏃 攻击速度: ${weapon.stats.attackSpeed}`);
    if (weapon.stats.critChance) {
      console.log(`   💥 暴击率: ${(weapon.stats.critChance * 100).toFixed(1)}%`);
    }
    if (weapon.stats.durability) {
      console.log(`   🛡️  耐久度: ${weapon.stats.durability}`);
    }
    if (weapon.specialAbility) {
      console.log(`\n✨ 特殊能力: ${weapon.specialAbility}`);
    }
    if (weapon.lore) {
      console.log(`\n📖 背景故事:\n   ${weapon.lore}`);
    }
    console.log('='.repeat(40));
  }

  // 展示生成的护甲
  displayArmor(armor) {
    console.log('\n🛡️  ===== 新护甲 =====');
    console.log(`🏷️  名称: ${armor.name}`);
    console.log(`📍 槽位: ${armor.slot}`);
    console.log(`💎  稀有度: ${armor.rarity}`);
    console.log('\n📊 属性:');
    console.log(`   🛡️  防御: ${armor.stats.defense}`);
    if (armor.stats.magicResist) {
      console.log(`   ✨ 魔法抗性: ${armor.stats.magicResist}`);
    }
    if (armor.stats.health) {
      console.log(`   ❤️  生命加成: ${armor.stats.health}`);
    }
    if (armor.stats.weight) {
      console.log(`   ⚖️  重量: ${armor.stats.weight}`);
    }
    if (armor.setBonus) {
      console.log(`\n🎁 套装加成: ${armor.setBonus}`);
    }
    if (armor.description) {
      console.log(`\n📝 描述: ${armor.description}`);
    }
    console.log('='.repeat(40));
  }

  async run() {
    while (true) {
      console.log('\n🎮 游戏物品生成器');
      console.log('==================');
      console.log('1. ⚔️  生成武器');
      console.log('2. 🛡️  生成护甲');
      console.log('3. 🚪 退出');

      const choice = await askQuestion('\n请选择 (1-3): ');

      if (choice === '3') {
        console.log('👋 再见！');
        break;
      }

      const itemType = choice === '1' ? 'weapon' : 'armor';
      
      // 获取玩家等级
      const levelInput = await askQuestion('🎯 玩家等级 (1-100): ');
      const playerLevel = parseInt(levelInput) || 10;

      // 获取材料
      console.log('📦 可用材料（用逗号分隔）:');
      console.log('   示例: 龙鳞,秘银,星辰碎片');
      const materialsInput = await askQuestion('材料: ');
      const materials = materialsInput.split(',').map(m => m.trim()).filter(m => m);

      if (materials.length === 0) {
        console.log('❌ 至少需要一种材料！');
        continue;
      }

      // 生成物品
      const result = await this.generateItem(itemType, materials, playerLevel);

      if (result.success) {
        if (itemType === 'weapon') {
          this.displayWeapon(result.item);
        } else {
          this.displayArmor(result.item);
        }

        if (result.usage) {
          console.log(`\n💰 消耗: ${result.usage.totalTokens} tokens`);
          console.log(`🤖 模型: ${result.model}`);
        }
      } else {
        console.log(`\n❌ 生成失败: ${result.error}`);
      }
    }
  }
}

async function startGenerator() {
  const generator = new GameItemGenerator();
  
  try {
    await generator.initialize();
    await generator.run();
  } catch (error) {
    console.error('❌ 系统出错:', error);
  } finally {
    rl.close();
  }
}

// 启动生成器
startGenerator();
```

### 2. 运行物品生成器

```bash
node game-item-generator.js
```

### 3. 使用体验

```
🎮 游戏物品生成器
==================
1. ⚔️  生成武器
2. 🛡️  生成护甲
3. 🚪 退出

请选择 (1-3): 1
🎯 玩家等级 (1-100): 45
📦 可用材料（用逗号分隔）:
   示例: 龙鳞,秘银,星辰碎片
材料: 暗影水晶,虚空精华,上古符文

🔮 AI 正在锻造物品...

⚔️ ===== 新武器 =====
🏷️  名称: 虚空之刃
🔧  类型: sword
💎  稀有度: epic

📊 属性:
   ⚡ 伤害: 68
   🏃 攻击速度: 1.4
   💥 暴击率: 18.5%
   🛡️  耐久度: 320

✨ 特殊能力: 每次攻击有15%几率撕裂虚空，对敌人造成额外30%真实伤害

📖 背景故事:
   这把剑由远古虚空领主锻造，剑身中封印着暗影水晶的力量。
   持剑者可以感受到虚空的低语，在战斗中获得虚空之力的加持。
========================================

💰 消耗: 856 tokens
🤖 模型: gpt-4.1-mini
```

### 4. 关键要点总结

**为什么在游戏中使用 `/v1/generateObject`：**

1. ✅ **精确的类型控制**：schema 确保返回的数据格式完全符合游戏需求
2. ✅ **实时生成**：玩家在游戏中打怪、合成时可以实时生成独特装备
3. ✅ **数据验证**：API 会验证返回的数据符合 schema，减少错误
4. ✅ **直接使用**：返回的 `data.object` 可以直接作为游戏对象使用

**与 `generateStructuredAsync` 的对比：**

| 场景 | 推荐方法 |
|------|---------|
| 游戏实时生成装备/道具 | `/v1/generateObject` |
| 任务系统、对话系统 | `generateStructuredAsync` |
| NPC 属性生成 | `/v1/generateObject` |
| 普通文本对话 | `textGenerationAsync` |

**⚠️ 重要提醒：**

在游戏中使用时，记得：
- ✅ `schema` 必须作为请求体的**顶级参数**
- ✅ 从 `data.object` 获取结果（不是 `choices`）
- ✅ 设置合理的 `temperature`（0.3-0.7，平衡创意和稳定性）
- ✅ 添加降级处理以兼容旧 API 格式

---

## 🎨 AI 图像生成

让我们创建一个 AI 图像生成工具，为游戏生成美术资源！

### 1. 创建图像生成程序 (image-generator.js)

```javascript
// image-generator.js - AI图像生成工具
import { DeveloperWorksSDK } from './DeveloperWorks-JavaScriptSDK/dist/index.js';
import config from './config.js';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

class GameImageGenerator {
  constructor() {
    this.imageClient = null;
    this.outputDir = './generated-images';
  }

  async initialize() {
    console.log('🎨 初始化AI图像生成系统...');
    await DeveloperWorksSDK.Instance.initializeAsync(config);
    this.imageClient = DeveloperWorksSDK.Factory.CreateImageClient();
    
    // 创建输出目录
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    console.log('✅ 图像生成系统初始化完成！\n');
  }

  async generateSingleImage() {
    console.log('🖼️ 单张图片生成模式\n');
    
    const prompt = await askQuestion('📝 请描述你想要的图片: ');
    const size = await askQuestion('📐 图片尺寸 (1: 1024x1024, 2: 512x512, 3: 1024x512): ');
    const quality = await askQuestion('🎯 图片质量 (1: 标准, 2: 高质量): ');
    
    const sizeMap = {
      '1': '1024x1024',
      '2': '512x512', 
      '3': '1024x512'
    };
    
    const qualityMap = {
      '1': 'standard',
      '2': 'hd'
    };

    console.log('\n🎨 AI正在绘制图片...');
    
    try {
      const result = await this.imageClient.generateImageAsync({
        prompt: prompt,
        size: sizeMap[size] || '1024x1024',
        quality: qualityMap[quality] || 'standard',
        style: 'natural',
        n: 1
      });

      if (result.success && result.data && result.data.length > 0) {
        const image = result.data[0];
        
        if (image.url) {
          console.log('✅ 图片生成成功！');
          console.log(`🔗 图片链接: ${image.url}`);
          
          // 下载图片
          const fileName = `generated_${Date.now()}.png`;
          const filePath = path.join(this.outputDir, fileName);
          
          try {
            const response = await fetch(image.url);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(filePath, Buffer.from(buffer));
            console.log(`💾 图片已保存到: ${filePath}`);
          } catch (downloadError) {
            console.log('⚠️ 图片下载失败，但可以通过链接访问');
          }
          
        } else if (image.b64_json) {
          console.log('✅ 图片生成成功！');
          
          // 保存 base64 图片
          const fileName = `generated_${Date.now()}.png`;
          const filePath = path.join(this.outputDir, fileName);
          const buffer = Buffer.from(image.b64_json, 'base64');
          fs.writeFileSync(filePath, buffer);
          console.log(`💾 图片已保存到: ${filePath}`);
        }
        
        if (image.revised_prompt) {
          console.log(`🔄 AI优化后的描述: ${image.revised_prompt}`);
        }
        
      } else {
        console.log('❌ 图片生成失败:', result.error);
      }
      
    } catch (error) {
      console.log('❌ 生成过程出错:', error);
    }
  }

  async generateGameAssets() {
    console.log('🎮 游戏资源生成模式\n');
    
    const assetTypes = {
      '1': '角色肖像',
      '2': '场景背景',
      '3': '武器道具',
      '4': '怪物敌人',
      '5': '建筑物',
      '6': '技能特效'
    };
    
    console.log('可生成的游戏资源类型:');
    Object.entries(assetTypes).forEach(([key, value]) => {
      console.log(`${key}. ${value}`);
    });
    
    const typeChoice = await askQuestion('\n选择资源类型 (1-6): ');
    const assetType = assetTypes[typeChoice];
    
    if (!assetType) {
      console.log('❌ 无效选择');
      return;
    }
    
    const description = await askQuestion(`📝 描述你想要的${assetType}: `);
    
    // 为不同资源类型优化提示词
    let optimizedPrompt = '';
    switch (typeChoice) {
      case '1': // 角色肖像
        optimizedPrompt = `游戏角色肖像，${description}，高质量数字艺术，详细的面部特征，幻想风格`;
        break;
      case '2': // 场景背景
        optimizedPrompt = `游戏场景背景，${description}，宽屏比例，详细环境，幻想游戏风格`;
        break;
      case '3': // 武器道具
        optimizedPrompt = `游戏武器道具，${description}，白色背景，高清物品图标，游戏UI风格`;
        break;
      case '4': // 怪物敌人
        optimizedPrompt = `游戏怪物敌人，${description}，全身图，威胁姿态，幻想生物设计`;
        break;
      case '5': // 建筑物
        optimizedPrompt = `游戏建筑物，${description}，等距视角，详细建筑设计，幻想建筑风格`;
        break;
      case '6': // 技能特效
        optimizedPrompt = `游戏技能特效，${description}，透明背景，发光效果，魔法粒子`;
        break;
    }
    
    console.log(`\n🎨 正在生成${assetType}...`);
    console.log(`🔮 优化后的描述: ${optimizedPrompt}`);
    
    try {
      const result = await this.imageClient.generateImageAsync({
        prompt: optimizedPrompt,
        size: '1024x1024',
        quality: 'hd',
        style: 'natural',
        n: 1
      });

      if (result.success && result.data && result.data.length > 0) {
        const image = result.data[0];
        
        console.log(`✅ ${assetType}生成成功！`);
        
        if (image.url) {
          console.log(`🔗 图片链接: ${image.url}`);
          
          // 下载并保存
          const fileName = `${assetType}_${Date.now()}.png`;
          const filePath = path.join(this.outputDir, fileName);
          
          try {
            const response = await fetch(image.url);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(filePath, Buffer.from(buffer));
            console.log(`💾 ${assetType}已保存到: ${filePath}`);
          } catch (downloadError) {
            console.log('⚠️ 下载失败，但可以通过链接访问');
          }
        }
        
      } else {
        console.log(`❌ ${assetType}生成失败:`, result.error);
      }
      
    } catch (error) {
      console.log('❌ 生成过程出错:', error);
    }
  }

  async batchGenerate() {
    console.log('📦 批量生成模式\n');
    
    const basePrompt = await askQuestion('📝 基础描述: ');
    const count = await askQuestion('🔢 生成数量 (1-5): ');
    const numImages = Math.min(parseInt(count) || 1, 5);
    
    console.log(`\n🎨 正在批量生成 ${numImages} 张图片...`);
    
    for (let i = 1; i <= numImages; i++) {
      console.log(`\n📸 生成第 ${i} 张图片...`);
      
      // 为每张图片添加随机变化
      const variations = [
        '不同角度',
        '不同光照',
        '不同色调',
        '不同细节',
        '不同风格'
      ];
      
      const variation = variations[Math.floor(Math.random() * variations.length)];
      const variedPrompt = `${basePrompt}，${variation}`;
      
      try {
        const result = await this.imageClient.generateImageAsync({
          prompt: variedPrompt,
          size: '1024x1024',
          quality: 'standard',
          style: 'natural',
          n: 1
        });

        if (result.success && result.data && result.data.length > 0) {
          const image = result.data[0];
          
          if (image.url) {
            console.log(`✅ 第 ${i} 张生成成功！`);
            
            const fileName = `batch_${i}_${Date.now()}.png`;
            const filePath = path.join(this.outputDir, fileName);
            
            try {
              const response = await fetch(image.url);
              const buffer = await response.arrayBuffer();
              fs.writeFileSync(filePath, Buffer.from(buffer));
              console.log(`💾 已保存: ${filePath}`);
            } catch (downloadError) {
              console.log(`⚠️ 第 ${i} 张下载失败`);
            }
          }
          
        } else {
          console.log(`❌ 第 ${i} 张生成失败`);
        }
        
        // 避免请求过快
        if (i < numImages) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.log(`❌ 第 ${i} 张生成出错:`, error);
      }
    }
    
    console.log('\n🎉 批量生成完成！');
  }

  async showMenu() {
    while (true) {
      console.log('\n🎨 AI图像生成工具');
      console.log('==================');
      console.log('1. 🖼️ 生成单张图片');
      console.log('2. 🎮 生成游戏资源');
      console.log('3. 📦 批量生成图片');
      console.log('4. 📁 查看已生成图片');
      console.log('5. 🚪 退出');
      
      const choice = await askQuestion('\n请选择功能 (1-5): ');
      
      switch (choice) {
        case '1':
          await this.generateSingleImage();
          break;
        case '2':
          await this.generateGameAssets();
          break;
        case '3':
          await this.batchGenerate();
          break;
        case '4':
          this.showGeneratedImages();
          break;
        case '5':
          console.log('👋 再见！');
          return;
        default:
          console.log('❌ 无效选择，请重新输入');
      }
    }
  }

  showGeneratedImages() {
    console.log('\n📁 已生成的图片:');
    
    if (!fs.existsSync(this.outputDir)) {
      console.log('📭 暂无生成的图片');
      return;
    }
    
    const files = fs.readdirSync(this.outputDir);
    const imageFiles = files.filter(file => 
      file.toLowerCase().endsWith('.png') || 
      file.toLowerCase().endsWith('.jpg') || 
      file.toLowerCase().endsWith('.jpeg')
    );
    
    if (imageFiles.length === 0) {
      console.log('📭 暂无生成的图片');
    } else {
      imageFiles.forEach((file, index) => {
        const filePath = path.join(this.outputDir, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024).toFixed(2);
        console.log(`${index + 1}. ${file} (${size} KB)`);
      });
    }
  }
}

async function startImageGenerator() {
  const generator = new GameImageGenerator();
  
  try {
    await generator.initialize();
    await generator.showMenu();
  } catch (error) {
    console.error('❌ 系统出错:', error);
  } finally {
    rl.close();
  }
}

// 启动图像生成工具
startImageGenerator();
```

### 2. 运行图像生成工具

```bash
node image-generator.js
```

尝试生成不同类型的游戏图片：
- 角色肖像
- 场景背景  
- 武器道具
- 怪物敌人

---

## 👥 智能 NPC 系统

现在让我们创建一个智能 NPC 系统，让游戏角色有记忆和个性！

### 1. 创建 NPC 系统 (npc-system.js)

```javascript
// npc-system.js - 智能NPC对话系统
import { DeveloperWorksSDK } from './DeveloperWorks-JavaScriptSDK/dist/index.js';
import config from './config.js';
import readline from 'readline';
import fs from 'fs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

class GameNPCSystem {
  constructor() {
    this.chatClient = null;
    this.npcs = new Map();
    this.currentNPC = null;
    this.saveFile = './npc-data.json';
  }

  async initialize() {
    console.log('👥 初始化智能NPC系统...');
    await DeveloperWorksSDK.Instance.initializeAsync(config);
    this.chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
    
    // 加载已保存的NPC数据
    this.loadNPCData();
    
    console.log('✅ NPC系统初始化完成！\n');
  }

  loadNPCData() {
    try {
      if (fs.existsSync(this.saveFile)) {
        const data = fs.readFileSync(this.saveFile, 'utf8');
        const savedData = JSON.parse(data);
        
        // 重建NPC对象
        for (const [name, npcData] of Object.entries(savedData)) {
          const npc = DeveloperWorksSDK.Populate.NPCClient(
            this.chatClient,
            npcData.characterDesign
          );
          
          // 恢复对话历史
          npc._conversationHistory = npcData.conversationHistory || [];
          this.npcs.set(name, npc);
        }
        
        console.log(`📚 加载了 ${this.npcs.size} 个已保存的NPC`);
      }
    } catch (error) {
      console.log('⚠️ 加载NPC数据失败:', error.message);
    }
  }

  saveNPCData() {
    try {
      const dataToSave = {};
      
      for (const [name, npc] of this.npcs.entries()) {
        dataToSave[name] = {
          characterDesign: npc._characterDesign,
          conversationHistory: npc._conversationHistory
        };
      }
      
      fs.writeFileSync(this.saveFile, JSON.stringify(dataToSave, null, 2));
      console.log('💾 NPC数据已保存');
    } catch (error) {
      console.log('⚠️ 保存NPC数据失败:', error.message);
    }
  }

  async createNPC() {
    console.log('\n🎭 创建新NPC\n');
    
    const name = await askQuestion('📝 NPC名字: ');
    
    if (this.npcs.has(name)) {
      console.log('❌ 该NPC已存在！');
      return;
    }
    
    console.log('🎨 请设计NPC的性格和背景:');
    console.log('例如: "你是一个友好的铁匠，名叫汤姆，喜欢制作武器，对冒险者很热情"');
    
    const characterDesign = await askQuestion('🖋️ NPC设定: ');
    
    // 创建NPC
    const npc = DeveloperWorksSDK.Populate.NPCClient(this.chatClient, characterDesign);
    this.npcs.set(name, npc);
    
    console.log(`✅ NPC "${name}" 创建成功！`);
    this.saveNPCData();
  }

  async talkToNPC() {
    if (this.npcs.size === 0) {
      console.log('❌ 暂无可对话的NPC，请先创建一个');
      return;
    }

    console.log('\n💬 选择要对话的NPC:');
    const npcList = Array.from(this.npcs.keys());
    npcList.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    
    const choice = await askQuestion('\n选择NPC (输入编号): ');
    const npcIndex = parseInt(choice) - 1;
    
    if (npcIndex < 0 || npcIndex >= npcList.length) {
      console.log('❌ 无效选择');
      return;
    }
    
    const npcName = npcList[npcIndex];
    this.currentNPC = this.npcs.get(npcName);
    
    console.log(`\n🎭 现在与 ${npcName} 对话 (输入 "结束对话" 退出)\n`);
    
    while (true) {
      const message = await askQuestion('你: ');
      
      if (message === '结束对话') {
        console.log(`👋 与 ${npcName} 的对话结束`);
        this.saveNPCData();
        break;
      }
      
      console.log(`🤖 ${npcName} 思考中...`);
      
      const result = await this.currentNPC.talk(message);
      
      if (result.success) {
        console.log(`${npcName}: ${result.data}\n`);
      } else {
        console.log(`❌ ${npcName} 无法回应: ${result.error}\n`);
      }
    }
  }

  async streamTalkToNPC() {
    if (this.npcs.size === 0) {
      console.log('❌ 暂无可对话的NPC，请先创建一个');
      return;
    }

    console.log('\n⚡ 选择要实时对话的NPC:');
    const npcList = Array.from(this.npcs.keys());
    npcList.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    
    const choice = await askQuestion('\n选择NPC (输入编号): ');
    const npcIndex = parseInt(choice) - 1;
    
    if (npcIndex < 0 || npcIndex >= npcList.length) {
      console.log('❌ 无效选择');
      return;
    }
    
    const npcName = npcList[npcIndex];
    this.currentNPC = this.npcs.get(npcName);
    
    console.log(`\n⚡ 与 ${npcName} 实时对话 (输入 "结束对话" 退出)\n`);
    
    while (true) {
      const message = await askQuestion('你: ');
      
      if (message === '结束对话') {
        console.log(`👋 与 ${npcName} 的实时对话结束`);
        this.saveNPCData();
        break;
      }
      
      console.log(`${npcName}: `);
      
      await this.currentNPC.talkStream(message, {
        onMessage: (msg) => process.stdout.write(msg),
        onComplete: (fullMsg) => {
          console.log('\n');
        },
        onError: (error) => {
          console.log(`\n❌ 对话出错: ${error}\n`);
        }
      });
    }
  }

  viewNPCHistory() {
    if (this.npcs.size === 0) {
      console.log('❌ 暂无NPC');
      return;
    }

    console.log('\n📚 选择要查看历史的NPC:');
    const npcList = Array.from(this.npcs.keys());
    npcList.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    
    const choice = askQuestion('\n选择NPC (输入编号): ');
    const npcIndex = parseInt(choice) - 1;
    
    if (npcIndex < 0 || npcIndex >= npcList.length) {
      console.log('❌ 无效选择');
      return;
    }
    
    const npcName = npcList[npcIndex];
    const npc = this.npcs.get(npcName);
    
    console.log(`\n📖 ${npcName} 的对话历史:`);
    console.log('='.repeat(30));
    
    const history = npc.conversationHistory;
    
    if (history.length <= 1) { // 只有系统设定
      console.log('📭 暂无对话历史');
      return;
    }
    
    // 跳过第一个系统消息，显示实际对话
    for (let i = 1; i < history.length; i++) {
      const message = history[i];
      const time = new Date(message.timestamp).toLocaleString();
      
      if (message.role === 'user') {
        console.log(`\n[${time}] 你: ${message.content}`);
      } else if (message.role === 'assistant') {
        console.log(`[${time}] ${npcName}: ${message.content}`);
      }
    }
  }

  listNPCs() {
    console.log('\n👥 当前NPC列表:');
    
    if (this.npcs.size === 0) {
      console.log('📭 暂无NPC');
      return;
    }
    
    console.log('='.repeat(40));
    
    for (const [name, npc] of this.npcs.entries()) {
      const historyCount = Math.max(0, npc.conversationHistory.length - 1);
      console.log(`🎭 ${name}`);
      console.log(`   设定: ${npc._characterDesign.substring(0, 50)}...`);
      console.log(`   对话次数: ${historyCount}`);
      console.log('');
    }
  }

  async deleteNPC() {
    if (this.npcs.size === 0) {
      console.log('❌ 暂无NPC可删除');
      return;
    }

    console.log('\n🗑️ 选择要删除的NPC:');
    const npcList = Array.from(this.npcs.keys());
    npcList.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    
    const choice = await askQuestion('\n选择NPC (输入编号): ');
    const npcIndex = parseInt(choice) - 1;
    
    if (npcIndex < 0 || npcIndex >= npcList.length) {
      console.log('❌ 无效选择');
      return;
    }
    
    const npcName = npcList[npcIndex];
    
    const confirm = await askQuestion(`⚠️ 确定要删除 "${npcName}" 吗？(y/n): `);
    
    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
      this.npcs.delete(npcName);
      this.saveNPCData();
      console.log(`✅ NPC "${npcName}" 已删除`);
    } else {
      console.log('❌ 删除取消');
    }
  }

  async showMenu() {
    while (true) {
      console.log('\n👥 智能NPC对话系统');
      console.log('=====================');
      console.log('1. 🎭 创建新NPC');
      console.log('2. 💬 与NPC对话');
      console.log('3. ⚡ 与NPC实时对话');
      console.log('4. 📚 查看NPC对话历史');
      console.log('5. 📋 查看NPC列表');
      console.log('6. 🗑️ 删除NPC');
      console.log('7. 🚪 退出');
      
      const choice = await askQuestion('\n请选择功能 (1-7): ');
      
      switch (choice) {
        case '1':
          await this.createNPC();
          break;
        case '2':
          await this.talkToNPC();
          break;
        case '3':
          await this.streamTalkToNPC();
          break;
        case '4':
          await this.viewNPCHistory();
          break;
        case '5':
          this.listNPCs();
          break;
        case '6':
          await this.deleteNPC();
          break;
        case '7':
          console.log('👋 再见！');
          return;
        default:
          console.log('❌ 无效选择，请重新输入');
      }
    }
  }
}

async function startNPCSystem() {
  const npcSystem = new GameNPCSystem();
  
  try {
    await npcSystem.initialize();
    await npcSystem.showMenu();
  } catch (error) {
    console.error('❌ 系统出错:', error);
  } finally {
    rl.close();
  }
}

// 启动NPC系统
startNPCSystem();
```

### 2. 运行 NPC 系统

```bash
node npc-system.js
```

创建不同性格的 NPC：
- 友好的商人
- 神秘的法师
- 勇敢的骑士
- 狡猾的盗贼

每个 NPC 都会记住你们的对话历史！

---

## 🏰 完整游戏示例：魔法世界

现在让我们把所有功能整合，创建一个完整的文字冒险游戏！

### 1. 创建完整游戏 (magic-world-game.js)

```javascript
// magic-world-game.js - 魔法世界文字冒险游戏
import { DeveloperWorksSDK, SchemaLibrary } from './DeveloperWorks-JavaScriptSDK/dist/index.js';
import config from './config.js';
import readline from 'readline';
import fs from 'fs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

class MagicWorldGame {
  constructor() {
    this.chatClient = null;
    this.imageClient = null;
    this.schemaLibrary = new SchemaLibrary();
    this.npcs = new Map();
    this.player = {
      name: '',
      level: 1,
      health: 100,
      mana: 50,
      inventory: [],
      location: '新手村'
    };
    this.gameState = {
      currentQuest: null,
      completedQuests: [],
      visitedLocations: ['新手村'],
      gameTime: 0
    };
    this.saveFile = './magic-world-save.json';
  }

  async initialize() {
    console.log('🏰 初始化魔法世界游戏...');
    await DeveloperWorksSDK.Instance.initializeAsync(config);
    
    this.chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
    this.imageClient = DeveloperWorksSDK.Factory.CreateImageClient();
    
    this.setupSchemas();
    this.createDefaultNPCs();
    this.loadGame();
    
    console.log('✅ 魔法世界初始化完成！\n');
  }

  setupSchemas() {
    // 任务模板
    this.schemaLibrary.addSchema('quest', {
      name: 'quest',
      description: '游戏任务',
      jsonSchema: JSON.stringify({
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          difficulty: { type: 'string', enum: ['简单', '中等', '困难', '史诗'] },
          rewards: {
            type: 'object',
            properties: {
              exp: { type: 'number' },
              gold: { type: 'number' },
              items: { type: 'array', items: { type: 'string' } }
            }
          },
          objectives: { type: 'array', items: { type: 'string' } }
        },
        required: ['title', 'description', 'difficulty']
      })
    });

    // 物品模板
    this.schemaLibrary.addSchema('item', {
      name: 'item',
      description: '游戏物品',
      jsonSchema: JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['武器', '防具', '药水', '材料', '宝物'] },
          rarity: { type: 'string', enum: ['普通', '稀有', '史诗', '传说'] },
          effect: { type: 'string' },
          value: { type: 'number' }
        },
        required: ['name', 'type', 'rarity']
      })
    });

    // 地点模板
    this.schemaLibrary.addSchema('location', {
      name: 'location',
      description: '游戏地点',
      jsonSchema: JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['城镇', '野外', '地下城', '神殿', '森林'] },
          dangers: { type: 'array', items: { type: 'string' } },
          resources: { type: 'array', items: { type: 'string' } },
          connections: { type: 'array', items: { type: 'string' } }
        },
        required: ['name', 'description', 'type']
      })
    });
  }

  createDefaultNPCs() {
    // 村长
    const mayor = DeveloperWorksSDK.Populate.NPCClient(
      this.chatClient,
      '你是新手村的村长，名叫艾德华，年迈而智慧，总是愿意帮助新来的冒险者。你了解周围的地理和传说，可以给冒险者提供任务和建议。'
    );
    this.npcs.set('村长艾德华', mayor);

    // 铁匠
    const blacksmith = DeveloperWorksSDK.Populate.NPCClient(
      this.chatClient,
      '你是村里的铁匠，名叫汤姆，强壮而热情，专门制作和修理武器装备。你对金属和锻造有深入的了解，可以为冒险者提供装备相关的帮助。'
    );
    this.npcs.set('铁匠汤姆', blacksmith);

    // 魔法师
    const wizard = DeveloperWorksSDK.Populate.NPCClient(
      this.chatClient,
      '你是神秘的魔法师，名叫莉莉亚，精通各种魔法知识，性格神秘但善良。你可以教授冒险者魔法技能，提供魔法物品，并解释各种神秘现象。'
    );
    this.npcs.set('魔法师莉莉亚', wizard);

    // 商人
    const merchant = DeveloperWorksSDK.Populate.NPCClient(
      this.chatClient,
      '你是旅行商人，名叫马克，经验丰富，走遍了各地。你总是有各种有趣的商品出售，也知道很多关于其他地方的消息和传言。'
    );
    this.npcs.set('商人马克', merchant);
  }

  loadGame() {
    try {
      if (fs.existsSync(this.saveFile)) {
        const data = fs.readFileSync(this.saveFile, 'utf8');
        const savedGame = JSON.parse(data);
        
        this.player = { ...this.player, ...savedGame.player };
        this.gameState = { ...this.gameState, ...savedGame.gameState };
        
        console.log('📚 游戏存档已加载');
      }
    } catch (error) {
      console.log('⚠️ 加载存档失败，开始新游戏');
    }
  }

  saveGame() {
    try {
      const saveData = {
        player: this.player,
        gameState: this.gameState,
        timestamp: Date.now()
      };
      
      fs.writeFileSync(this.saveFile, JSON.stringify(saveData, null, 2));
      console.log('💾 游戏已保存');
    } catch (error) {
      console.log('⚠️ 保存失败:', error.message);
    }
  }

  async startNewGame() {
    console.log('\n🌟 欢迎来到魔法世界！\n');
    console.log('在这个充满魔法和冒险的世界里，你将扮演一名勇敢的冒险者。');
    console.log('你可以与NPC对话、接受任务、探索世界、收集物品，甚至生成专属的游戏图片！\n');
    
    this.player.name = await askQuestion('✨ 请输入你的冒险者名字: ');
    
    console.log(`\n🎉 欢迎你，${this.player.name}！`);
    console.log('你现在位于新手村，准备开始你的冒险之旅...\n');
    
    // 生成开场图片
    const welcomePrompt = `一个美丽的魔法村庄，新手村，有石头房子，绿色草地，远处有山脉，魔幻风格，温馨的氛围`;
    console.log('🎨 为你生成专属的游戏场景...');
    
    try {
      const imageResult = await this.imageClient.generateImageAsync({
        prompt: welcomePrompt,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural'
      });
      
      if (imageResult.success && imageResult.data[0]?.url) {
        console.log(`🖼️ 新手村场景图片: ${imageResult.data[0].url}`);
      }
    } catch (error) {
      console.log('⚠️ 图片生成失败，但不影响游戏进行');
    }
    
    this.saveGame();
  }

  async talkToNPC() {
    console.log('\n👥 村里的居民:');
    const npcList = Array.from(this.npcs.keys());
    npcList.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    
    const choice = await askQuestion('\n选择要对话的NPC (输入编号): ');
    const npcIndex = parseInt(choice) - 1;
    
    if (npcIndex < 0 || npcIndex >= npcList.length) {
      console.log('❌ 无效选择');
      return;
    }
    
    const npcName = npcList[npcIndex];
    const npc = this.npcs.get(npcName);
    
    console.log(`\n💬 与 ${npcName} 对话 (输入 "结束" 退出对话)\n`);
    
    // 添加玩家信息到对话上下文
    const contextMessage = `玩家信息: 姓名：${this.player.name}，等级：${this.player.level}，位置：${this.player.location}，当前任务：${this.gameState.currentQuest?.title || '无'}`;
    
    while (true) {
      const message = await askQuestion('你: ');
      
      if (message === '结束') {
        console.log(`👋 与 ${npcName} 的对话结束`);
        break;
      }
      
      const fullMessage = `${contextMessage}\n玩家说: ${message}`;
      console.log(`🤖 ${npcName} 思考中...`);
      
      const result = await npc.talk(fullMessage);
      
      if (result.success) {
        console.log(`${npcName}: ${result.data}\n`);
      } else {
        console.log(`❌ ${npcName} 无法回应: ${result.error}\n`);
      }
    }
  }

  async generateQuest() {
    console.log('\n🎯 AI正在为你生成专属任务...');
    
    const questPrompt = `为玩家 ${this.player.name} (等级${this.player.level}) 在 ${this.player.location} 生成一个适合的游戏任务。考虑玩家的当前状态和位置。`;
    
    try {
      const result = await this.chatClient.generateStructuredAsync(
        questPrompt,
        this.schemaLibrary,
        'quest'
      );
      
      if (result.success) {
        const quest = result.data;
        this.gameState.currentQuest = quest;
        
        console.log('\n📜 新任务生成！');
        console.log(`🏆 ${quest.title}`);
        console.log(`📖 ${quest.description}`);
        console.log(`⚡ 难度: ${quest.difficulty}`);
        
        if (quest.objectives) {
          console.log('🎯 任务目标:');
          quest.objectives.forEach((obj, index) => {
            console.log(`  ${index + 1}. ${obj}`);
          });
        }
        
        if (quest.rewards) {
          console.log('🎁 任务奖励:');
          if (quest.rewards.exp) console.log(`  📈 经验: ${quest.rewards.exp}`);
          if (quest.rewards.gold) console.log(`  💰 金币: ${quest.rewards.gold}`);
          if (quest.rewards.items) {
            console.log('  🎒 物品:', quest.rewards.items.join(', '));
          }
        }
        
        this.saveGame();
      } else {
        console.log('❌ 任务生成失败:', result.error);
      }
    } catch (error) {
      console.log('❌ 任务生成出错:', error);
    }
  }

  async generateItem() {
    console.log('\n⚔️ AI正在为你生成神秘物品...');
    
    const itemPrompt = `为等级${this.player.level}的冒险者生成一个合适的游戏物品，要有趣且实用。`;
    
    try {
      const result = await this.chatClient.generateStructuredAsync(
        itemPrompt,
        this.schemaLibrary,
        'item'
      );
      
      if (result.success) {
        const item = result.data;
        this.player.inventory.push(item);
        
        console.log('\n✨ 你发现了一件物品！');
        console.log(`🏷️ ${item.name}`);
        console.log(`📦 类型: ${item.type}`);
        console.log(`💎 稀有度: ${item.rarity}`);
        console.log(`⚡ 效果: ${item.effect}`);
        if (item.value) console.log(`💰 价值: ${item.value} 金币`);
        
        this.saveGame();
        
        // 生成物品图片
        const itemImagePrompt = `游戏物品 ${item.name}，${item.type}，${item.rarity}品质，${item.effect}，幻想游戏风格，白色背景`;
        console.log('\n🎨 为物品生成图片...');
        
        try {
          const imageResult = await this.imageClient.generateImageAsync({
            prompt: itemImagePrompt,
            size: '512x512',
            quality: 'standard',
            style: 'natural'
          });
          
          if (imageResult.success && imageResult.data[0]?.url) {
            console.log(`🖼️ 物品图片: ${imageResult.data[0].url}`);
          }
        } catch (error) {
          console.log('⚠️ 物品图片生成失败');
        }
        
      } else {
        console.log('❌ 物品生成失败:', result.error);
      }
    } catch (error) {
      console.log('❌ 物品生成出错:', error);
    }
  }

  async exploreWorld() {
    console.log('\n🗺️ AI正在为你生成新的探索地点...');
    
    const locationPrompt = `为冒险者生成一个从 ${this.player.location} 可以到达的新地点，要有特色和可探索性。`;
    
    try {
      const result = await this.chatClient.generateStructuredAsync(
        locationPrompt,
        this.schemaLibrary,
        'location'
      );
      
      if (result.success) {
        const location = result.data;
        
        console.log('\n🌍 发现新地点！');
        console.log(`📍 ${location.name}`);
        console.log(`📖 ${location.description}`);
        console.log(`🏞️ 类型: ${location.type}`);
        
        if (location.dangers && location.dangers.length > 0) {
          console.log('⚠️ 危险:', location.dangers.join(', '));
        }
        
        if (location.resources && location.resources.length > 0) {
          console.log('💎 资源:', location.resources.join(', '));
        }
        
        const explore = await askQuestion('\n🚶 要前往这个地点吗？(y/n): ');
        
        if (explore.toLowerCase() === 'y' || explore.toLowerCase() === 'yes') {
          this.player.location = location.name;
          this.gameState.visitedLocations.push(location.name);
          
          console.log(`✅ 你来到了 ${location.name}`);
          
          // 生成地点图片
          const locationImagePrompt = `${location.description}，${location.type}，幻想游戏风格，详细场景`;
          console.log('\n🎨 为新地点生成场景图片...');
          
          try {
            const imageResult = await this.imageClient.generateImageAsync({
              prompt: locationImagePrompt,
              size: '1024x1024',
              quality: 'standard',
              style: 'natural'
            });
            
            if (imageResult.success && imageResult.data[0]?.url) {
              console.log(`🖼️ ${location.name} 场景图片: ${imageResult.data[0].url}`);
            }
          } catch (error) {
            console.log('⚠️ 场景图片生成失败');
          }
          
          this.saveGame();
        }
        
      } else {
        console.log('❌ 地点生成失败:', result.error);
      }
    } catch (error) {
      console.log('❌ 地点生成出错:', error);
    }
  }

  showPlayerStatus() {
    console.log('\n👤 玩家状态');
    console.log('='.repeat(30));
    console.log(`🏷️ 姓名: ${this.player.name}`);
    console.log(`⭐ 等级: ${this.player.level}`);
    console.log(`❤️ 生命值: ${this.player.health}/100`);
    console.log(`💙 魔法值: ${this.player.mana}/100`);
    console.log(`📍 当前位置: ${this.player.location}`);
    console.log(`🎯 当前任务: ${this.gameState.currentQuest?.title || '无'}`);
    console.log(`🎒 背包物品: ${this.player.inventory.length}件`);
    console.log(`🗺️ 已探索地点: ${this.gameState.visitedLocations.join(', ')}`);
  }

  showInventory() {
    console.log('\n🎒 背包');
    console.log('='.repeat(20));
    
    if (this.player.inventory.length === 0) {
      console.log('📭 背包是空的');
      return;
    }
    
    this.player.inventory.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} (${item.type}, ${item.rarity})`);
      console.log(`   ${item.effect}`);
      if (item.value) console.log(`   价值: ${item.value} 金币`);
      console.log('');
    });
  }

  async freeChat() {
    console.log('\n🎭 自由对话模式 (输入 "退出" 结束)\n');
    console.log('在这里你可以与游戏AI自由交流，询问任何关于魔法世界的问题！\n');
    
    while (true) {
      const message = await askQuestion('你: ');
      
      if (message === '退出') {
        console.log('👋 自由对话结束');
        break;
      }
      
      const contextPrompt = `你是魔法世界游戏的AI助手。玩家${this.player.name}(等级${this.player.level})在${this.player.location}向你提问。请以游戏世界的角度回答。\n\n玩家问: ${message}`;
      
      console.log('🤖 游戏AI思考中...');
      
      const result = await this.chatClient.textGenerationAsync(contextPrompt);
      
      if (result.success) {
        console.log(`游戏AI: ${result.data}\n`);
      } else {
        console.log(`❌ AI无法回应: ${result.error}\n`);
      }
    }
  }

  async showMenu() {
    while (true) {
      console.log('\n🏰 魔法世界 - 主菜单');
      console.log('='.repeat(30));
      console.log('1. 💬 与NPC对话');
      console.log('2. 🎯 生成新任务');
      console.log('3. ⚔️ 发现神秘物品');
      console.log('4. 🗺️ 探索新地点');
      console.log('5. 👤 查看玩家状态');
      console.log('6. 🎒 查看背包');
      console.log('7. 🎭 自由对话');
      console.log('8. 💾 保存游戏');
      console.log('9. 🚪 退出游戏');
      
      const choice = await askQuestion('\n请选择操作 (1-9): ');
      
      switch (choice) {
        case '1':
          await this.talkToNPC();
          break;
        case '2':
          await this.generateQuest();
          break;
        case '3':
          await this.generateItem();
          break;
        case '4':
          await this.exploreWorld();
          break;
        case '5':
          this.showPlayerStatus();
          break;
        case '6':
          this.showInventory();
          break;
        case '7':
          await this.freeChat();
          break;
        case '8':
          this.saveGame();
          break;
        case '9':
          console.log('👋 感谢游玩魔法世界！再见！');
          this.saveGame();
          return;
        default:
          console.log('❌ 无效选择，请重新输入');
      }
    }
  }
}

async function startMagicWorld() {
  const game = new MagicWorldGame();
  
  try {
    await game.initialize();
    
    // 检查是否有存档
    if (!game.player.name) {
      await game.startNewGame();
    } else {
      console.log(`🎉 欢迎回来，${game.player.name}！`);
      console.log(`📍 你当前在 ${game.player.location}`);
    }
    
    await game.showMenu();
    
  } catch (error) {
    console.error('❌ 游戏出错:', error);
  } finally {
    rl.close();
  }
}

// 启动魔法世界游戏
startMagicWorld();
```

### 2. 运行完整游戏

```bash
node magic-world-game.js
```

享受你的魔法世界冒险！游戏包含：
- 🎭 与 4 个不同性格的 NPC 对话
- 🎯 AI 生成的个性化任务
- ⚔️ 随机发现神奇物品
- 🗺️ 探索 AI 生成的新地点
- 🎨 为场景和物品生成专属图片
- 💾 完整的存档系统

---

## 🚀 部署和发布

### 1. 准备发布版本

创建 `package.json`：
```json
{
  "name": "my-magic-world-game",
  "version": "1.0.0",
  "description": "基于DeveloperWorks SDK的魔法世界游戏",
  "type": "module",
  "main": "magic-world-game.js",
  "scripts": {
    "start": "node magic-world-game.js",
    "build": "echo 'No build needed for Node.js app'",
    "test": "node --test"
  },
  "keywords": ["game", "ai", "magic", "adventure"],
  "author": "你的名字",
  "license": "MIT",
  "engines": {
    "node": ">=16.0.0"
  }
}
```

### 2. 创建启动脚本

创建 `start.bat` (Windows)：
```batch
@echo off
echo 启动魔法世界游戏...
node magic-world-game.js
pause
```

创建 `start.sh` (Mac/Linux)：
```bash
#!/bin/bash
echo "启动魔法世界游戏..."
node magic-world-game.js
```

### 3. 打包发布

```bash
# 创建发布目录
mkdir magic-world-release
cp -r DeveloperWorks-JavaScriptSDK magic-world-release/
cp magic-world-game.js magic-world-release/
cp config.js magic-world-release/
cp package.json magic-world-release/
cp start.* magic-world-release/

# 创建 README
echo "# 魔法世界游戏\n\n## 运行方法\n1. 安装 Node.js 16+\n2. 修改 config.js 中的API密钥\n3. 运行 npm start" > magic-world-release/README.md
```

---

## ❓ 常见问题解答

### Q: 如何获取 API 密钥？
A: 访问 [DeveloperWorks 控制台](https://developerworks.agentlandlab.com)，注册账号并创建项目即可获取。

### Q: 为什么 AI 回复很慢？
A: AI 生成需要时间，特别是图像生成。可以使用流式对话获得更快的响应体验。

### Q: 可以修改 AI 模型吗？
A: 可以在 `config.js` 中修改 `defaultChatModel` 和 `defaultImageModel`。

### Q: 游戏数据保存在哪里？
A: 保存在运行目录的 JSON 文件中，如 `magic-world-save.json`。

### Q: 如何添加新的 NPC？
A: 在代码中调用 `DeveloperWorksSDK.Populate.NPCClient()` 并提供角色设定。

### Q: 可以在浏览器中运行吗？
A: 需要一些修改，主要是替换 Node.js 特有的模块（如 `fs`, `readline`）。

### Q: 如何优化 AI 回复质量？
A: 提供更详细的上下文信息，使用结构化数据模板，调整温度参数。

### Q: 支持多人游戏吗？
A: 当前是单人游戏，多人功能需要额外的服务器开发。

---

## 🎉 恭喜！

你已经学会了如何使用 DeveloperWorks SDK 创建完整的 AI 游戏！

### 你学到了什么：

1. ✅ SDK 的基础使用和配置
2. ✅ 用户认证系统的实现
3. ✅ AI 聊天功能的集成
4. ✅ AI 图像生成的使用
5. ✅ 智能 NPC 系统的创建
6. ✅ 结构化数据生成
7. ✅ 完整游戏的架构设计
8. ✅ 数据保存和加载
9. ✅ 错误处理和用户体验优化

### 下一步可以做什么：

- 🎨 添加更多游戏机制（战斗、商店、公会等）
- 🌐 开发 Web 版本
- 📱 创建移动端应用
- 🎵 集成音效和背景音乐
- 👥 添加多人游戏功能
- 🤖 训练专属的游戏 AI 模型

### 获得帮助：

- 📚 查阅 SDK 官方文档
- 💬 加入开发者社区
- 🐛 提交 Bug 报告
- 💡 分享你的创意作品

**祝你在 AI 游戏开发的道路上越走越远！** 🚀✨

# DeveloperWorks SDK API 调用指南

## 📖 简介

本文档详细说明 DeveloperWorks JavaScript SDK 中每个 API 的调用方法，每个 API 都包含：
- 📋 **调用方法**：如何调用这个 API
- 💡 **简单示例**：最基础的使用例子

---

## 🚀 快速开始

### 基础配置和初始化

```javascript
// 1. 导入SDK
import { DeveloperWorksSDK } from './DeveloperWorks-JavaScriptSDK/dist/index.js';

// 2. 配置
const config = {
  auth: {
    gameId: '你的游戏ID',
    developerToken: '你的开发者令牌' // 可选，测试用
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

// 3. 初始化
await DeveloperWorksSDK.Instance.initializeAsync(config);
```

---

## 🔐 认证相关 API

### 1. initializeAsync - 初始化SDK

**调用方法：**
```javascript
await DeveloperWorksSDK.Instance.initializeAsync(config);
```

**简单示例：**
```javascript
const config = { auth: { gameId: 'your-key' } };
const success = await DeveloperWorksSDK.Instance.initializeAsync(config);
console.log('初始化结果:', success); // true/false
```

### 2. startAuthFlow - 开始认证流程

**调用方法：**
```javascript
await DeveloperWorksSDK.Instance.startAuthFlow(callbacks);
```

**简单示例：**
```javascript
const result = await DeveloperWorksSDK.Instance.startAuthFlow({
  onError: (error) => console.log('错误:', error),
  onSuccess: () => console.log('认证成功'),
  onCodeSent: (sessionId) => console.log('验证码已发送:', sessionId)
});
console.log('是否需要用户输入:', !result);
```

### 3. sendVerificationCode - 发送验证码

**调用方法：**
```javascript
await DeveloperWorksSDK.Instance.sendVerificationCode(identifier, type, callbacks);
```

**简单示例：**
```javascript
// 发送到邮箱
const success = await DeveloperWorksSDK.Instance.sendVerificationCode(
  'user@example.com', 
  'email',
  {
    onCodeSent: (sessionId) => console.log('验证码已发送:', sessionId),
    onError: (error) => console.log('发送失败:', error)
  }
);
console.log('发送结果:', success);
```

### 4. verifyCode - 验证验证码

**调用方法：**
```javascript
await DeveloperWorksSDK.Instance.verifyCode(code, callbacks);
```

**简单示例：**
```javascript
const success = await DeveloperWorksSDK.Instance.verifyCode('123456', {
  onSuccess: () => console.log('验证成功'),
  onError: (error) => console.log('验证失败:', error),
  onVerificationComplete: (token) => console.log('获得令牌:', token)
});
console.log('验证结果:', success);
```

---

## 🤖 AI 聊天相关 API

### 5. CreateChatClient - 创建聊天客户端

**调用方法：**
```javascript
const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
```

**简单示例：**
```javascript
const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
console.log('聊天客户端已创建');
```

### 6. textGenerationAsync - 文本生成

**调用方法：**
```javascript
await chatClient.textGenerationAsync(prompt, options);
```

**简单示例：**
```javascript
const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
const result = await chatClient.textGenerationAsync('你好，请介绍一下自己');

if (result.success) {
  console.log('AI回复:', result.data);
} else {
  console.log('生成失败:', result.error);
}
```

### 7. textChatStreamAsync - 流式聊天

**调用方法：**
```javascript
await chatClient.textChatStreamAsync(prompt, callbacks);
```

**简单示例：**
```javascript
const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();

await chatClient.textChatStreamAsync('写一首关于春天的诗', {
  onMessage: (chunk) => process.stdout.write(chunk), // 实时输出
  onComplete: (fullMessage) => console.log('\n完整回复:', fullMessage),
  onError: (error) => console.log('错误:', error)
});
```

### 8. generateStructuredAsync - 结构化生成（推荐方式）

**调用方法：**
```javascript
await chatClient.generateStructuredAsync(prompt, schemaLibrary, schemaName);
```

**简单示例：**
```javascript
import { SchemaLibrary } from './DeveloperWorks-JavaScriptSDK/dist/index.js';

// 创建模板库
const schemaLibrary = new SchemaLibrary();
schemaLibrary.addSchema('person', {
  name: 'person',
  description: '人物信息',
  jsonSchema: JSON.stringify({
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      occupation: { type: 'string' }
    },
    required: ['name', 'age']
  })
});

// 生成结构化数据
const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
const result = await chatClient.generateStructuredAsync(
  '创建一个勇敢的骑士角色',
  schemaLibrary,
  'person'
);

if (result.success) {
  console.log('生成的角色:', result.data);
  // 输出: { name: "亚瑟", age: 28, occupation: "骑士" }
} else {
  console.log('生成失败:', result.error);
}
```

**说明：** 这个方法内部调用 `/v1/chat` 接口，适合大多数场景。

---

### 8.5. 直接调用 /v1/generateObject 接口（高级用法）

如果你需要更精确的结构化输出控制，可以直接调用 `/v1/generateObject` 接口：

**调用方法（原生 fetch）：**
```javascript
const response = await fetch(`${baseUrl}/ai/${publishableKey}/v1/generateObject`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: '你是一个游戏设计助手' },
      { role: 'user', content: '创建一个魔法武器' }
    ],
    temperature: 0.3,
    max_tokens: 800,
    schema: {  // ⚠️ 重要：schema 必须作为顶级参数传递
      type: 'object',
      properties: {
        name: { type: 'string' },
        damage: { type: 'number' },
        element: { type: 'string', enum: ['fire', 'ice', 'lightning'] }
      },
      required: ['name', 'damage', 'element']
    }
  })
});

const data = await response.json();

// ✅ API 返回格式：{ object: {...}, finishReason, usage, model, id, timestamp }
if (data.object) {
  console.log('生成的武器:', data.object);
  // 输出: { name: "烈焰之剑", damage: 85, element: "fire" }
}
```

**完整示例（在游戏中使用）：**
```javascript
import { DeveloperWorksSDK } from './DeveloperWorks-JavaScriptSDK/dist/index.js';

// 初始化
const config = {
  auth: {
    gameId: 'your-game-id',
    developerToken: 'your-developer-token'
  },
  network: {
    baseUrl: 'https://developerworks.agentlandlab.com'
  },
  defaults: { chatModel: 'gpt-4.1-mini' }
};

await DeveloperWorksSDK.Instance.initializeAsync(config);

// 定义武器的 JSON Schema
const WeaponSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: '武器名称' },
    type: { type: 'string', enum: ['sword', 'bow', 'staff'], description: '武器类型' },
    damage: { type: 'number', minimum: 10, maximum: 100, description: '伤害值' },
    rarity: { type: 'string', enum: ['common', 'rare', 'epic', 'legendary'], description: '稀有度' },
    special_effect: { type: 'string', description: '特殊效果' }
  },
  required: ['name', 'type', 'damage', 'rarity']
};

// 生成武器
async function generateWeapon(materials) {
  const authManager = DeveloperWorksSDK.Instance.authManager;
  const authToken = authManager.getAuthToken();
  const baseUrl = config.network.baseUrl;
  const publishableKey = config.auth.publishableKey;

  const response = await fetch(`${baseUrl}/ai/${publishableKey}/v1/generateObject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      model: config.defaults.chatModel,
      messages: [
        { 
          role: 'system', 
          content: '你是游戏设计师，根据材料生成武器数据' 
        },
        { 
          role: 'user', 
          content: `根据以下材料生成一把武器：${JSON.stringify(materials)}` 
        }
      ],
      temperature: 0.4,
      max_tokens: 600,
      schema: WeaponSchema  // ⚠️ 关键：schema 作为顶级参数
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // ✅ 从 data.object 获取生成的武器数据
  if (data.object) {
    return data.object;
  }

  // 如果 API 返回旧格式，从 choices 中解析
  if (data.choices?.[0]?.message?.content) {
    const content = data.choices[0].message.content;
    const cleaned = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  }

  throw new Error('未能从 API 响应中提取武器数据');
}

// 使用示例
const materials = ['龙鳞', '星辰碎片', '秘银'];
const weapon = await generateWeapon(materials);
console.log('生成的武器:', weapon);
// 输出: { name: "星辰龙鳞剑", type: "sword", damage: 92, rarity: "legendary", special_effect: "攻击时有30%几率触发星辰之力" }
```

**⚠️ 重要说明：**

1. **schema 参数位置**：必须作为请求体的**顶级参数**传递，与 `model`、`messages` 平级
2. **API 响应格式**：`/v1/generateObject` 返回 `{ object: {...}, finishReason, usage, ... }`
3. **数据获取**：优先从 `data.object` 获取结果，它已经是解析好的 JavaScript 对象
4. **向后兼容**：如果 API 返回旧格式（`choices` 数组），代码会自动降级处理

**两种方式对比：**

| 特性 | generateStructuredAsync | 直接调用 /v1/generateObject |
|------|------------------------|---------------------------|
| 使用难度 | 简单，高层封装 | 需要手动处理请求和响应 |
| 调用接口 | `/v1/chat` | `/v1/generateObject` |
| Schema 传递 | 在 SchemaLibrary 管理 | 直接在请求体中传递 |
| 响应格式 | 统一的 AIResult 包装 | 原始 API 响应 |
| 适用场景 | 一般的结构化数据生成 | 需要精确控制、游戏实时生成 |
| 推荐度 | ⭐⭐⭐⭐⭐ 推荐日常使用 | ⭐⭐⭐⭐ 高级用户/游戏开发 |

---

## 🎨 AI 图像生成相关 API

### 9. CreateImageClient - 创建图像客户端

**调用方法：**
```javascript
const imageClient = DeveloperWorksSDK.Factory.CreateImageClient();
```

**简单示例：**
```javascript
const imageClient = DeveloperWorksSDK.Factory.CreateImageClient();
console.log('图像客户端已创建');
```

### 10. generateImageAsync - 生成图像

**调用方法：**
```javascript
await imageClient.generateImageAsync(options);
```

**简单示例：**
```javascript
const imageClient = DeveloperWorksSDK.Factory.CreateImageClient();

const result = await imageClient.generateImageAsync({
  prompt: '一只可爱的小猫坐在花园里',
  size: '1024x1024',
  quality: 'standard',
  style: 'natural',
  n: 1
});

if (result.success && result.data.length > 0) {
  console.log('图片生成成功!');
  console.log('图片URL:', result.data[0].url);
  console.log('Base64数据:', result.data[0].b64_json ? '有' : '无');
} else {
  console.log('图片生成失败:', result.error);
}
```

### 11. generateImageBase64Async - 生成Base64图像

**调用方法：**
```javascript
await imageClient.generateImageBase64Async(options);
```

**简单示例：**
```javascript
const imageClient = DeveloperWorksSDK.Factory.CreateImageClient();

const result = await imageClient.generateImageBase64Async({
  prompt: '一把闪闪发光的魔法剑',
  size: '512x512'
});

if (result.success) {
  console.log('Base64图片生成成功!');
  console.log('Base64长度:', result.data.length);
  // 可以直接用于 <img src="data:image/png;base64,${result.data}">
} else {
  console.log('生成失败:', result.error);
}
```

---

## 👥 NPC 相关 API

### 12. NPCClient - 创建NPC

**调用方法：**
```javascript
const npc = DeveloperWorksSDK.Populate.NPCClient(chatClient, characterDesign);
```

**简单示例：**
```javascript
const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();

const npc = DeveloperWorksSDK.Populate.NPCClient(
  chatClient,
  '你是一个友好的铁匠，名叫汤姆，喜欢制作武器，对冒险者很热情。'
);

console.log('NPC "汤姆" 已创建');
```

### 13. talk - NPC对话

**调用方法：**
```javascript
await npc.talk(message);
```

**简单示例：**
```javascript
const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
const npc = DeveloperWorksSDK.Populate.NPCClient(
  chatClient,
  '你是村长，名叫艾德华，年迈而智慧。'
);

const result = await npc.talk('你好，村长！');

if (result.success) {
  console.log('村长回复:', result.data);
} else {
  console.log('对话失败:', result.error);
}
```

### 14. talkStream - NPC流式对话

**调用方法：**
```javascript
await npc.talkStream(message, callbacks);
```

**简单示例：**
```javascript
const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
const npc = DeveloperWorksSDK.Populate.NPCClient(
  chatClient,
  '你是神秘的魔法师，名叫莉莉亚。'
);

await npc.talkStream('请教我一些魔法知识', {
  onMessage: (chunk) => process.stdout.write(chunk),
  onComplete: (fullMessage) => console.log('\n对话完成'),
  onError: (error) => console.log('对话出错:', error)
});
```

### 15. conversationHistory - 获取对话历史

**调用方法：**
```javascript
const history = npc.conversationHistory;
```

**简单示例：**
```javascript
const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
const npc = DeveloperWorksSDK.Populate.NPCClient(
  chatClient,
  '你是商人马克。'
);

// 进行一些对话后
await npc.talk('你有什么商品？');
await npc.talk('价格如何？');

// 查看历史
const history = npc.conversationHistory;
console.log('对话历史条数:', history.length);
history.forEach((msg, index) => {
  console.log(`${index}: [${msg.role}] ${msg.content}`);
});
```

---

## 👤 玩家相关 API

### 16. CreatePlayerClient - 创建玩家客户端

**调用方法：**
```javascript
const playerClient = DeveloperWorksSDK.Factory.CreatePlayerClient();
```

**简单示例：**
```javascript
const playerClient = DeveloperWorksSDK.Factory.CreatePlayerClient();
console.log('玩家客户端已创建');
```

### 17. hasValidPlayerToken - 检查玩家令牌

**调用方法：**
```javascript
const hasToken = playerClient.hasValidPlayerToken();
```

**简单示例：**
```javascript
const playerClient = DeveloperWorksSDK.Factory.CreatePlayerClient();
const hasToken = playerClient.hasValidPlayerToken();

if (hasToken) {
  console.log('发现有效的玩家令牌');
} else {
  console.log('没有有效的玩家令牌，需要先登录');
}
```

### 18. getPlayerInfoAsync - 获取玩家信息

**调用方法：**
```javascript
await playerClient.getPlayerInfoAsync();
```

**简单示例：**
```javascript
const playerClient = DeveloperWorksSDK.Factory.CreatePlayerClient();

if (playerClient.hasValidPlayerToken()) {
  const result = await playerClient.getPlayerInfoAsync();
  
  if (result.success) {
    console.log('玩家信息:', result.data);
    // 输出: { id: "...", name: "...", email: "...", ... }
  } else {
    console.log('获取失败:', result.error);
  }
} else {
  console.log('请先登录');
}
```

### 19. initializeAsync - 初始化玩家客户端

**调用方法：**
```javascript
await playerClient.initializeAsync(jwtToken);
```

**简单示例：**
```javascript
const playerClient = DeveloperWorksSDK.Factory.CreatePlayerClient();
const jwtToken = 'your-jwt-token-here';

const result = await playerClient.initializeAsync(jwtToken);

if (result.success) {
  console.log('玩家客户端初始化成功');
} else {
  console.log('初始化失败:', result.error);
}
```

---

## 📊 数据模板相关 API

### 20. SchemaLibrary - 创建模板库

**调用方法：**
```javascript
import { SchemaLibrary } from './DeveloperWorks-JavaScriptSDK/dist/index.js';
const schemaLibrary = new SchemaLibrary();
```

**简单示例：**
```javascript
import { SchemaLibrary } from './DeveloperWorks-JavaScriptSDK/dist/index.js';

const schemaLibrary = new SchemaLibrary();
console.log('模板库已创建');
```

### 21. addSchema - 添加数据模板

**调用方法：**
```javascript
schemaLibrary.addSchema(name, schemaEntry);
```

**简单示例：**
```javascript
const schemaLibrary = new SchemaLibrary();

const success = schemaLibrary.addSchema('weapon', {
  name: 'weapon',
  description: '武器信息',
  jsonSchema: JSON.stringify({
    type: 'object',
    properties: {
      name: { type: 'string' },
      damage: { type: 'number' },
      type: { type: 'string', enum: ['剑', '弓', '法杖'] }
    },
    required: ['name', 'damage', 'type']
  })
});

console.log('模板添加结果:', success);
```

### 22. getSchema - 获取数据模板

**调用方法：**
```javascript
const schema = schemaLibrary.getSchema(name);
```

**简单示例：**
```javascript
const schemaLibrary = new SchemaLibrary();

// 先添加一个模板
schemaLibrary.addSchema('item', {
  name: 'item',
  description: '物品',
  jsonSchema: '{"type":"object","properties":{"name":{"type":"string"}}}'
});

// 获取模板
const schema = schemaLibrary.getSchema('item');

if (schema) {
  console.log('找到模板:', schema.name);
  console.log('描述:', schema.description);
} else {
  console.log('模板不存在');
}
```

### 23. getAllSchemaNames - 获取所有模板名称

**调用方法：**
```javascript
const names = schemaLibrary.getAllSchemaNames();
```

**简单示例：**
```javascript
const schemaLibrary = new SchemaLibrary();

// 添加一些模板
schemaLibrary.addSchema('character', { name: 'character', description: '角色', jsonSchema: '{}' });
schemaLibrary.addSchema('quest', { name: 'quest', description: '任务', jsonSchema: '{}' });

// 获取所有名称
const names = schemaLibrary.getAllSchemaNames();
console.log('所有模板:', names); // ['character', 'quest']
```

---

## 🔧 认证管理相关 API

### 24. authManager - 获取认证管理器

**调用方法：**
```javascript
const authManager = DeveloperWorksSDK.Instance.authManager;
```

**简单示例：**
```javascript
const authManager = DeveloperWorksSDK.Instance.authManager;
console.log('认证管理器已获取');
```

### 25. isReady - 检查系统是否就绪

**调用方法：**
```javascript
const isReady = authManager.isReady();
```

**简单示例：**
```javascript
const authManager = DeveloperWorksSDK.Instance.authManager;
const isReady = authManager.isReady();

console.log('系统是否就绪:', isReady);
```

### 26. isTokenValid - 检查令牌是否有效

**调用方法：**
```javascript
const isValid = authManager.isTokenValid();
```

**简单示例：**
```javascript
const authManager = DeveloperWorksSDK.Instance.authManager;
const isValid = authManager.isTokenValid();

if (isValid) {
  console.log('令牌有效，可以使用AI功能');
} else {
  console.log('令牌无效，需要重新认证');
}
```

### 27. isDeveloperToken - 检查是否使用开发者令牌

**调用方法：**
```javascript
const isDev = authManager.isDeveloperToken();
```

**简单示例：**
```javascript
const authManager = DeveloperWorksSDK.Instance.authManager;
const isDev = authManager.isDeveloperToken();

if (isDev) {
  console.log('当前使用开发者令牌（测试模式）');
} else {
  console.log('当前使用玩家令牌（生产模式）');
}
```

### 28. getAuthToken - 获取认证令牌

**调用方法：**
```javascript
const token = authManager.getAuthToken();
```

**简单示例：**
```javascript
const authManager = DeveloperWorksSDK.Instance.authManager;
const token = authManager.getAuthToken();

if (token) {
  console.log('当前令牌:', token.substring(0, 20) + '...');
} else {
  console.log('没有可用的令牌');
}
```

---

## 🎯 完整使用示例

### 最简单的完整流程

```javascript
import { DeveloperWorksSDK } from './DeveloperWorks-JavaScriptSDK/dist/index.js';

async function simpleExample() {
  // 1. 配置和初始化
  const config = {
    auth: {
      gameId: 'your-game-id',
      developerToken: 'your-developer-token' // 测试用
    },
    defaultChatModel: 'gpt-4.1-mini',
    defaultImageModel: 'Kolors',
    enableDebugLogs: true
  };

  await DeveloperWorksSDK.Instance.initializeAsync(config);

  // 2. AI聊天
  const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
  const chatResult = await chatClient.textGenerationAsync('你好！');
  console.log('AI说:', chatResult.data);

  // 3. 图像生成
  const imageClient = DeveloperWorksSDK.Factory.CreateImageClient();
  const imageResult = await imageClient.generateImageAsync({
    prompt: '一只可爱的小猫',
    size: '512x512'
  });
  console.log('图片URL:', imageResult.data[0].url);

  // 4. NPC对话
  const npc = DeveloperWorksSDK.Populate.NPCClient(
    chatClient,
    '你是友好的村民。'
  );
  const npcResult = await npc.talk('你好，村民！');
  console.log('村民说:', npcResult.data);

  // 5. 玩家信息
  const playerClient = DeveloperWorksSDK.Factory.CreatePlayerClient();
  if (playerClient.hasValidPlayerToken()) {
    const playerInfo = await playerClient.getPlayerInfoAsync();
    console.log('玩家信息:', playerInfo.data);
  }
}

simpleExample().catch(console.error);
```

---

## 📝 API 调用要点

### ✅ 成功调用的关键

1. **先初始化**：所有API调用前必须先调用 `initializeAsync()`
2. **检查结果**：所有异步API都返回 `{ success: boolean, data?: any, error?: string }` 格式
3. **错误处理**：始终检查 `result.success` 再使用 `result.data`
4. **令牌管理**：确保有有效的认证令牌

### ⚠️ 常见错误

```javascript
// ❌ 错误：未初始化就调用
const chatClient = DeveloperWorksSDK.Factory.CreateChatClient(); // 会报错

// ✅ 正确：先初始化
await DeveloperWorksSDK.Instance.initializeAsync(config);
const chatClient = DeveloperWorksSDK.Factory.CreateChatClient();

// ❌ 错误：不检查结果就使用
const result = await chatClient.textGenerationAsync('hello');
console.log(result.data); // 可能是 undefined

// ✅ 正确：检查结果
const result = await chatClient.textGenerationAsync('hello');
if (result.success) {
  console.log(result.data);
} else {
  console.log('错误:', result.error);
}
```

### 🔄 异步处理

所有AI相关的API都是异步的，记得使用 `await` 或 `.then()`：

```javascript
// ✅ 使用 await
const result = await chatClient.textGenerationAsync('hello');

// ✅ 使用 Promise
chatClient.textGenerationAsync('hello').then(result => {
  if (result.success) {
    console.log(result.data);
  }
});
```

---

## 🎉 总结

这份API指南涵盖了DeveloperWorks SDK的所有主要API调用方法。每个API都提供了：

- 📋 **清晰的调用语法**
- 💡 **简单实用的示例**  
- ⚠️ **常见错误提醒**

使用这份指南，你可以快速找到任何API的使用方法，复制示例代码即可开始使用！

**记住三个要点**：
1. 先初始化SDK
2. 检查API返回结果
3. 正确处理异步调用

祝你开发顺利！🚀✨

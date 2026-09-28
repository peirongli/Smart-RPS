// 导入 DeveloperWorks SDK
import { DeveloperWorksSDK } from './dist/index.js';
// 导入配置文件
import config from './config.js';

// 游戏状态管理
class RockPaperScissorsGame {
    constructor() {
        this.sdk = null;
        this.chatClient = null;
        this.npcAgent = null;
        this.gameState = {
            round: 1,
            playerScore: 0,
            aiScore: 0,
            playerName: '玩家',
            currentPhase: 'declare', // declare, waiting, action, result
            playerDeclared: null,
            playerActual: null,
            aiDeclared: null,
            aiActual: null,
            history: []
        };

        // AI Agent 的提示词
        this.aiPrompt = `# AI 猜拳博弈 Agent 提示词

## 一、角色定位
你是一个具备**心理博弈思维**的猜拳游戏 Agent，核心目标是在"先宣告、后出拳"的特殊规则下，通过分析玩家言行规律、灵活调整自身策略，与玩家形成有趣的博弈互动。

## 二、游戏规则共识
1. 每轮猜拳流程：**玩家先宣告→你回应并宣告→双方各自选择实际出拳→同步揭晓结果**
2. "宣告出拳"与"实际出拳"可一致（诚实策略），也可不一致（欺诈策略）
3. **新增选项**：玩家和你都可以选择"不告诉你"，表示保密自己的计划
4. 输赢判定仅以"双方实际出拳"为准（石头克剪刀、剪刀克布、布克石头）

## 三、回应格式要求（必须严格遵守）
你的每次回应必须包含两个部分：

**第一部分（宣告回应）**：
- 回应玩家的宣告
- 明确说出你的宣告（石头/布/剪刀/不告诉你）

**第二部分（实际出拳）**：
- **必须**以"我实际出："开头，后面跟石头/布/剪刀中的一个
- 这是你真正的选择，系统会提取这个信息

**格式示例**：
- "好的，你说要出石头～那我这轮宣告出布。我实际出：剪刀"
- "哈哈，你选择保密呀～那我也不告诉你我的计划。我实际出：石头"
- "你说要出剪刀～我这次宣告出石头来应对。我实际出：布"

**重要提醒**：
1. 每次回应都必须包含"我实际出："这个短语
2. "我实际出："后面只能是"石头"、"布"或"剪刀"中的一个
3. 不要在"我实际出："前面透露你的真实选择

## 四、策略逻辑
### 宣告策略：
- 可以诚实宣告，也可以故意误导
- 可以选择"不告诉你"增加神秘感和不确定性
- 观察玩家的诚实度模式进行反制

### 实际出拳策略：
- 分析玩家的宣告-实际偏差规律
- 考虑玩家的历史出拳频率
- 保持70%策略性 + 30%随机性

## 五、语气要求
- 友好轻松，带点博弈的小调皮
- 避免过于技术性的表述
- 营造朋友间游戏的氛围

**再次强调**：每次回应必须包含"我实际出：[石头/布/剪刀]"，这是系统识别的关键！`;

        this.initializeEventListeners();
    }

    // 初始化事件监听器
    initializeEventListeners() {
        // 开始游戏按钮
        document.getElementById('start-game').addEventListener('click', () => {
            this.initializeGame();
        });

        // 宣告阶段选择
        document.querySelectorAll('#declare-phase .choice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleDeclareChoice(e.currentTarget.dataset.choice);
            });
        });

        // 实际出拳阶段选择
        document.querySelectorAll('#action-phase .choice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleActionChoice(e.currentTarget.dataset.choice);
            });
        });

        // 下一轮按钮
        document.getElementById('next-round').addEventListener('click', () => {
            this.startNextRound();
        });

        // 历史记录切换
        document.getElementById('toggle-history').addEventListener('click', () => {
            this.toggleHistory();
        });

        // 关闭错误模态框
        document.getElementById('close-error').addEventListener('click', () => {
            this.hideError();
        });

        // 显示帮助
        document.getElementById('show-help').addEventListener('click', () => {
            this.showHelp();
        });

        // 关闭帮助模态框
        document.getElementById('close-help').addEventListener('click', () => {
            this.hideHelp();
        });

        // 关闭表情包弹出
        document.getElementById('close-meme').addEventListener('click', () => {
            this.hideMemePopup();
        });

        // 点击遮罩层关闭表情包
        document.getElementById('meme-overlay').addEventListener('click', () => {
            this.hideMemePopup();
        });
    }

    // 初始化游戏
    async initializeGame() {
        // 直接使用config.js中的配置
        const gameId = config.auth.gameId;
        const developerToken = config.auth.developerToken;
        const playerName = document.getElementById('playerName').value.trim() || '玩家';

        if (!gameId) {
            this.showError('请在config.js中配置gameId');
            return;
        }

        if (!playerName.trim()) {
            this.showError('请输入玩家昵称');
            // 聚焦到昵称输入框
            document.getElementById('playerName').focus();
            return;
        }

        this.showStatus('正在初始化游戏...', 'loading');

        try {
            // 使用合并后的配置
            const sdkConfig = {
                auth: {
                    gameId: gameId,
                    ...(developerToken && { developerToken: developerToken })
                },
                network: config.network,
                defaultChatModel: config.defaultChatModel,
                enableDebugLogs: config.enableDebugLogs
            };

            // 初始化SDK
            await DeveloperWorksSDK.Instance.initializeAsync(sdkConfig);
            this.showStatus('SDK初始化成功...', 'loading');

            // 创建聊天客户端
            this.chatClient = DeveloperWorksSDK.Factory.CreateChatClient();
            this.showStatus('创建AI对手...', 'loading');

            // 创建NPC Agent
            this.npcAgent = DeveloperWorksSDK.Populate.NPCClient(
                this.chatClient,
                this.aiPrompt
            );

            // 设置玩家名称
            this.gameState.playerName = playerName;
            document.getElementById('player-name-display').textContent = playerName;

            this.showStatus('游戏初始化完成！', 'success');

            // 延迟切换到游戏界面
            setTimeout(() => {
                this.switchToGameScreen();
            }, 1000);

        } catch (error) {
            console.error('游戏初始化失败:', error);
            this.showStatus(`初始化失败: ${error.message}`, 'error');
        }
    }

    // 切换到游戏界面
    switchToGameScreen() {
        document.getElementById('init-screen').classList.remove('active');
        document.getElementById('game-screen').classList.add('active');
        this.updateGameDisplay();
    }

    // 显示状态消息
    showStatus(message, type) {
        const statusEl = document.getElementById('init-status');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
    }

    // 显示错误
    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-modal').classList.add('active');
    }

    // 隐藏错误
    hideError() {
        document.getElementById('error-modal').classList.remove('active');
    }

    // 显示帮助
    showHelp() {
        document.getElementById('help-modal').classList.add('active');
    }

    // 隐藏帮助
    hideHelp() {
        document.getElementById('help-modal').classList.remove('active');
    }

    // 显示表情包弹出
    showMemePopup(imagePath, text) {
        const overlay = document.getElementById('meme-overlay');
        const popup = document.getElementById('meme-popup');
        const image = document.getElementById('meme-image');
        const textEl = document.getElementById('meme-text');

        // 预加载图片
        const img = new Image();
        img.onload = () => {
            image.src = imagePath;
            textEl.textContent = text;

            overlay.classList.add('show');
            popup.classList.add('show');

            // 添加一个小的震动效果
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
        };
        img.src = imagePath;
    }

    // 隐藏表情包弹出
    hideMemePopup() {
        const overlay = document.getElementById('meme-overlay');
        const popup = document.getElementById('meme-popup');

        overlay.classList.remove('show');
        popup.classList.remove('show');
    }

    // 检查并显示表情包
    checkAndShowMeme(result) {
        // 只有AI获胜时才显示表情包
        if (result !== 'lose') {
            return;
        }

        const aiDeclared = this.gameState.aiDeclared;
        const aiActual = this.gameState.aiActual;

        // 检查AI是否有宣告（不是保密）
        if (aiDeclared === 'secret' || aiDeclared === null) {
            return; // 如果AI选择保密或没有宣告，则不显示表情包
        }

        // 延迟显示表情包，让玩家先看到结果
        setTimeout(() => {
            if (aiDeclared === aiActual) {
                // AI宣告和实际出的一样且赢了
                this.showMemePopup('images/你看.jpg', '你看, 说实话你都不信');
                console.log('AI诚实获胜，显示"你看"表情包');
            } else {
                // AI宣告和实际出的不同且赢了
                this.showMemePopup('images/逗你.jpg', '逗逗你的啊');
                console.log('AI欺骗获胜，显示"逗你"表情包');
            }
        }, 2000); // 2秒后显示表情包
    }

    // 更新游戏显示
    updateGameDisplay() {
        document.getElementById('round-info').textContent = `第 ${this.gameState.round} 轮`;
        document.getElementById('player-score').textContent = this.gameState.playerScore;
        document.getElementById('ai-score').textContent = this.gameState.aiScore;

        // 更新阶段显示
        this.updatePhaseDisplay();
    }

    // 更新阶段显示
    updatePhaseDisplay() {
        // 隐藏所有阶段
        document.querySelectorAll('.action-phase').forEach(phase => {
            phase.classList.remove('active');
        });

        // 显示当前阶段
        switch (this.gameState.currentPhase) {
            case 'declare':
                document.getElementById('declare-phase').classList.add('active');
                document.getElementById('game-phase').textContent = '等待你的宣告...';
                break;
            case 'waiting':
                document.getElementById('waiting-ai').classList.add('active');
                document.getElementById('game-phase').textContent = 'AI正在思考策略...';
                break;
            case 'action':
                document.getElementById('action-phase').classList.add('active');
                document.getElementById('game-phase').textContent = '选择你的实际出拳！';
                break;
            case 'revealing':
                document.getElementById('waiting-ai').classList.add('active');
                document.getElementById('game-phase').textContent = '同步出拳中...';
                break;
            case 'result':
                document.getElementById('result-phase').classList.add('active');
                document.getElementById('game-phase').textContent = '本轮结果';
                break;
        }
    }

    // 处理宣告选择
    async handleDeclareChoice(choice) {
        this.gameState.playerDeclared = choice;
        this.gameState.currentPhase = 'waiting';
        this.updatePhaseDisplay();

        // 添加玩家消息到聊天
        this.addChatMessage('player', `我宣告要出：${this.getChoiceText(choice)}`);

        try {
            // 构建上下文消息
            const contextMessage = this.buildContextMessage(choice);

            // 获取AI回应
            const response = await this.npcAgent.talk(contextMessage);

            if (response.success) {
                // 解析AI回应，只提取宣告部分，实际出拳暂存
                const aiResponse = this.parseAIResponse(response.data);

                this.gameState.aiDeclared = aiResponse.declared;
                // 暂存AI的实际出拳，不立即暴露
                this.gameState.aiActual = aiResponse.actual;

                // 只显示AI的宣告部分，隐藏实际出拳
                const declarationOnly = this.extractDeclarationOnly(response.data);
                this.addChatMessage('ai', declarationOnly);

                // 切换到实际出拳阶段
                this.gameState.currentPhase = 'action';
                this.updatePhaseDisplay();

            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error('AI回应失败:', error);

            // 提供更友好的错误信息
            let errorMessage = 'AI回应失败';
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                errorMessage = '认证失败，请检查游戏ID和开发者令牌是否正确';
            } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
                errorMessage = '权限不足，请检查API配额或联系管理员';
            } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                errorMessage = '请求过于频繁，请稍后再试';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = '网络连接失败，请检查网络连接';
            } else {
                errorMessage = `AI回应失败: ${error.message}`;
            }

            this.showError(errorMessage);

            // 回到宣告阶段
            this.gameState.currentPhase = 'declare';
            this.updatePhaseDisplay();
        }
    }

    // 构建上下文消息
    buildContextMessage(playerDeclared) {
        let context = `当前是第${this.gameState.round}轮。`;

        // 添加历史信息
        if (this.gameState.history.length > 0) {
            context += `\n\n历史记录：`;
            this.gameState.history.slice(-3).forEach((record, index) => {
                context += `\n第${record.round}轮: 玩家宣告${this.getChoiceText(record.playerDeclared)}，实际出${this.getChoiceText(record.playerActual)}；AI宣告${this.getChoiceText(record.aiDeclared)}，实际出${this.getChoiceText(record.aiActual)}，结果：${record.result}`;
            });
        }

        context += `\n\n玩家刚刚宣告要出：${this.getChoiceText(playerDeclared)}`;
        context += `\n\n请按照以下格式回应：`;
        context += `\n1. 先回应玩家的宣告并说出你的宣告`;
        context += `\n2. 然后必须以"我实际出："开头说出你的真实选择`;
        context += `\n\n示例格式："好的，你说要出石头～那我这轮宣告出布。我实际出：剪刀"`;
        context += `\n\n重要：必须包含"我实际出："这个短语，后面只能跟"石头"、"布"或"剪刀"！`;

        return context;
    }

    // 解析AI回应
    parseAIResponse(response) {
        console.log('AI原始回应:', response);

        // 首先提取实际出拳（这是最重要的）
        let actual = null;
        
        // 优先匹配"我实际出："格式
        const actualMatch = response.match(/我实际出[：:]\s*(石头|布|剪刀)/);
        if (actualMatch) {
            actual = this.getChoiceKey(actualMatch[1]);
            console.log('匹配到实际出拳:', actualMatch[1], '->', actual);
        } else {
            // 备用匹配方式
            actual = this.extractChoice(response, ['实际出', '真正出', '最终出', '我出']);
            console.log('备用匹配实际出拳:', actual);
        }

        // 然后提取宣告
        let declared = null;
        if (response.includes('不告诉你') || response.includes('不说') || response.includes('保密') || response.includes('神秘')) {
            declared = 'secret';
            console.log('AI选择了保密策略');
        } else {
            // 提取宣告选择，避免与实际出拳混淆
            const declareKeywords = ['宣告出', '倾向出', '打算出', '可能出', '想出', '选择出'];
            declared = this.extractChoice(response, declareKeywords);
            
            // 如果没有明确的宣告关键词，尝试从"我实际出："之前的内容提取
            if (!declared) {
                const beforeActual = response.split(/我实际出[：:]/)[0];
                declared = this.extractChoiceFromText(beforeActual);
            }
        }

        console.log('解析结果 - 宣告:', declared, '实际:', actual);

        // 确保有有效的选择，如果解析失败则使用随机选择
        return {
            declared: declared || this.getRandomDeclareChoice(),
            actual: actual || this.getRandomChoice()
        };
    }

    // 从文本中直接提取选择（不依赖关键词）
    extractChoiceFromText(text) {
        const choices = ['石头', '剪刀', '布'];
        
        // 按顺序查找，返回最后出现的选择（通常是最终决定）
        let lastChoice = null;
        for (const choice of choices) {
            if (text.includes(choice)) {
                lastChoice = this.getChoiceKey(choice);
            }
        }
        
        return lastChoice;
    }

    // 提取AI回应中的宣告部分，隐藏实际出拳
    extractDeclarationOnly(response) {
        // 查找"实际出"相关的位置，截取之前的内容
        const actualKeywords = ['实际出', '真正出', '最终出', '我出'];
        let cutoffIndex = response.length;

        for (const keyword of actualKeywords) {
            const index = response.indexOf(keyword);
            if (index !== -1 && index < cutoffIndex) {
                cutoffIndex = index;
            }
        }

        // 截取宣告部分，并添加悬念
        let declarationPart = response.substring(0, cutoffIndex).trim();

        // 如果截取后内容太短，使用原始回应但移除实际出拳信息
        if (declarationPart.length < 10) {
            declarationPart = response;
            for (const keyword of actualKeywords) {
                const regex = new RegExp(`${keyword}[：:]?\\s*[石头布剪刀]+`, 'g');
                declarationPart = declarationPart.replace(regex, '');
            }
        }

        // 确保以适当的语句结尾
        if (!declarationPart.endsWith('。') && !declarationPart.endsWith('～') && !declarationPart.endsWith('！')) {
            declarationPart += '。';
        }

        // 检查AI是否选择了保密策略
        const isSecret = this.gameState.aiDeclared === 'secret';
        
        if (isSecret) {
            // 如果AI选择保密，不添加"现在我们同时出拳吧"，保持神秘感
            return declarationPart;
        } else {
            // 添加悬念提示
            declarationPart += ' 现在我们同时出拳吧！';
            return declarationPart;
        }
    }

    // 从文本中提取选择
    extractChoice(text, keywords) {
        const choices = ['石头', '剪刀', '布'];

        for (const keyword of keywords) {
            // 检查保密选项
            if (text.includes(keyword + '不告诉你') || text.includes(keyword + '保密')) {
                console.log(`匹配到保密模式: "${keyword}"`);
                return 'secret';
            }

            for (const choice of choices) {
                // 检查多种可能的格式
                const patterns = [
                    keyword + choice,
                    keyword + '：' + choice,
                    keyword + ': ' + choice,
                    keyword + ' ' + choice
                ];

                for (const pattern of patterns) {
                    if (text.includes(pattern)) {
                        console.log(`匹配到模式: "${pattern}"`);
                        return this.getChoiceKey(choice);
                    }
                }
            }
        }

        // 如果没有找到关键词，尝试直接查找选择
        for (const choice of choices) {
            if (text.includes(choice)) {
                console.log(`直接匹配到选择: "${choice}"`);
                return this.getChoiceKey(choice);
            }
        }

        return null;
    }

    // 获取随机选择
    getRandomChoice() {
        const choices = ['rock', 'paper', 'scissors'];
        return choices[Math.floor(Math.random() * choices.length)];
    }

    // 获取随机宣告选择（包括保密选项）
    getRandomDeclareChoice() {
        const choices = ['rock', 'paper', 'scissors', 'secret'];
        return choices[Math.floor(Math.random() * choices.length)];
    }

    // 处理实际出拳选择
    handleActionChoice(choice) {
        this.gameState.playerActual = choice;

        // 添加同步出拳的动画效果
        this.showSynchronizedReveal(choice);
    }

    // 显示同步出拳动画
    showSynchronizedReveal(playerChoice) {
        this.gameState.currentPhase = 'revealing';
        this.updatePhaseDisplay();

        // 添加倒计时消息
        this.addChatMessage('ai', '3... 2... 1... 出拳！');

        // 延迟显示结果，营造同步感
        setTimeout(() => {
            // 现在同时展示双方的实际出拳
            this.gameState.currentPhase = 'result';

            // 计算结果
            const result = this.calculateResult(playerChoice, this.gameState.aiActual);

            // 更新分数
            if (result === 'win') {
                this.gameState.playerScore++;
            } else if (result === 'lose') {
                this.gameState.aiScore++;
            }

            // 记录历史
            this.gameState.history.push({
                round: this.gameState.round,
                playerDeclared: this.gameState.playerDeclared,
                playerActual: this.gameState.playerActual,
                aiDeclared: this.gameState.aiDeclared,
                aiActual: this.gameState.aiActual,
                result: result
            });

            // 添加结果揭晓消息
            const resultMessage = this.buildResultMessage(result);
            this.addChatMessage('ai', resultMessage);

            // 显示结果
            this.showResult(result);
            this.updatePhaseDisplay();
            this.updateGameDisplay();

            // 检查是否需要显示表情包（AI获胜时）
            this.checkAndShowMeme(result);

        }, 1500); // 1.5秒延迟，营造悬念
    }

    // 构建结果揭晓消息
    buildResultMessage(result) {
        const playerActualText = this.getChoiceText(this.gameState.playerActual);
        const aiActualText = this.getChoiceText(this.gameState.aiActual);
        const playerDeclaredText = this.getChoiceText(this.gameState.playerDeclared);
        const aiDeclaredText = this.getChoiceText(this.gameState.aiDeclared);

        let message = `揭晓结果！\n`;
        message += `你：宣告${playerDeclaredText}，实际出${playerActualText}\n`;
        message += `我：宣告${aiDeclaredText}，实际出${aiActualText}\n\n`;

        // 分析诚实度和保密策略
        const playerSecret = this.gameState.playerDeclared === 'secret';
        const aiSecret = this.gameState.aiDeclared === 'secret';
        const playerHonest = !playerSecret && this.gameState.playerDeclared === this.gameState.playerActual;
        const aiHonest = !aiSecret && this.gameState.aiDeclared === this.gameState.aiActual;

        if (playerSecret && aiSecret) {
            message += `哈哈，我们都选择了保密策略，真是心有灵犀！`;
        } else if (playerSecret) {
            message += `你选择了保密策略，很神秘呢！`;
        } else if (aiSecret) {
            message += `我这次选择保密，给你一个小惊喜～`;
        } else if (playerHonest && aiHonest) {
            message += `哈哈，我们都很诚实呢！`;
        } else if (!playerHonest && !aiHonest) {
            message += `哇，我们都在玩心理战术！`;
        } else if (!playerHonest) {
            message += `你这次选择了欺骗策略，有意思！`;
        } else {
            message += `我这次故意骗了你，嘿嘿～`;
        }

        message += `\n\n`;

        // 结果判定
        switch (result) {
            case 'win':
                message += `${aiActualText}被${playerActualText}克制，你赢了这一轮！🎉`;
                break;
            case 'lose':
                message += `${playerActualText}被${aiActualText}克制，我赢了这一轮！😄`;
                break;
            case 'draw':
                message += `都是${playerActualText}，平局！再来一轮吧～`;
                break;
        }

        return message;
    }

    // 计算游戏结果
    calculateResult(playerChoice, aiChoice) {
        if (playerChoice === aiChoice) {
            return 'draw';
        }

        const winConditions = {
            'rock': 'scissors',
            'paper': 'rock',
            'scissors': 'paper'
        };

        return winConditions[playerChoice] === aiChoice ? 'win' : 'lose';
    }

    // 显示结果
    showResult(result) {
        // 更新选择显示
        document.getElementById('player-declared').textContent = this.getChoiceText(this.gameState.playerDeclared);
        document.getElementById('player-actual').textContent = this.getChoiceText(this.gameState.playerActual);
        document.getElementById('ai-declared').textContent = this.getChoiceText(this.gameState.aiDeclared);
        document.getElementById('ai-actual').textContent = this.getChoiceText(this.gameState.aiActual);

        // 更新图片
        document.getElementById('player-choice-img').src = this.getChoiceImage(this.gameState.playerActual);
        document.getElementById('ai-choice-img').src = this.getChoiceImage(this.gameState.aiActual);

        // 更新结果文本
        const resultEl = document.getElementById('result-text');
        resultEl.className = `result-text ${result}`;

        switch (result) {
            case 'win':
                resultEl.textContent = '你赢了！';
                break;
            case 'lose':
                resultEl.textContent = 'AI赢了！';
                break;
            case 'draw':
                resultEl.textContent = '平局！';
                break;
        }
    }

    // 开始下一轮
    startNextRound() {
        this.gameState.round++;
        this.gameState.currentPhase = 'declare';

        // 重置选择
        this.gameState.playerDeclared = null;
        this.gameState.playerActual = null;
        this.gameState.aiDeclared = null;
        this.gameState.aiActual = null;

        // 更新历史显示
        this.updateHistoryDisplay();

        // 更新游戏显示
        this.updateGameDisplay();

        // 添加AI引导消息
        this.addChatMessage('ai', `下一轮该你先宣告咯，这次想先说要出什么呀？`);
    }

    // 添加聊天消息
    addChatMessage(sender, message) {
        const chatMessages = document.getElementById('chat-messages');
        const chatArea = document.querySelector('.chat-area'); // 获取实际的滚动容器
        const messageEl = document.createElement('div');
        messageEl.className = `message ${sender}-message`;

        const avatar = sender === 'player' ? '🧑' : '🤖';

        messageEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-text">${message.replace(/\n/g, '<br>')}</div>
            </div>
        `;

        chatMessages.appendChild(messageEl);

        // 添加新消息动画效果
        messageEl.style.opacity = '0';
        messageEl.style.transform = 'translateY(20px)';

        // 确保新消息添加后自动滚动到底部
        // 使用 setTimeout 确保 DOM 更新完成后再滚动和显示动画
        setTimeout(() => {
            // 在正确的滚动容器上进行滚动操作
            chatArea.scrollTo({
                top: chatArea.scrollHeight,
                behavior: 'smooth'
            });

            // 显示新消息动画
            messageEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            messageEl.style.opacity = '1';
            messageEl.style.transform = 'translateY(0)';
        }, 10);
    }

    // 切换历史记录显示
    toggleHistory() {
        const historyPanel = document.getElementById('history-panel');
        historyPanel.classList.toggle('active');

        if (historyPanel.classList.contains('active')) {
            this.updateHistoryDisplay();
        }
    }

    // 更新历史记录显示
    updateHistoryDisplay() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';

        this.gameState.history.forEach(record => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';

            const resultText = record.result === 'win' ? '你赢' :
                record.result === 'lose' ? 'AI赢' : '平局';

            historyItem.innerHTML = `
                <div class="round">第${record.round}轮 - ${resultText}</div>
                <div class="details">
                    你：宣告${this.getChoiceText(record.playerDeclared)} → 实际${this.getChoiceText(record.playerActual)}<br>
                    AI：宣告${this.getChoiceText(record.aiDeclared)} → 实际${this.getChoiceText(record.aiActual)}
                </div>
            `;

            historyList.appendChild(historyItem);
        });
    }

    // 获取选择对应的中文文本
    getChoiceText(choice) {
        const texts = {
            'rock': '石头',
            'paper': '布',
            'scissors': '剪刀',
            'secret': '不告诉你'
        };
        return texts[choice] || choice;
    }

    // 获取选择对应的图片路径
    getChoiceImage(choice) {
        const images = {
            'rock': 'images/rock.png',
            'paper': 'images/paper.png',
            'scissors': 'images/scissors.png'
        };
        return images[choice] || '';
    }

    // 获取中文对应的选择键
    getChoiceKey(chineseText) {
        const keys = {
            '石头': 'rock',
            '布': 'paper',
            '剪刀': 'scissors',
            '不告诉你': 'secret'
        };
        return keys[chineseText] || null;
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    new RockPaperScissorsGame();
});
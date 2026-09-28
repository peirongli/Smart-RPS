// game.js — 状态机、规则与持久化
// 一轮的时序（防作弊关键设计，勿改动顺序）：
//   玩家宣告 → AI 回应并锁定实际出拳（一次模型调用）→ 玩家实际出拳 → 同步揭晓
// AI 的实际出拳在玩家出拳前就已确定，结构上不存在 AI 偷看的可能。

import { getAiMove, loadSettings, saveSettings, PROVIDERS } from './ai.js';
import * as ui from './ui.js';

const SAVE_KEY = 'rps-game';
const MAX_HISTORY = 200;

function blankState() {
    return {
        round: 1,
        playerScore: 0,
        aiScore: 0,
        playerName: '玩家',
        currentPhase: 'declare',
        playerDeclared: null,
        playerActual: null,
        aiDeclared: null,
        aiActual: null,
        history: [],
    };
}

class RockPaperScissorsGame {
    constructor() {
        this.state = blankState();
        this.settings = {};
        ui.init({
            onStart: () => this.startGame(),
            onDeclare: (choice) => this.handleDeclare(choice),
            onAction: (choice) => this.handleAction(choice),
            onNextRound: () => this.startNextRound(),
            onReset: () => this.resetGame(),
        });
    }

    // ------------------------------------------------------------------
    // 持久化：刷新不丢比分与历史
    // ------------------------------------------------------------------

    loadSaved() {
        try {
            const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
            if (saved && Array.isArray(saved.history)) {
                this.state.round = (saved.round || saved.history.length + 1);
                this.state.playerScore = saved.playerScore || 0;
                this.state.aiScore = saved.aiScore || 0;
                this.state.playerName = saved.playerName || '玩家';
                this.state.history = saved.history.slice(-MAX_HISTORY);
            }
        } catch (e) { /* 存档损坏则全新开局 */ }
    }

    persist() {
        const { round, playerScore, aiScore, playerName, history } = this.state;
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify({ round, playerScore, aiScore, playerName, history: history.slice(-MAX_HISTORY) }));
        } catch (e) { /* 隐私模式等场景静默降级为会话内存档 */ }
    }

    // ------------------------------------------------------------------
    // 开始 / 重开
    // ------------------------------------------------------------------

    startGame() {
        const form = ui.readStartForm();
        if (!form.apiKey) {
            ui.showStartStatus('请填写 API key（保存在本浏览器，请求直连所选服务商）', 'error');
            return;
        }
        if (!form.model) {
            ui.showStartStatus('请填写模型名', 'error');
            return;
        }
        if (!form.baseUrl.startsWith('http')) {
            ui.showStartStatus('请填写有效的 base URL（自定义端点需含 /v1 前缀）', 'error');
            return;
        }

        this.settings = form;
        saveSettings(form);

        this.loadSaved();
        this.state.playerName = form.playerName;

        ui.setPlayerName(form.playerName);
        ui.switchToGame();
        ui.showPhase('declare');
        ui.updateScores(this.state);
        ui.renderHistory(this.state.history);

        if (this.state.history.length > 0) {
            ui.addChat('ai', `欢迎回来，${form.playerName}！当前比分 ${this.state.playerScore} : ${this.state.aiScore}，我们继续～`);
        } else {
            ui.addChat('ai', `嗨，${form.playerName}！我们来玩特殊猜拳吧～规则很简单：每轮先各自说要出什么（可以骗对方或选择保密），再亮实际出拳，按实际的算输赢～你先说说，这轮打算宣告出什么呀？`);
        }
    }

    resetGame() {
        this.state = blankState();
        this.state.playerName = this.settings.playerName || '玩家';
        this.persist();
        ui.clearChat();
        ui.addChat('ai', '新的开始！这轮你打算宣告出什么呀？');
        ui.showPhase('declare');
        ui.updateScores(this.state);
        ui.renderHistory([]);
    }

    // ------------------------------------------------------------------
    // 宣告阶段：AI 在此锁定实际出拳（先承诺后揭晓）
    // ------------------------------------------------------------------

    async handleDeclare(choice) {
        this.state.playerDeclared = choice;
        this.state.currentPhase = 'waiting';
        ui.showPhase('waiting');
        ui.addChat('player', `我宣告要出：${ui.choiceText(choice)}`);

        try {
            const move = await getAiMove(this.settings, this.buildContextMessage(choice));
            this.state.aiDeclared = move.declared;
            this.state.aiActual = move.actual; // 锁定，待玩家出拳后揭晓
            ui.addChat('ai', move.display);
            this.state.currentPhase = 'action';
            ui.showPhase('action');
        } catch (error) {
            console.error('AI 回应失败:', error);
            ui.showError(error.message + '\n\n本轮未消耗，请重新宣告。');
            this.backToDeclare();
        }
    }

    backToDeclare() {
        this.state.currentPhase = 'declare';
        this.state.playerDeclared = null;
        this.state.playerActual = null;
        this.state.aiDeclared = null;
        this.state.aiActual = null;
        ui.showPhase('declare');
    }

    buildContextMessage(playerDeclared) {
        let context = `当前是第${this.state.round}轮。`;
        if (this.state.history.length > 0) {
            context += `\n\n历史记录：`;
            this.state.history.slice(-3).forEach(record => {
                context += `\n第${record.round}轮: 玩家宣告${ui.choiceText(record.playerDeclared)}，实际出${ui.choiceText(record.playerActual)}；AI宣告${ui.choiceText(record.aiDeclared)}，实际出${ui.choiceText(record.aiActual)}，结果：${record.result}`;
            });
        }
        context += `\n\n玩家刚刚宣告要出：${ui.choiceText(playerDeclared)}`;
        context += `\n\n请按格式回应：1. 回应玩家的宣告并说出你的宣告；2. 结尾单独一行"我实际出：X"（X 只能是石头/布/剪刀）。`;
        return context;
    }

    // ------------------------------------------------------------------
    // 实际出拳与揭晓
    // ------------------------------------------------------------------

    handleAction(choice) {
        this.state.playerActual = choice;
        this.state.currentPhase = 'revealing';
        ui.showPhase('revealing');
        ui.addChat('ai', '3... 2... 1... 出拳！');

        setTimeout(() => {
            const result = this.calculateResult(this.state.playerActual, this.state.aiActual);
            if (result === 'win') this.state.playerScore++;
            else if (result === 'lose') this.state.aiScore++;

            this.state.history.push({
                round: this.state.round,
                playerDeclared: this.state.playerDeclared,
                playerActual: this.state.playerActual,
                aiDeclared: this.state.aiDeclared,
                aiActual: this.state.aiActual,
                result,
            });
            this.persist();

            this.state.currentPhase = 'result';
            ui.addChat('ai', this.buildResultMessage(result));
            ui.renderResult(this.state, result);
            ui.showPhase('result');
            ui.updateScores(this.state);
            ui.renderHistory(this.state.history);

            this.checkAndShowMeme(result);
        }, 1500);
    }

    calculateResult(playerChoice, aiChoice) {
        if (playerChoice === aiChoice) return 'draw';
        const winConditions = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
        return winConditions[playerChoice] === aiChoice ? 'win' : 'lose';
    }

    buildResultMessage(result) {
        const s = this.state;
        let message = '揭晓结果！\n';
        message += `你：宣告${ui.choiceText(s.playerDeclared)}，实际出${ui.choiceText(s.playerActual)}\n`;
        message += `我：宣告${ui.choiceText(s.aiDeclared)}，实际出${ui.choiceText(s.aiActual)}\n\n`;

        const playerSecret = s.playerDeclared === 'secret';
        const aiSecret = s.aiDeclared === 'secret';
        const playerHonest = !playerSecret && s.playerDeclared === s.playerActual;
        const aiHonest = !aiSecret && s.aiDeclared === s.aiActual;

        if (playerSecret && aiSecret) message += '哈哈，我们都选择了保密策略，真是心有灵犀！';
        else if (playerSecret) message += '你选择了保密策略，很神秘呢！';
        else if (aiSecret) message += '我这次选择保密，给你一个小惊喜～';
        else if (playerHonest && aiHonest) message += '哈哈，我们都很诚实呢！';
        else if (!playerHonest && !aiHonest) message += '哇，我们都在玩心理战术！';
        else if (!playerHonest) message += '你这次选择了欺骗策略，有意思！';
        else message += '我这次故意骗了你，嘿嘿～';

        message += '\n\n';
        const aiText = ui.choiceText(s.aiActual);
        const playerText = ui.choiceText(s.playerActual);
        if (result === 'win') message += `${aiText}被${playerText}克制，你赢了这一轮！🎉`;
        else if (result === 'lose') message += `${playerText}被${aiText}克制，我赢了这一轮！😄`;
        else message += `都是${playerText}，平局！再来一轮吧～`;
        return message;
    }

    // 表情包彩蛋：只在 AI 获胜且 AI 明确宣告过时触发
    checkAndShowMeme(result) {
        if (result !== 'lose') return;
        const { aiDeclared, aiActual } = this.state;
        if (aiDeclared === 'secret' || aiDeclared === null) return;
        setTimeout(() => {
            if (aiDeclared === aiActual) {
                ui.showMemePopup('images/你看.jpg', '你看, 说实话你都不信');
            } else {
                ui.showMemePopup('images/逗你.jpg', '逗逗你的啊');
            }
        }, 2000);
    }

    // ------------------------------------------------------------------

    startNextRound() {
        this.state.round++;
        this.state.currentPhase = 'declare';
        this.state.playerDeclared = null;
        this.state.playerActual = null;
        this.state.aiDeclared = null;
        this.state.aiActual = null;
        this.persist();
        ui.showPhase('declare');
        ui.updateScores(this.state);
        ui.addChat('ai', '下一轮该你先宣告咯，这次想先说要出什么呀？');
    }
}

// 预填上次保存的设置
ui.fillStartForm(loadSettings());

document.addEventListener('DOMContentLoaded', () => {
    new RockPaperScissorsGame();
});

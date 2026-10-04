// game.js — 状态机、规则与持久化
// 一轮的时序（防作弊关键设计，勿改动顺序）：
//   玩家宣告 → AI 回应并锁定实际出拳（一次模型调用）→ 玩家实际出拳 → 同步揭晓
// AI 的实际出拳在玩家出拳前就已确定，结构上不存在 AI 偷看的可能。

import { getAiMove, loadSettings, saveSettings, PROVIDERS } from './ai.js';
import * as ui from './ui.js';

const SAVE_KEY = 'rps-game';
const MAX_HISTORY = 200;
// 注入 AI 上下文的最近轮数。10 轮约 300-400 token，
// 足够它看出趋势，又不至于让上下文喧宾夺主。
const CONTEXT_ROUNDS = 10;
// 条件模式统计的最小样本量：低于此值不报模式，避免"1 次里中 100%"的噪音结论
const MIN_PATTERN_SAMPLES = 3;
// 统计里要用到拳名，但显示文案以 ui.choiceText 为准（ui.js 是唯一来源）。
// 这里复制一份是因为统计模块不该反向依赖 UI 层。
const CHOICE_TEXT = { rock: '石头', paper: '布', scissors: '剪刀', secret: '不告诉你' };

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

// ---------------------------------------------------------------------------
// 战绩统计
// 从 history 里算出可直接喂给模型的结构化事实，避免靠自然语言描述统计。
// P2 的博弈画像也建立在这套统计之上。
// ---------------------------------------------------------------------------

function emptyTally() {
    return {
        total: 0,
        playerWins: 0,
        aiWins: 0,
        draws: 0,
        // 玩家实际出拳分布
        actual: { rock: 0, paper: 0, scissors: 0 },
        // 玩家宣告分布
        declared: { rock: 0, paper: 0, scissors: 0, secret: 0 },
        // 宣告 -> 实际 的条件计数：真正的"偏差规律"藏在这里
        byDeclared: {
            rock: { rock: 0, paper: 0, scissors: 0 },
            paper: { rock: 0, paper: 0, scissors: 0 },
            scissors: { rock: 0, paper: 0, scissors: 0 },
        },
        // AI 宣告 -> 玩家实际 的条件计数：玩家会不会跟着 AI 的宣告走？
        // 这个最有博弈价值——如果玩家总是被 AI 的宣告带跑，AI 就能反过来喂假信息
        byAiDeclared: {
            rock: { rock: 0, paper: 0, scissors: 0 },
            paper: { rock: 0, paper: 0, scissors: 0 },
            scissors: { rock: 0, paper: 0, scissors: 0 },
        },
        // AI 宣告 -> AI 实际：AI 自己的说谎习惯（AI 也要可被玩家读）
        byAiLie: {
            rock: { rock: 0, paper: 0, scissors: 0 },
            paper: { rock: 0, paper: 0, scissors: 0 },
            scissors: { rock: 0, paper: 0, scissors: 0 },
        },
    };
}

function bump(bucket, key) {
    if (bucket[key] !== undefined) bucket[key]++;
}

function tallyHistory(history) {
    const t = emptyTally();
    for (const r of history) {
        if (!r || typeof r !== 'object') continue;
        t.total++;
        if (r.result === 'win') t.playerWins++;
        else if (r.result === 'lose') t.aiWins++;
        else if (r.result === 'draw') t.draws++;

        bump(t.actual, r.playerActual);
        bump(t.declared, r.playerDeclared);

        // 玩家说谎 = 宣告了具体拳但实际不是它
        if (r.playerDeclared && r.playerDeclared !== 'secret') {
            bump(t.byDeclared[r.playerDeclared], r.playerActual);
        }
        if (r.aiDeclared && r.aiDeclared !== 'secret') {
            bump(t.byAiDeclared[r.aiDeclared], r.playerActual);
            bump(t.byAiLie[r.aiDeclared], r.aiActual);
        }
    }
    t.deceived = t.declared.rock + t.declared.paper + t.declared.scissors
        - (t.byDeclared.rock.rock + t.byDeclared.paper.paper + t.byDeclared.scissors.scissors);
    t.secrets = t.declared.secret;
    return t;
}

// 把条件计数转成一句话结论，只报样本量达标的模式
function describePatterns(t) {
    const out = [];

    // 1) 玩家的"宣告偏差"：宣告 X 时实际最常出 Y
    for (const dec of ['rock', 'paper', 'scissors']) {
        const row = t.byDeclared[dec];
        const n = row.rock + row.paper + row.scissors;
        if (n < MIN_PATTERN_SAMPLES) continue;
        const [top, count] = Object.entries(row).sort((a, b) => b[1] - a[1])[0];
        if (count / n >= 0.6 && top !== dec) {
            out.push(`你宣告${CHOICE_TEXT[dec]}时有 ${Math.round(count / n * 100)}% 实际出${CHOICE_TEXT[top]}`);
        }
    }

    // 2) 玩家是否跟着 AI 的宣告走：AI 宣告 X 时玩家最常出 Y
    for (const dec of ['rock', 'paper', 'scissors']) {
        const row = t.byAiDeclared[dec];
        const n = row.rock + row.paper + row.scissors;
        if (n < MIN_PATTERN_SAMPLES) continue;
        const [top, count] = Object.entries(row).sort((a, b) => b[1] - a[1])[0];
        if (count / n >= 0.6) {
            out.push(`我宣告${CHOICE_TEXT[dec]}时你 ${Math.round(count / n * 100)}% 会出${CHOICE_TEXT[top]}——这条我可以用`);
        }
    }

    // 3) AI 自己的说谎习惯：玩家也能反向读它
    let aiDeceived = 0, aiHonest = 0;
    for (const dec of ['rock', 'paper', 'scissors']) {
        aiHonest += t.byAiLie[dec][dec];
        for (const act of ['rock', 'paper', 'scissors']) {
            if (act !== dec) aiDeceived += t.byAiLie[dec][act];
        }
    }
    const aiTotal = aiHonest + aiDeceived;
    if (aiTotal >= MIN_PATTERN_SAMPLES) {
        if (aiDeceived / aiTotal >= 0.6) out.push('我自己的宣告也不可信，别只盯着我说了什么');
        else if (aiHonest / aiTotal >= 0.6) out.push('我最近基本说实话，代价是你现在知道这一点了');
    }

    return out;
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
                this.state.round = Math.max(saved.round || 0, saved.history.length + 1);
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
        const declaredMsg = ui.addChat('player', `我宣告要出：${ui.choiceText(choice)}`);

        try {
            const move = await getAiMove(this.settings, this.buildContextMessage(choice));
            this.state.aiDeclared = move.declared;
            this.state.aiActual = move.actual; // 锁定，待玩家出拳后揭晓
            ui.addChat('ai', move.display);
            this.state.currentPhase = 'action';
            ui.showPhase('action');
        } catch (error) {
            console.error('AI 回应失败:', error);
            // 宣告已写入聊天流却不会结算，标成作废，避免玩家误读为两次宣告
            ui.voidChat(declaredMsg);
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

        const recent = this.state.history.slice(-CONTEXT_ROUNDS);
        if (recent.length > 0) {
            // 战绩用结构化数字给出：比分、胜负、宣告与实际的偏差计数。
            // 比散文摘要更省 token，也让模型能真的算出一致率。
            const tally = tallyHistory(recent);
            context += `\n\n战绩：共 ${recent.length} 轮，你 ${tally.playerWins} 胜 ${tally.aiWins} 负 ${tally.draws} 平。`;
            context += `\n宣告诚实度：${recent.length - tally.deceived}/${recent.length} 轮宣告与实际一致，你撒过 ${tally.deceived} 次谎。`;
            context += `\n你的实际出拳分布：石头 ${tally.actual.rock} 次、布 ${tally.actual.paper} 次、剪刀 ${tally.actual.scissors} 次。`;
            context += `\n你选择保密 ${tally.secrets} 次。`;

            const patterns = describePatterns(tally);
            if (patterns.length > 0) context += `\n你的出拳习惯：${patterns.join('；')}。`;

            context += `\n\n最近 ${recent.length} 轮明细：`;
            recent.forEach(record => {
                context += `\n第${record.round}轮: 玩家宣告${ui.choiceText(record.playerDeclared)}，实际出${ui.choiceText(record.playerActual)}；AI宣告${ui.choiceText(record.aiDeclared)}，实际出${ui.choiceText(record.aiActual)}，结果：${record.result}`;
            });
        }
        context += `\n\n玩家刚刚宣告要出：${ui.choiceText(playerDeclared)}`;
        context += `\n\n请按格式回应：1. 回应玩家的宣告并说出你的宣告；2. 结尾单独一行"我实际出：X"（X 只能是石头/布/剪刀）。`;
        context += `\n注意：你给宣告之后，我才会决定自己实际出什么——所以你的宣告与实际出拳可以不一致，但反过来我猜不到你实际出什么。`;
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

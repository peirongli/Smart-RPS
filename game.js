// game.js — 状态机、规则与持久化
//
// 一轮的时序（防作弊关键设计，勿改动顺序）：
//   玩家宣告 → AI 回应并锁定宣告与实际出拳（一次模型调用）→ 玩家实际出拳 → 同步揭晓
// AI 的实际出拳在玩家出拳前就已确定，结构上不存在 AI 偷看的可能。
//
// 双盲承诺：AI 的宣告同样在那一次调用里锁定，但藏到揭晓才显示。
// 改显示时机是安全的，改调用时序不是——见 docs/redesign-plan.md。

import { getAiMove, loadSettings, saveSettings, DIFFICULTIES, DEFAULT_DIFFICULTY } from './ai.js';
import { tallyHistory, findPatterns, checkRandomized } from './profile.js';
import * as ui from './ui.js';

const SAVE_KEY = 'rps-game';
const MAX_HISTORY = 200;
// 注入 AI 上下文的最近轮数。10 轮约 300-400 token，
// 足够它看出趋势，又不至于让上下文喧宾夺主。
const CONTEXT_ROUNDS = 10;
// 统计画像用的历史窗口。与 CONTEXT_ROUNDS 分开是刻意的：
// 条件模式需要足够样本量才可靠（宣告只有 3 种，窗口太小会被稀释成噪声），
// 但把 30 轮明细全塞进上下文又太贵。
// 所以：统计在 30 轮上进行，只把结论注入给模型；明细仍只给最近 10 轮。
// 依据：10 轮窗口内某个宣告出现 >=5 次的概率高达 62.6%（模拟 20 万次），
// 也就是说小窗口必然产生大量误报——读心者把噪声当规律报出去，
// 玩家一试就发现是假的，可信度会崩，而可信度是这个人格唯一的武器。
const PROFILE_ROUNDS = 30;

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
        ui.renderProfile(this.state.history);

        const d = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];
        if (this.state.history.length > 0) {
            ui.addChat('ai', `欢迎回来，${form.playerName}！当前比分 ${this.state.playerScore} : ${this.state.aiScore}，我们继续～`);
        } else {
            ui.addChat('ai',
                `嗨，${form.playerName}！我是这局的对手「${d.label}」——${d.blurb}。\n\n` +
                '规则很简单，但有个关键点别搞错：\n' +
                '1. 你先宣告要出什么（可以撒谎，也可以保密）\n' +
                '2. 我会回应并宣告——但我的宣告会被锁住，你看不到\n' +
                '3. 然后你才决定自己真正出什么\n' +
                '4. 同时揭晓，按实际出拳算输赢\n\n' +
                '也就是说：我说什么你听不见，你说什么我能听见。咱们都在赌对方是诚实还是在骗人。\n' +
                '这轮你先说，打算宣告出什么呀？');
        }
    }

    resetGame() {
        this.state = blankState();
        this.state.playerName = (this.settings && this.settings.playerName) || '玩家';
        this.persist();
        ui.clearChat();
        ui.addChat('ai', '新的开始！这轮你打算宣告出什么呀？');
        ui.showPhase('declare');
        ui.updateScores(this.state);
        ui.renderHistory([]);
        ui.renderProfile([]);
        ui.renderAiHiddenNotice(false);
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
            // 把 30 轮统计窗口的画像交给 ai.js：AI 靠它预判玩家的实际出拳
            // （修法 B）。不给的话 AI 只能盲猜，难度会塌。
            const tally = tallyHistory(this.state.history.slice(-PROFILE_ROUNDS));
            const move = await getAiMove(
                this.settings,
                this.buildContextMessage(choice),
                this.settings.difficulty,
                choice,
                tally
            );

            // 双盲承诺：aiDeclared / aiActual 在此锁定（防作弊时序不变），
            // 但宣告一个字都不给玩家看——玩家在出实际拳之前不知道它。
            // 只有 taunt 是立刻可见的。
            this.state.aiDeclared = move.declared;
            this.state.aiActual = move.actual;

            ui.addChat('ai', move.taunt);
            this.state.currentPhase = 'action';
            ui.showPhase('action');
            ui.renderAiHiddenNotice(true);
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
        ui.renderAiHiddenNotice(false);
        ui.showPhase('declare');
    }

    // ------------------------------------------------------------------
    // 上下文构造：难度在这里生效
    //
    // 这是四个难度杠杆里最硬的一个——不是靠提示词说"你是高手"，
    // 而是实打实地决定给模型看多少。新手机只拿到最近几轮结果，
    // 读心者才拿到条件模式结论。
    // ------------------------------------------------------------------

    buildContextMessage(playerDeclared) {
        const d = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];
        const recent = this.state.history.slice(-CONTEXT_ROUNDS);
        // 统计窗口比明细窗口大：结论要可靠，明细要省 token。理由见 PROFILE_ROUNDS。
        const profileWindow = this.state.history.slice(-PROFILE_ROUNDS);
        const tally = tallyHistory(profileWindow);

        let context = `当前是第${this.state.round}轮。`;

        if (recent.length > 0) {
            // 战绩：所有难度都给，这是它能"记着你"的基础
            context += `\n\n战绩：共 ${profileWindow.length} 轮，你 ${tally.playerWins} 胜 ${tally.aiWins} 负 ${tally.draws} 平。`;

            if (d.insight === 'none') {
                // 新手机：只给原始明细，不给任何统计结论。
                // 它"看得到"但"算不出"——这正是低难度该有的状态。
                context += `\n\n最近 ${recent.length} 轮明细：`;
                recent.forEach(record => {
                    context += `\n第${record.round}轮: 你宣告${ui.choiceText(record.playerDeclared)}，实际出${ui.choiceText(record.playerActual)}；我宣告${ui.choiceText(record.aiDeclared)}，实际出${ui.choiceText(record.aiActual)}，结果：${record.result}`;
                });
            } else {
                // 熟客 / 读心者：给结构化统计
                context += `\n宣告诚实度：${profileWindow.length - tally.deceived}/${profileWindow.length} 轮宣告与实际一致，你撒过 ${tally.deceived} 次谎。`;
                context += `\n你的实际出拳分布：石头 ${tally.actual.rock} 次、布 ${tally.actual.paper} 次、剪刀 ${tally.actual.scissors} 次。`;
                context += `\n你选择保密 ${tally.secrets} 次。`;

                if (d.insight === 'deep') {
                    // 只有读心者拿到条件模式——"宣告石头时 80% 出布"这种
                    const patterns = findPatterns(tally);
                    const randomized = checkRandomized(tally);

                    if (randomized) {
                        // 玩家掺了随机：如实告诉 AI 它失效了，
                        // 并要求它承认——否则它会假装看穿，实际在瞎猜。
                        context += `\n\n【重要】你最近的出拳分布已经很均匀（最高占比仅 ${Math.round(randomized.maxShare * 100)}%），`;
                        context += `你的规律分析对你已经失效了。请在 taunt 里承认你跟不上了，别装作看穿了。`;
                    } else if (patterns.length > 0) {
                        context += `\n\n【你的出拳规律，我已算出】\n`;
                        patterns.forEach(p => { context += `- ${p.text}\n`; });
                        context += `利用这些规律来选你的 actual，但记住我说的 misread 倾向——你也有约 `;
                        context += `${Math.round(d.misreadRate * 100)}% 的概率看错。`;
                    } else {
                        // 样本还不够：如实说，别硬编规律
                        context += `\n\n【我暂时看不出你的规律】样本还不够。这一轮请在 taunt 里承认你拿不准。`;
                    }
                } else {
                    // 熟客：只给基础统计，不给结论
                    const patterns = findPatterns(tally);
                    if (patterns.length > 0) context += `\n出拳习惯：${patterns.map(p => p.text).join('；')}。`;
                }

                context += `\n\n最近 ${recent.length} 轮明细：`;
                recent.forEach(record => {
                    context += `\n第${record.round}轮: 你宣告${ui.choiceText(record.playerDeclared)}，实际出${ui.choiceText(record.playerActual)}；我宣告${ui.choiceText(record.aiDeclared)}，实际出${ui.choiceText(record.aiActual)}，结果：${record.result}`;
                });
            }
        } else {
            context += `\n\n这是第一轮，你还没有任何历史数据。不许假装你了解我。`;
        }

        context += `\n\n玩家刚刚宣告要出：${ui.choiceText(playerDeclared)}`;
        context += `\n\n请只输出一个 JSON 对象（不要代码块围栏、不要额外说明）：`;
        context += `\n{"taunt":"你对玩家说的话，一到两句","declared":"石头|布|剪刀|不告诉你","actual":"石头|布|剪刀"}`;
        context += `\n\n本轮的 declared 与 actual 已经由系统决定（见下方），你只要照抄。`;
        context += `你的创作空间只有 taunt 那句话——让它针对玩家这一轮的宣告，别泛泛地嘲讽。`;
        context += `\n记住：你永远猜不到玩家实际出什么，这正是博弈所在。`;
        return context;
    }

    // ------------------------------------------------------------------
    // 实际出拳与揭晓
    // ------------------------------------------------------------------

    handleAction(choice) {
        this.state.playerActual = choice;
        this.state.currentPhase = 'revealing';
        ui.renderAiHiddenNotice(false);
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
            // 画像每轮刷新：玩家能看见自己的规律正在被对手读出来
            ui.renderProfile(this.state.history);

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

        // 双盲下的措辞：你出拳时看不到我的宣告，所以你是"赌"而不是"信"。
        if (playerSecret && aiSecret) message += '我们都保密了——那就纯猜拳吧！';
        else if (playerSecret) message += '你保密了，可惜我这边可没瞒你（但你当时看不到）。';
        else if (aiSecret) message += '我保密了，所以你刚才是闭眼出的拳吧？';
        else if (playerHonest && aiHonest) message += '我们都说了实话，这局没骗到彼此。';
        else if (!playerHonest && !aiHonest) message += '互相骗到了，心理战平手！';
        else if (!playerHonest) message += '你撒了谎——我还按你说的去猜了，中招了！';
        else message += '我骗到了你：我说宣告，实际可没跟着走。';

        message += '\n\n';
        const aiText = ui.choiceText(s.aiActual);
        const playerText = ui.choiceText(s.playerActual);
        if (result === 'win') message += `${aiText}被${playerText}克制，你赢了这一轮！🎉`;
        else if (result === 'lose') message += `${playerText}被${aiText}克制，我赢了这一轮！😄`;
        else message += `都是${playerText}，平局！再来一轮吧～`;
        return message;
    }

    // 表情包彩蛋：只在 AI 获胜时触发，且语义适配双盲——
    // 原版是"AI 说真话你还上当了"（那时玩家看得见宣告才成立），
    // 双盲后玩家本就知道宣告不可信，所以改为拿"你被我读懂了"来嘲讽。
    checkAndShowMeme(result) {
        if (result !== 'lose') return;
        const { aiDeclared, aiActual, playerDeclared, playerActual } = this.state;
        setTimeout(() => {
            // AI 说谎却赢了 → 它成功利用了你的宣告
            if (aiDeclared && aiDeclared !== 'secret' && aiDeclared !== aiActual) {
                ui.showMemePopup('images/逗你.jpg', '逗逗你的啊');
            } else if (playerDeclared && playerDeclared !== 'secret' && playerDeclared === playerActual) {
                // 你诚实且输了 → 老实人挨打
                ui.showMemePopup('images/你看.jpg', '你看, 说实话你都不信');
            } else {
                // 其余情况（多为 AI 保密）：换个不指责玩家的说法
                ui.showMemePopup('images/逗你.jpg', '猜不到吧～');
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
        ui.renderAiHiddenNotice(false);
        ui.showPhase('declare');
        ui.updateScores(this.state);
        ui.addChat('ai', '下一轮。先提醒一句：我会记住你之前的习惯，但你也别太机械——被我摸到规律就不好玩了。这轮你打算宣告什么？');
    }
}

// 预填上次保存的设置
ui.fillStartForm(loadSettings());

document.addEventListener('DOMContentLoaded', () => {
    new RockPaperScissorsGame();
});

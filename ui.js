// ui.js — DOM 层
// 职责：事件绑定与一切页面渲染。游戏规则与状态在 game.js，模型调用在 ai.js。

import { PROVIDERS, DIFFICULTIES, DEFAULT_DIFFICULTY } from './ai.js';
import { tallyHistory, findPatterns, checkRandomized, CHOICES } from './profile.js';

// ---------------------------------------------------------------------------
// 初始化与事件绑定
// ---------------------------------------------------------------------------

export function init(callbacks) {
    document.getElementById('start-game').addEventListener('click', callbacks.onStart);
    document.querySelectorAll('#declare-phase .choice-btn').forEach(btn => {
        btn.addEventListener('click', e => callbacks.onDeclare(e.currentTarget.dataset.choice));
    });
    document.querySelectorAll('#action-phase .choice-btn').forEach(btn => {
        btn.addEventListener('click', e => callbacks.onAction(e.currentTarget.dataset.choice));
    });
    document.getElementById('next-round').addEventListener('click', callbacks.onNextRound);
    document.getElementById('toggle-history').addEventListener('click', toggleHistory);
    document.getElementById('toggle-profile').addEventListener('click', toggleProfile);
    document.getElementById('reset-game').addEventListener('click', callbacks.onReset);
    document.getElementById('close-error').addEventListener('click', hideError);
    document.getElementById('show-help').addEventListener('click', showHelp);
    document.getElementById('close-help').addEventListener('click', hideHelp);
    document.getElementById('meme-overlay').addEventListener('click', hideMemePopup);

    // 设置表单：厂商预设切换时带出默认 base URL 与模型名
    const providerSel = document.getElementById('provider-select');
    providerSel.addEventListener('change', () => applyProviderDefaults(providerSel.value));

    renderDifficultyOptions(DEFAULT_DIFFICULTY);
}

// ---------------------------------------------------------------------------
// 难度选择
// 三档人格化的对手，难度差异体现在"它知道多少 / 它多会骗 / 它会不会说破"。
// ---------------------------------------------------------------------------

const DIFFICULTY_HINT = {
    rookie: '它基本不会骗你，你也很难骗到它。适合先搞懂规则。',
    regular: '它会记住你的出拳习惯并找机会反制，但也会看错。想要一点博弈感选这个。',
    mindreader: '它会明确指出你的规律并据此出拳，但会栽在你故意打乱节奏上。准备好被针对。',
};

function renderDifficultyOptions(selected) {
    const wrap = document.getElementById('difficulty-options');
    const note = document.getElementById('difficulty-note');
    if (!wrap) return;
    wrap.innerHTML = '';

    for (const d of Object.values(DIFFICULTIES)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'difficulty-opt' + (d.id === selected ? ' active' : '');
        btn.dataset.difficulty = d.id;

        const name = document.createElement('span');
        name.className = 'difficulty-name';
        name.textContent = d.label;

        const blurb = document.createElement('span');
        blurb.className = 'difficulty-blurb';
        blurb.textContent = d.blurb;

        btn.appendChild(name);
        btn.appendChild(blurb);
        btn.addEventListener('click', () => {
            wrap.querySelectorAll('.difficulty-opt').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            if (note) note.textContent = DIFFICULTY_HINT[d.id] || '';
        });
        wrap.appendChild(btn);
    }

    if (note) {
        const cur = DIFFICULTIES[selected] ? selected : DEFAULT_DIFFICULTY;
        note.textContent = DIFFICULTY_HINT[cur] || '';
    }
}

function applyProviderDefaults(providerId) {
    const preset = PROVIDERS[providerId] || PROVIDERS.custom;
    const baseUrlInput = document.getElementById('base-url-input');
    const modelInput = document.getElementById('model-input');
    baseUrlInput.value = preset.baseUrl;
    if (!modelInput.value || modelInput.dataset.autoFilled === '1') {
        modelInput.value = preset.model;
    }
    modelInput.dataset.autoFilled = '1';
}

// ---------------------------------------------------------------------------
// 开始界面 / 设置表单
// ---------------------------------------------------------------------------

export function fillStartForm(settings) {
    if (!settings) return;
    const providerId = settings.provider && PROVIDERS[settings.provider] ? settings.provider : 'deepseek';
    const sel = document.getElementById('provider-select');
    sel.value = providerId;
    document.getElementById('api-key-input').value = settings.apiKey || '';
    const modelInput = document.getElementById('model-input');
    const baseUrlInput = document.getElementById('base-url-input');
    baseUrlInput.value = settings.baseUrl || PROVIDERS[providerId].baseUrl;
    modelInput.value = settings.model || PROVIDERS[providerId].model;
    modelInput.dataset.autoFilled = settings.model ? '0' : '1';
    document.getElementById('playerName').value = settings.playerName || '';
    const diff = DIFFICULTIES[settings.difficulty] ? settings.difficulty : DEFAULT_DIFFICULTY;
    renderDifficultyOptions(diff);
}

export function readStartForm() {
    const active = document.querySelector('#difficulty-options .difficulty-opt.active');
    return {
        provider: document.getElementById('provider-select').value,
        apiKey: document.getElementById('api-key-input').value.trim(),
        model: document.getElementById('model-input').value.trim(),
        baseUrl: document.getElementById('base-url-input').value.trim(),
        playerName: document.getElementById('playerName').value.trim() || '玩家',
        difficulty: active ? active.dataset.difficulty : DEFAULT_DIFFICULTY,
    };
}

export function showStartStatus(message, type) {
    const el = document.getElementById('init-status');
    el.textContent = message;
    el.className = 'status-message' + (type ? ' ' + type : '');
}

export function switchToGame() {
    document.getElementById('init-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
}

// ---------------------------------------------------------------------------
// 阶段与比分
// ---------------------------------------------------------------------------

const PHASE_TEXT = {
    declare: '等待你的宣告...',
    waiting: 'AI 正在思考策略...',
    action: '选择你的实际出拳！',
    revealing: '同步出拳中...',
    result: '本轮结果',
};

export function showPhase(phase) {
    document.querySelectorAll('.action-phase').forEach(el => el.classList.remove('active'));
    const ids = { declare: 'declare-phase', waiting: 'waiting-ai', action: 'action-phase', revealing: 'waiting-ai', result: 'result-phase' };
    const el = document.getElementById(ids[phase]);
    if (el) el.classList.add('active');
    document.getElementById('game-phase').textContent = PHASE_TEXT[phase] || '';
}

export function updateScores(state) {
    document.getElementById('round-info').textContent = `第 ${state.round} 轮`;
    document.getElementById('player-score').textContent = state.playerScore;
    document.getElementById('ai-score').textContent = state.aiScore;
}

export function setPlayerName(name) {
    document.getElementById('player-name-display').textContent = name;
}

// 双盲提示：出拳阶段告诉玩家"对方的宣告已锁定，你看不到它"。
// 这不是免责声明，而是玩法说明——玩家必须知道自己在赌。
export function renderAiHiddenNotice(visible) {
    const el = document.getElementById('blind-hint');
    if (el) el.classList.toggle('active', !!visible);
}

// ---------------------------------------------------------------------------
// 聊天流
// ---------------------------------------------------------------------------

// AI/玩家文本一律走 textContent——AI 返回内容是不可信输入，绝不能进 innerHTML。
// 换行由 .message-text 的 pre-wrap 处理。
// 返回该消息元素，便于失败时撤回（见 game.js 的作废轮处理）。
export function addChat(sender, text) {
    const chatMessages = document.getElementById('chat-messages');
    const chatArea = document.querySelector('.chat-area');
    const el = document.createElement('div');
    el.className = 'message ' + sender + '-message';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender === 'player' ? '🧑' : '🤖';

    const content = document.createElement('div');
    content.className = 'message-content';

    const body = document.createElement('div');
    body.className = 'message-text';
    body.textContent = text;

    content.appendChild(body);
    el.appendChild(avatar);
    el.appendChild(content);
    chatMessages.appendChild(el);

    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    setTimeout(() => {
        chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
        el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    }, 10);

    return el;
}

// 作废轮次：把该条消息标记为无效而非直接删——让玩家看得出发生过什么
export function voidChat(el) {
    if (!el || !el.parentNode) return;
    el.classList.add('message-void');
    const body = el.querySelector('.message-text');
    if (body) body.textContent = body.textContent + '\n（本轮作废）';
}

export function clearChat() {
    document.getElementById('chat-messages').innerHTML = '';
}

// ---------------------------------------------------------------------------
// 结果与历史
// ---------------------------------------------------------------------------

const CHOICE_TEXT = { rock: '石头', paper: '布', scissors: '剪刀', secret: '不告诉你' };
export function choiceText(choice) { return CHOICE_TEXT[choice] || choice; }

const CHOICE_IMG = { rock: 'images/rock.png', paper: 'images/paper.png', scissors: 'images/scissors.png' };

export function renderResult(state, result) {
    document.getElementById('player-declared').textContent = choiceText(state.playerDeclared);
    document.getElementById('player-actual').textContent = choiceText(state.playerActual);
    document.getElementById('ai-declared').textContent = choiceText(state.aiDeclared);
    document.getElementById('ai-actual').textContent = choiceText(state.aiActual);
    document.getElementById('player-choice-img').src = CHOICE_IMG[state.playerActual] || '';
    document.getElementById('ai-choice-img').src = CHOICE_IMG[state.aiActual] || '';

    const resultEl = document.getElementById('result-text');
    resultEl.className = 'result-text ' + result;
    resultEl.textContent = result === 'win' ? '你赢了！' : result === 'lose' ? 'AI 赢了！' : '平局！';
}

function toggleHistory() {
    const panel = document.getElementById('history-panel');
    panel.classList.toggle('active');
}

export function renderHistory(history) {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    history.forEach(record => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const head = document.createElement('div');
        head.className = 'round';
        const resultText = record.result === 'win' ? '你赢' : record.result === 'lose' ? 'AI 赢' : '平局';
        head.textContent = `第${record.round}轮 - ${resultText}`;

        const details = document.createElement('div');
        details.className = 'details';
        const pLine = document.createElement('div');
        pLine.textContent = `你：宣告${choiceText(record.playerDeclared)} → 实际${choiceText(record.playerActual)}`;
        const aLine = document.createElement('div');
        aLine.textContent = `AI：宣告${choiceText(record.aiDeclared)} → 实际${choiceText(record.aiActual)}`;

        details.appendChild(pLine);
        details.appendChild(aLine);
        item.appendChild(head);
        item.appendChild(details);
        list.appendChild(item);
    });
}

// ---------------------------------------------------------------------------
// 博弈画像：把"对手眼中的你"显形
//
// 这是让博弈闭环的一环。玩家如果看不见自己被读出了什么规律，
// 就没有反制的动力——博弈退化成单方面被分析。
// ---------------------------------------------------------------------------

function toggleProfile() {
    document.getElementById('profile-panel').classList.toggle('active');
}

function addProfileRow(container, label, value, tone) {
    const row = document.createElement('div');
    row.className = 'profile-row' + (tone ? ' tone-' + tone : '');

    const l = document.createElement('span');
    l.className = 'profile-label';
    l.textContent = label;

    const v = document.createElement('span');
    v.className = 'profile-value';
    v.textContent = value;

    row.appendChild(l);
    row.appendChild(v);
    container.appendChild(row);
}

function addProfileBar(container, label, count, total, tone) {
    const row = document.createElement('div');
    row.className = 'profile-bar-row';

    const l = document.createElement('span');
    l.className = 'profile-label';
    l.textContent = label;

    const track = document.createElement('span');
    track.className = 'profile-track';
    const fill = document.createElement('span');
    fill.className = 'profile-fill' + (tone ? ' fill-' + tone : '');
    fill.style.width = (total > 0 ? Math.round(count / total * 100) : 0) + '%';
    track.appendChild(fill);

    const v = document.createElement('span');
    v.className = 'profile-count';
    v.textContent = `${count}`;

    row.appendChild(l);
    row.appendChild(track);
    row.appendChild(v);
    container.appendChild(row);
}

export function renderProfile(history) {
    const wrap = document.getElementById('profile-content');
    if (!wrap) return;
    wrap.innerHTML = '';

    const recent = Array.isArray(history) ? history.slice(-20) : [];

    if (recent.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'profile-empty';
        empty.textContent = '还没有足够的数据。对手什么都看不出来——这是你的窗口期。';
        wrap.appendChild(empty);
        return;
    }

    const t = tallyHistory(recent);
    const patterns = findPatterns(t);
    const randomized = checkRandomized(t);

    // 诚实度
    const honestCount = recent.length - t.deceived - t.secrets;
    addProfileRow(wrap, '宣告诚实度',
        `${honestCount} 诚实 / ${t.deceived} 撒谎 / ${t.secrets} 保密`,
        t.deceived > t.secrets ? 'warn' : 'ok');
    addProfileRow(wrap, '战绩', `${t.playerWins} 胜 ${t.aiWins} 负 ${t.draws} 平`);

    // 出拳分布
    const distWrap = document.createElement('div');
    distWrap.className = 'profile-dist';
    const totalActual = t.actual.rock + t.actual.paper + t.actual.scissors;
    for (const c of CHOICES) {
        addProfileBar(distWrap, choiceText(c), t.actual[c], totalActual, c);
    }
    wrap.appendChild(distWrap);

    // 规律结论
    const patWrap = document.createElement('div');
    patWrap.className = 'profile-patterns';
    const patTitle = document.createElement('div');
    patTitle.className = 'profile-section-title';
    patTitle.textContent = '对手已看出的规律';
    patWrap.appendChild(patTitle);

    if (randomized) {
        const ok = document.createElement('div');
        ok.className = 'profile-pattern tone-ok';
        ok.textContent = `你的出拳分布已很均匀（最高占比 ${Math.round(randomized.maxShare * 100)}%），对手的规律分析对你基本失效——随机化奏效了。`;
        patWrap.appendChild(ok);
    } else if (patterns.length === 0) {
        const none = document.createElement('div');
        none.className = 'profile-pattern';
        none.textContent = '暂时没有明显规律。再打几轮就能看出端倪。';
        patWrap.appendChild(none);
    } else {
        for (const p of patterns) {
            const item = document.createElement('div');
            // followAi 是最危险的一条：它意味着对手可以反过来喂假信息
            item.className = 'profile-pattern' + (p.kind === 'followAi' ? ' tone-danger' : p.kind === 'declareBias' ? ' tone-warn' : '');
            item.textContent = p.text;
            patWrap.appendChild(item);
        }
    }
    wrap.appendChild(patWrap);

    // 提示：反制方法
    const tip = document.createElement('p');
    tip.className = 'profile-tip';
    tip.textContent = randomized
        ? '继续保持，别让出拳重新变得可预测。'
        : '被标红的规律是可以刻意打乱的——故意在宣告石头时改出布，规律就废了。';
    wrap.appendChild(tip);
}

// ---------------------------------------------------------------------------
// 弹窗（错误 / 帮助 / 表情包）
// ---------------------------------------------------------------------------

export function showError(message) {
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-modal').classList.add('active');
}

function hideError() {
    document.getElementById('error-modal').classList.remove('active');
}

function showHelp() {
    document.getElementById('help-modal').classList.add('active');
}

function hideHelp() {
    document.getElementById('help-modal').classList.remove('active');
}

// 表情包：右上角浮层，4 秒后自动消失。
// 原来是全屏遮罩 + 必须手动关闭，会挡住「下一轮」——
// 连续多轮的博弈游戏里，打断节奏的代价比没有嘲讽更大。
let memeTimer = null;

export function showMemePopup(imagePath, text) {
    const img = new Image();
    img.onload = () => {
        document.getElementById('meme-image').src = imagePath;
        document.getElementById('meme-text').textContent = text;
        document.getElementById('meme-overlay').classList.add('show');
        document.getElementById('meme-popup').classList.add('show');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        clearTimeout(memeTimer);
        memeTimer = setTimeout(hideMemePopup, 4000);
    };
    img.src = imagePath;
}

function hideMemePopup() {
    clearTimeout(memeTimer);
    memeTimer = null;
    document.getElementById('meme-overlay').classList.remove('show');
    document.getElementById('meme-popup').classList.remove('show');
}

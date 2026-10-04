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
    document.getElementById('rematch').addEventListener('click', callbacks.onRematch);
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
    summary: '整场结束',
};

export function showPhase(phase) {
    document.querySelectorAll('.action-phase').forEach(el => el.classList.remove('active'));
    const ids = { declare: 'declare-phase', waiting: 'waiting-ai', action: 'action-phase', revealing: 'waiting-ai', result: 'result-phase', summary: 'summary-phase' };
    const el = document.getElementById(ids[phase]);
    if (el) el.classList.add('active');
    document.getElementById('game-phase').textContent = PHASE_TEXT[phase] || '';
}

// ---------------------------------------------------------------------------
// 局制看板：三局两胜的进度点
// gamesPerMatch 由 game.js 传入，避免两处各定义一份常量而漂移
// ---------------------------------------------------------------------------

export function renderMatchBoard(gameNo, gameWins, matchOver, gamesPerMatch) {
    const titleEl = document.getElementById('match-title');
    const dotsEl = document.getElementById('match-dots');
    if (!titleEl || !dotsEl) return;
    const total = gamesPerMatch || 3;

    if (matchOver) {
        titleEl.textContent = '本场结束';
    } else {
        const label = gameNo >= total ? '决胜局' : `第 ${gameNo} 局`;
        titleEl.textContent = `三局两胜 · ${label}`;
    }

    dotsEl.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const dot = document.createElement('div');
        dot.className = 'match-dot';
        const w = gameWins[i];
        if (w === 'win') {
            dot.classList.add('win');
            dot.textContent = '胜';
        } else if (w === 'lose') {
            dot.classList.add('lose');
            dot.textContent = '负';
        } else if (w === 'draw') {
            dot.classList.add('draw');
            dot.textContent = '平';
        } else if (i + 1 === gameNo && !matchOver) {
            dot.classList.add('current');
            dot.textContent = String(gameNo);
        } else {
            dot.textContent = String(i + 1);
        }
        dotsEl.appendChild(dot);
    }
}

// 结果页按钮的三态：下一轮 / 下一局 / 看复盘
export function renderRoundAction(gameFinished) {
    const btn = document.getElementById('next-round');
    if (!btn) return;
    btn.textContent = gameFinished ? '看本场复盘 →' : '下一轮';
}

export function updateScores(state) {
    document.getElementById('round-info').textContent = `第 ${state.round} 轮`;
    document.getElementById('player-score').textContent = state.playerScore;
    document.getElementById('ai-score').textContent = state.aiScore;
    // 回到轮数比分模式——否则看完复盘点「再来一场」后，
    // 比分板会一直停留在局比分状态（因为 match-mode 是加上去的）。
    const board = document.getElementById('match-board');
    if (board) board.classList.remove('match-mode');
}

// 局比分：只统计小局胜负。与「轮数比分」是两回事，复盘页要用这个。
export function updateMatchScore(state) {
    const pw = (state.gameWins || []).filter(w => w === 'win').length;
    const aw = (state.gameWins || []).filter(w => w === 'lose').length;
    document.getElementById('player-score').textContent = pw;
    document.getElementById('ai-score').textContent = aw;
    const board = document.getElementById('match-board');
    const title = document.getElementById('match-title');
    if (title) {
        title.textContent = pw >= 2 ? '你赢下这场' : aw >= 2 ? '你输掉这场' : '未分出胜负';
    }
    if (board) board.classList.add('match-mode');
}

// 小局内进度：第几轮 / 共几轮，以及本局内双方胜轮数。
// 让玩家在局中就知道"这局还剩 2 轮，现在 1:1 平"——否则局制没有张力。
export function renderGameProgress(state, roundsPerGame) {
    const el = document.getElementById('game-progress');
    if (!el) return;
    const g = state.gameNo || 1;
    const recs = state.history.filter(r => (r.gameNo || 1) === g);
    if (recs.length === 0) {
        el.textContent = `第 ${g} 局 · 0 / ${roundsPerGame} 轮`;
        el.className = 'game-progress';
        return;
    }
    const pw = recs.filter(r => r.result === 'win').length;
    const al = recs.filter(r => r.result === 'lose').length;
    const left = roundsPerGame - recs.length;
    el.textContent = `第 ${g} 局 · ${recs.length}/${roundsPerGame} 轮` +
        `　本局 ${pw}:${al}` + (left > 0 ? `　剩 ${left} 轮` : '　已打完');
    el.className = 'game-progress' + (left === 0 ? ' finished' : '');
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

    // 与 AI 侧一致：统计窗口 30 轮（profile.js 的门槛需要足够样本）
    const recent = Array.isArray(history) ? history.slice(-30) : [];

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
// 整场复盘
//
// 目标不是罗列统计，而是让玩家看见「我做了什么选择 → 结果如何」的因果链。
// 局制的价值全在这里：单局看不出策略演化，三局才有对比。
// ---------------------------------------------------------------------------

// 单局统计：从该局的 history 切片算出
function gameStats(records) {
    const t = { total: records.length, win: 0, lose: 0, draw: 0, honest: 0, secret: 0, lied: 0 };
    for (const r of records) {
        if (r.result === 'win') t.win++;
        else if (r.result === 'lose') t.lose++;
        else if (r.result === 'draw') t.draw++;
        if (r.playerDeclared === 'secret') t.secret++;
        else if (r.playerDeclared === r.playerActual) t.honest++;
        else t.lied++;
    }
    return t;
}

export function renderMatchSummary(state, settings, gamesPerMatch) {
    const wrap = document.getElementById('summary-content');
    const titleEl = document.getElementById('summary-title');
    if (!wrap) return;
    wrap.innerHTML = '';
    const total = gamesPerMatch || 3;

    const won = state.matchWinner === 'player';
    const drew = state.matchWinner === 'draw';
    titleEl.textContent = won ? '🎉 你赢下了这场' : drew ? '🤝 没分出胜负' : '😤 这场输了';
    titleEl.className = 'summary-title' + (won ? ' win' : drew ? ' draw' : ' lose');

    // 复盘页的比分板应显示局比分（2:1），而不是累计轮数比分
    updateMatchScore(state);

    // 逐局概览
    const board = document.createElement('div');
    board.className = 'summary-games';
    for (let i = 0; i < total; i++) {
        const cell = document.createElement('div');
        cell.className = 'summary-game';
        const gNo = document.createElement('div');
        gNo.className = 'sg-no';
        gNo.textContent = `第 ${i + 1} 局`;
        const gRes = document.createElement('div');
        gRes.className = 'sg-result';
        const w = state.gameWins[i];
        gRes.className += w === 'win' ? ' win' : w === 'lose' ? ' lose' : w === 'draw' ? ' draw' : ' pending';
        gRes.textContent = w === 'win' ? '胜' : w === 'lose' ? '负' : w === 'draw' ? '平' : '—';
        cell.appendChild(gNo);
        cell.appendChild(gRes);
        board.appendChild(cell);
    }
    wrap.appendChild(board);

    // 按局拆解：策略演化才是重点
    const byGame = new Map();
    for (const r of state.history) {
        const g = r.gameNo || 1;
        if (!byGame.has(g)) byGame.set(g, []);
        byGame.get(g).push(r);
    }

    const trendWrap = document.createElement('div');
    trendWrap.className = 'summary-trend';
    const trendTitle = document.createElement('div');
    trendTitle.className = 'summary-section-title';
    trendTitle.textContent = '你的策略演化';
    trendWrap.appendChild(trendTitle);

    const table = document.createElement('div');
    table.className = 'summary-table';
    const header = document.createElement('div');
    header.className = 'summary-thead';
    ['局', '胜负', '诚实/撒谎/保密', '胜率'].forEach((h, i) => {
        const c = document.createElement('span');
        c.textContent = h;
        header.appendChild(c);
    });
    table.appendChild(header);

    const sortedGames = [...byGame.entries()].sort((a, b) => a[0] - b[0]);
    for (const [g, records] of sortedGames) {
        const s = gameStats(records);
        const rate = s.total ? Math.round(s.win / s.total * 100) : 0;
        const row = document.createElement('div');
        row.className = 'summary-trow';
        const cells = [
            String(g),
            state.gameWins[g - 1] === 'win' ? '胜' : state.gameWins[g - 1] === 'lose' ? '负' : state.gameWins[g - 1] === 'draw' ? '平' : '—',
            `${s.honest} / ${s.lied} / ${s.secret}`,
            rate + '%',
        ];
        cells.forEach((c, i) => {
            const cell = document.createElement('span');
            cell.textContent = c;
            if (i === 3) {
                cell.className = 'st-rate';
                if (rate >= 50) cell.classList.add('good');
                else if (rate < 30) cell.classList.add('bad');
            }
            row.appendChild(cell);
        });
        table.appendChild(row);
    }
    trendWrap.appendChild(table);
    wrap.appendChild(trendWrap);

    // 结论：从数据里读出可执行的建议
    const all = sortedGames.flatMap(([, r]) => r);
    const agg = gameStats(all);
    const hint = document.createElement('div');
    hint.className = 'summary-hint';

    const rate = agg.total ? Math.round(agg.win / agg.total * 100) : 0;
    const lieRate = (agg.honest + agg.lied) ? Math.round(agg.lied / (agg.honest + agg.lied) * 100) : 0;

    let msg;
    if (agg.secret === agg.total) {
        msg = '你整场都在保密——对手只能瞎猜你。下次试试偶尔说真话，反过来利用它的信任。';
    } else if (lieRate >= 70) {
        msg = '你几乎一直在撒谎。但对手读的是「宣告 → 实际」的关系，谎话被看穿后它就能精准反制——试着掺点随机。';
    } else if (lieRate <= 30) {
        msg = '你基本实话实说。这在高分难度下会吃亏：对手猜你的实际出拳比猜你的宣告准得多。';
    } else if (rate >= 60) {
        msg = '你的诚实度拿捏得不错——该骗的时候骗，该说实话的时候说实话。';
    } else {
        msg = '胜率还有空间。关键不是猜得准，而是让对手读不透你：宣告可以骗，但实际出拳要掺随机。';
    }
    hint.textContent = msg;
    wrap.appendChild(hint);
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

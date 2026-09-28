// ui.js — DOM 层
// 职责：事件绑定与一切页面渲染。游戏规则与状态在 game.js，模型调用在 ai.js。

import { PROVIDERS } from './ai.js';

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
    document.getElementById('reset-game').addEventListener('click', callbacks.onReset);
    document.getElementById('close-error').addEventListener('click', hideError);
    document.getElementById('show-help').addEventListener('click', showHelp);
    document.getElementById('close-help').addEventListener('click', hideHelp);
    document.getElementById('close-meme').addEventListener('click', hideMemePopup);
    document.getElementById('meme-overlay').addEventListener('click', hideMemePopup);

    // 设置表单：厂商预设切换时带出默认 base URL 与模型名
    const providerSel = document.getElementById('provider-select');
    providerSel.addEventListener('change', () => applyProviderDefaults(providerSel.value));
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
}

export function readStartForm() {
    return {
        provider: document.getElementById('provider-select').value,
        apiKey: document.getElementById('api-key-input').value.trim(),
        model: document.getElementById('model-input').value.trim(),
        baseUrl: document.getElementById('base-url-input').value.trim(),
        playerName: document.getElementById('playerName').value.trim() || '玩家',
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

// ---------------------------------------------------------------------------
// 聊天流
// ---------------------------------------------------------------------------

export function addChat(sender, text) {
    const chatMessages = document.getElementById('chat-messages');
    const chatArea = document.querySelector('.chat-area');
    const el = document.createElement('div');
    el.className = 'message ' + sender + '-message';
    const avatar = sender === 'player' ? '🧑' : '🤖';
    el.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <div class="message-text">${text.replace(/\n/g, '<br>')}</div>
        </div>`;
    chatMessages.appendChild(el);

    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    setTimeout(() => {
        chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
        el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    }, 10);
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
        const resultText = record.result === 'win' ? '你赢' : record.result === 'lose' ? 'AI 赢' : '平局';
        item.innerHTML = `
            <div class="round">第${record.round}轮 - ${resultText}</div>
            <div class="details">
                你：宣告${choiceText(record.playerDeclared)} → 实际${choiceText(record.playerActual)}<br>
                AI：宣告${choiceText(record.aiDeclared)} → 实际${choiceText(record.aiActual)}
            </div>`;
        list.appendChild(item);
    });
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

export function showMemePopup(imagePath, text) {
    const img = new Image();
    img.onload = () => {
        document.getElementById('meme-image').src = imagePath;
        document.getElementById('meme-text').textContent = text;
        document.getElementById('meme-overlay').classList.add('show');
        document.getElementById('meme-popup').classList.add('show');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    };
    img.src = imagePath;
}

function hideMemePopup() {
    document.getElementById('meme-overlay').classList.remove('show');
    document.getElementById('meme-popup').classList.remove('show');
}

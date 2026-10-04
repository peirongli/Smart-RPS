// ai.js — 模型接入层（BYO API key，OpenAI 兼容协议）
// 职责：设置存取、模型调用、回应解析。不碰 DOM，不碰游戏规则。

// ---------------------------------------------------------------------------
// 厂商预设：base URL + 默认模型。均走 OpenAI 兼容的 /chat/completions。
// ---------------------------------------------------------------------------

export const PROVIDERS = {
    deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    zhipu: { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
    moonshot: { label: 'Moonshot Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    custom: { label: '自定义（OpenAI 兼容端点）', baseUrl: '', model: '' },
};

const SETTINGS_KEY = 'rps-settings';
const TIMEOUT_MS = 60000;

// ---------------------------------------------------------------------------
// 设置存取（仅存本浏览器 localStorage）
// ---------------------------------------------------------------------------

export function loadSettings() {
    try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch (e) {
        return {};
    }
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        // 存储失败不阻断游戏（如隐私模式），仅本次会话内有效
    }
}

// ---------------------------------------------------------------------------
// 提示词（单一来源，勿在其他地方复制维护）
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `# AI 猜拳博弈 Agent 提示词

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

// 解析失败后的追加强问（作为新一轮 user 消息）
const PARSE_RETRY_REMINDER = (missing) =>
    `（系统提示：你上一条回应里没能解析出${missing}。请重新回应本轮，` +
    '务必包含一句"我宣告出X"（X 为石头/布/剪刀；若想保密则写"我不告诉你"），' +
    '并在结尾单独一行写"我实际出：X"。注意：我实际出：X 这句话在你宣告之后我看不到，' +
    '所以宣告与实际可以不一致——这是本游戏的核心，别只写一句客套话。）';

// ---------------------------------------------------------------------------
// 模型调用
// ---------------------------------------------------------------------------

function friendlyApiError(status, detail) {
    if (status === 401 || status === 403) {
        return `认证失败（${status}）：请检查 API key 是否正确、是否为所选服务商的 key`;
    }
    if (status === 404) {
        return `接口不存在（404）：请检查 base URL 是否正确（自定义端点需填到含 /v1 的完整前缀）`;
    }
    if (status === 429) {
        return '请求过于频繁或额度不足（429）：请稍后再试，或检查账户余额';
    }
    if (status >= 500) {
        return `服务商错误（${status}）：请稍后再试`;
    }
    return `请求失败（${status}${detail ? '：' + detail : ''}）`;
}

async function chatCompletion(settings, messages) {
    const baseUrl = (settings.baseUrl || '').replace(/\/+$/, '');
    if (!baseUrl.startsWith('http')) {
        throw new Error('请填写有效的 base URL（以 http 或 https 开头）');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response;
    try {
        response = await fetch(baseUrl + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + settings.apiKey,
            },
            body: JSON.stringify({
                model: settings.model,
                messages: messages,
                temperature: 0.9,
                max_tokens: 400,
            }),
            signal: controller.signal,
        });
    } catch (e) {
        if (e.name === 'AbortError') {
            throw new Error(`模型响应超时（${TIMEOUT_MS / 1000} 秒），请检查网络或换一个模型`);
        }
        throw new Error('网络请求失败：请检查网络连接，以及所选服务商是否允许浏览器直连（CORS）');
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        let detail = '';
        try {
            const body = await response.json();
            detail = (body.error && body.error.message) || '';
        } catch (e) { /* 忽略响应体解析失败 */ }
        throw new Error(friendlyApiError(response.status, detail));
    }

    const data = await response.json();
    const content = data &&
        Array.isArray(data.choices) &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content;

    if (typeof content !== 'string' || !content.trim()) {
        throw new Error('模型返回了空回应，请重试或换一个模型');
    }
    return content.trim();
}

// ---------------------------------------------------------------------------
// 回应解析（继承原版规则：提取实际出拳、宣告与保密）
// ---------------------------------------------------------------------------

const CHOICE_KEY = { '石头': 'rock', '布': 'paper', '剪刀': 'scissors' };
const ACTUAL_RE = /我实际出[：:]\s*(石头|布|剪刀)/;
const SECRET_WORDS = ['不告诉你', '保密', '不说', '不公开', '神秘', '秘密'];
// 关键词按表意强度排序，越靠前越可信。
// 刻意不含单字"出"和"想"：它们在"我实际出：X"这类句子里会误命中，
// 导致宣告被解析成实际出拳（实测踩过）。
const DECLARE_KEYWORDS = [
    '宣告出', '宣告是', '宣告为', '宣告', '宣布',
    '倾向出', '倾向',
    '打算出', '打算', '准备出', '准备',
    '可能出', '可能', '大概', '估计',
    '选择出', '选择', '我要出', '要出', '这轮出',
    '我这轮押', '押',
];
const ACTUAL_CUT_KEYWORDS = ['实际出', '真正出', '最终出', '我出'];
// 解析宣告时遇到这些前缀直接跳过——它们属于"实际出拳"那一句，不属于宣告
const ACTUAL_PREFIXES = ['实际出', '真正出', '最终出', '我出', '实际', '真正', '最终'];

function extractActual(text) {
    const m = text.match(ACTUAL_RE);
    if (m) return CHOICE_KEY[m[1]];
    // 宽松兜底：就近寻找"出X"式表述
    for (const kw of ACTUAL_CUT_KEYWORDS) {
        const m2 = text.match(new RegExp(kw + '[：:]?\\s*(石头|布|剪刀)'));
        if (m2) return CHOICE_KEY[m2[1]];
    }
    return null;
}

// 关键词与拳名之间的最大允许间隔。
// 6 字刚好容纳"我实际出："（5 字）而不越界到下一句——
// 窗口开太大（如 12）会让"我这轮押石头。我实际出：剪刀"里的"押"捞到后半句的拳。
const DECLARE_WINDOW = 6;
// 并列/含糊表述：出现这些词说明模型在说"都行/随便"，不是在宣告。
// 刻意不含"不确定"——那是思考型措辞，后面往往跟着明确选择。
const HEDGE_WORDS = ['都行', '随便', '或者', '或是', '都可以'];

function extractDeclared(text) {
    // 1) 保密优先：只认明确的保密措辞
    if (SECRET_WORDS.some(w => text.includes(w))) return 'secret';

    // 2) 关键词就近匹配——从每个关键词位置往后找最近的拳名。
    //    顺序即优先级：越靠前的关键词表意越强。
    for (const kw of DECLARE_KEYWORDS) {
        let from = 0;
        for (;;) {
            const i = text.indexOf(kw, from);
            if (i === -1) break;
            // 落进"实际出拳"那句就跳过，别把实际拳当宣告
            if (!ACTUAL_PREFIXES.some(p => text.startsWith(p, i))) {
                const tail = text.slice(i, i + kw.length + DECLARE_WINDOW);
                // 含糊表述不算宣告
                if (!HEDGE_WORDS.some(h => tail.includes(h))) {
                    for (const choice of ['石头', '剪刀', '布']) {
                        if (tail.includes(choice)) return CHOICE_KEY[choice];
                    }
                }
            }
            from = i + kw.length;
        }
    }

    // 3) 兜底前先看含糊词：整段都在说"都行/随便"时不要硬猜
    if (!HEDGE_WORDS.some(h => text.includes(h))) {
        const hits = ['石头', '剪刀', '布'].filter(c => text.includes(c));
        if (hits.length === 1) return CHOICE_KEY[hits[0]];
    }

    // 宣告语不明晰时不猜——按"未宣告"处理，交给上层重问
    return null;
}

// 展示层裁剪：只给宣告部分，剥掉实际出拳，保留悬念
export function declarationOnly(text, aiDeclared) {
    let cut = text.length;
    for (const kw of ACTUAL_CUT_KEYWORDS) {
        const i = text.indexOf(kw);
        if (i !== -1 && i < cut) cut = i;
    }
    let part = text.substring(0, cut).trim();
    if (part.length < 10) {
        part = text;
        for (const kw of ACTUAL_CUT_KEYWORDS) {
            part = part.replace(new RegExp(kw + '[：:]?\\s*[石头布剪刀]+', 'g'), '');
        }
    }
    // "我实际出"被切断时，切割点左侧会残留一个"我"
    part = part.replace(/[\s，,]*我\s*$/, '').trim();
    if (!/[。～！]$/.test(part)) part += '。';
    if (aiDeclared !== 'secret') part += ' 现在我们同时出拳吧！';
    return part;
}

// ---------------------------------------------------------------------------
// 每轮一次的 AI 决策调用（含一次格式重试）
// 返回 { declared, actual, display }
// 重要：actual 在玩家实际出拳之前即已确定——防作弊由这一调用时序保证，
// 本函数不做任何"随机替 AI 出拳"的兜底。
// ---------------------------------------------------------------------------

export async function getAiMove(settings, contextMessage) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contextMessage },
    ];

    let lastRaw = '';
    let lastMissing = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt === 1) {
            messages.push({ role: 'assistant', content: lastRaw });
            messages.push({ role: 'user', content: PARSE_RETRY_REMINDER(lastMissing) });
        }
        const raw = await chatCompletion(settings, messages);
        lastRaw = raw;

        const actual = extractActual(raw);
        const declared = extractDeclared(raw);

        // 缺任何一项都算解析失败：绝不用 'secret' 顶替——
        // 那会把"模型没说清"伪装成"AI 选择保密"，凭空抹掉博弈信息。
        const missing = [];
        if (!actual) missing.push('实际出拳');
        if (!declared) missing.push('宣告');
        if (missing.length === 0) {
            return {
                declared,
                actual,
                display: declarationOnly(raw, declared),
            };
        }
        lastMissing = missing.join('与');
    }

    throw new Error(
        `AI 连续两次回应都缺少${lastMissing}（需要"我实际出：石头/布/剪刀"和明确的宣告）。` +
        '本轮作废，请重新宣告——这通常意味着模型没遵循格式，换个模型往往能解决'
    );
}

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

// 难度人格
//
// 难度不是靠提示词里说"你是高手"实现的——那纯属自我感动，模型不会真的变强。
// 真正的四个杠杆见 docs/redesign-plan.md：
//   1. 注入信息量（由 game.js 按难度裁剪画像，这是最硬的一个）
//   2. 欺骗倾向（宣告≠实际的概率）
//   3. 是否亮底牌（taunt 里是否引用画像结论）
//   4. 刻意误判率（难度越高越要留错，否则玩家无解——这是保底设计）
//
// persona 只负责 2/3/4 的行为倾向与语气，信息量由 game.js 控制。

export const DIFFICULTIES = {
    rookie: {
        id: 'rookie',
        label: '新手机',
        blurb: '还在熟悉你，好骗',
        // 注入画像的详细程度：none / basic / deep
        insight: 'none',
        // 刻意误判率：越高越容易看错玩家的习惯
        misreadRate: 0.35,
        // taunt 是否可以引用对玩家的分析
        canShowReading: false,
        // 宣告诚实倾向
        honestBias: 0.75,
        persona: `你是"新手机"——刚学会猜拳，还不太懂人类的套路。你说话热情但直白，
容易被玩家的话术带着走。你会参考玩家的出拳习惯，但常常判断错，而且不介意承认看错。
你的 taunt 就是随口一聊，不做心理分析。`,
    },
    regular: {
        id: 'regular',
        label: '熟客',
        blurb: '记得你，但会被骗',
        insight: 'basic',
        misreadRate: 0.15,
        canShowReading: true,
        honestBias: 0.5,
        persona: `你是"熟客"——和玩家混了很久，认得出一些套路，但还不至于每次都猜中。
你说话带点小聪明，偶尔会点一句"我大概看出来了"，但更多时候是被玩家骗过去的。
你会适度利用玩家的出拳习惯来反制，但也会失手。`,
    },
    mindreader: {
        id: 'mindreader',
        label: '读心者',
        blurb: '看穿你，但会栽在随机性上',
        insight: 'deep',
        misreadRate: 0.25,
        canShowReading: true,
        honestBias: 0.3,
        persona: `你是"读心者"——你擅长从玩家的历史里找出模式，并且会**明确说出来**：
"你宣告石头的时候七成会出布，这次我不信了。"

但你有一个致命弱点：你**会被随机性打败**。如果你发现玩家最近的出拳变得难以预测，
你必须在 taunt 里承认自己拿不准了——你不能装作永远洞察一切。
你的宣告更可能是假的（七成欺骗），因为你就是要让玩家按错误的假设出拳。`,
    },
};

export const DEFAULT_DIFFICULTY = 'regular';

// ---------------------------------------------------------------------------
// 提示词（单一来源，勿在其他地方复制维护）
// ---------------------------------------------------------------------------

function buildSystemPrompt(difficultyId) {
    const d = DIFFICULTIES[difficultyId] || DIFFICULTIES[DEFAULT_DIFFICULTY];
    return `# AI 猜拳博弈 Agent 提示词

## 一、角色定位
${d.persona}

## 二、游戏规则共识
1. 每轮流程：**玩家宣告→你回应并宣告→玩家出实际拳→双方同步揭晓**
2. "宣告出拳"与"实际出拳"可一致（诚实策略），也可不一致（欺诈策略）
3. 你也可以选择"不告诉你"，表示保密自己的计划
4. 输赢判定仅以"双方实际出拳"为准（石头克剪刀、剪刀克布、布克石头）

## 三、关键：信息不对称
**你给出宣告的那一刻，你的实际出拳就已经锁定了。而玩家在你宣告之后才决定自己出什么。**

也就是说：
- 你看得到玩家的宣告，看不到玩家的实际出拳
- 玩家看不到你的宣告（你被锁住了，要等揭晓才一起亮出来）

所以双方都是"半盲"。你的宣告是给玩家看的**心理战道具**，不是情报——
玩家读你的宣告时不知道该不该信。这个游戏的核心就在这里。

## 四、回应格式（必须严格遵守）

你**只输出一个 JSON 对象**，不要有任何 JSON 之外的文字、不要用代码块围栏：

{
  "taunt": "你对玩家说的话，一到两句，带博弈的小调皮或挑衅",
  "declared": "石头 | 布 | 剪刀 | 不告诉你",
  "actual": "石头 | 布 | 剪刀"
}

字段要求：
- **taunt**：立刻显示给玩家的话。可以回应玩家的宣告、可以放狠话、可以卖萌。
  ${d.canShowReading ? '可以（但不要求）引用你对玩家出拳习惯的分析。' : '不要做心理分析，只做闲聊和挑衅。'}
- **declared**：你的宣告。这是你的心理战道具，可以是谎。
  约 ${Math.round(d.honestBias * 100)}% 概率与 actual 一致。
- **actual**：你真正的出拳。**在 declared 之后就已经确定，永不修改。**

严格照抄"石头""布""剪刀"这三个词，不要写成 rock/paper/scissors，
不要在 declared 里写"不告诉你"以外的近似表达。

## 五、输出示例

{"taunt": "又说要出石头？你最近三次都这么说，我可不打算再上当了。", "declared": "布", "actual": "剪刀"}

## 六、策略原则
- 不要每次都用同样的宣告模式，玩家会学会你
- 玩家如果表现出随机性（分布变均匀），承认你跟不上了
- 保持人格一致：你是"${d.label}"，语气和行为要匹配
- 你的 misread 倾向：约 ${Math.round(d.misreadRate * 100)}% 的时候你会看错玩家。
  这不是 bug，是设计——不要试图每次都猜准。`;
}

export const SYSTEM_PROMPT = buildSystemPrompt(DEFAULT_DIFFICULTY);

// 解析失败后的追加强问（作为新一轮 user 消息）
const PARSE_RETRY_REMINDER = (missing) =>
    `（系统提示：你上一条回应里没能解析出${missing}。请重新回应本轮。` +
    '务必只输出一个 JSON 对象，格式为 {"taunt":"...","declared":"石头|布|剪刀|不告诉你","actual":"石头|布|剪刀"}，' +
    '不要加代码块围栏或任何额外说明。' +
    '注意：你的 actual 在宣告之后就已经锁定了，declared 和 actual 不一致是允许且鼓励的。）';

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
// 回应解析
//
// 主路径是结构化 JSON（由提示词约束），正则仅作兜底。
// 不使用 response_format 参数——DeepSeek / 智谱 / 部分代理端点支持不一致，
// 依赖它会让"换个模型就能玩"的承诺失效。
// ---------------------------------------------------------------------------

const CHOICE_KEY = { '石头': 'rock', '布': 'paper', '剪刀': 'scissors' };
const CHOICE_TEXT = { rock: '石头', paper: '布', scissors: '剪刀', secret: '不告诉你' };
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

// ---------------------------------------------------------------------------
// 结构化解析（主路径）
// ---------------------------------------------------------------------------

// 归一化拳名：模型可能回 rock / Rock / ROCK / 石头 / 石头剪刀
function normalizeChoice(v) {
    if (typeof v !== 'string') return null;
    const s = v.trim().toLowerCase();
    const map = {
        'rock': 'rock', '石头': 'rock', '拳': 'rock', 'stone': 'rock', '布': 'paper',
        'paper': 'paper', 'scissors': 'scissors', '剪刀': 'scissors', 'scissor': 'scissors',
    };
    for (const [k, val] of Object.entries(map)) {
        if (s === k || s.includes(k)) return val;
    }
    return null;
}

function normalizeDeclared(v) {
    const s = String(v || '').trim();
    if (!s) return null;
    if (SECRET_WORDS.some(w => s.includes(w))) return 'secret';
    if (/^(secret|none|hidden|null|保密)$/i.test(s)) return 'secret';
    return normalizeChoice(s);
}

// 剥掉 ```json ... ``` 围栏；模型很爱加
function stripCodeFence(text) {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    return m ? m[1].trim() : text;
}

// 截取第一个完整的 {...}，容忍模型前后说废话
function extractJsonObject(text) {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

// 主解析：先试 JSON，失败再退回正则。
// 返回 { taunt, declared, actual, source }，缺字段时对应值为 null。
export function parseAiReply(raw) {
    // --- 主路径：结构化 JSON ---
    const cleaned = stripCodeFence(raw);
    const jsonStr = extractJsonObject(cleaned);
    if (jsonStr) {
        try {
            const obj = JSON.parse(jsonStr);
            const declared = normalizeDeclared(obj.declared);
            const actual = normalizeChoice(obj.actual);
            const taunt = typeof obj.taunt === 'string' ? obj.taunt.trim() : '';
            if (declared && actual) {
                return { taunt, declared, actual, source: 'json' };
            }
            // JSON 合法但字段缺失/非法——不降级，交给上层重问
            return { taunt, declared, actual, source: 'json-partial' };
        } catch (e) {
            // 不是合法 JSON，走正则兜底
        }
    }

    // --- 兜底：正则抽取老格式 ---
    const actual = extractActual(cleaned);
    const declared = extractDeclared(cleaned);
    let taunt = cleaned;
    for (const kw of ACTUAL_CUT_KEYWORDS) {
        const i = taunt.indexOf(kw);
        if (i !== -1) taunt = taunt.substring(0, i);
    }
    taunt = taunt.replace(/[\s，,]*我\s*$/, '').trim();
    return { taunt, declared, actual, source: 'regex' };
}

// ---------------------------------------------------------------------------
// 每轮一次的 AI 决策调用（含一次格式重试）
// 返回 { taunt, declared, actual }
//
// 重要：actual 在玩家实际出拳之前即已确定——防作弊由这一调用时序保证，
// 本函数不做任何"随机替 AI 出拳"的兜底。
// 双盲承诺：declared 同样在此时锁定，但由 game.js 负责藏到揭晓才显示，
// ai.js 不做任何显示时机的事。
// ---------------------------------------------------------------------------

export async function getAiMove(settings, contextMessage, difficultyId) {
    const messages = [
        { role: 'system', content: buildSystemPrompt(difficultyId) },
        { role: 'user', content: contextMessage },
    ];

    let lastMissing = '';
    let lastRaw = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt === 1) {
            // 把模型上一条原文回灌，再追加纠正指令——比空口重问更容易纠正格式
            messages.push({ role: 'assistant', content: lastRaw });
            messages.push({ role: 'user', content: PARSE_RETRY_REMINDER(lastMissing) });
        }
        const raw = await chatCompletion(settings, messages);
        lastRaw = raw;

        const parsed = parseAiReply(raw);

        // 缺任何一项都算解析失败：绝不用 'secret' 顶替——
        // 那会把"模型没说清"伪装成"AI 选择保密"，凭空抹掉博弈信息。
        const missing = [];
        if (!parsed.actual) missing.push('实际出拳');
        if (!parsed.declared) missing.push('宣告');

        if (missing.length === 0) {
            return {
                taunt: parsed.taunt || defaultTaunt(parsed.declared),
                declared: parsed.declared,
                actual: parsed.actual,
            };
        }
        lastMissing = missing.join('与');
    }

    throw new Error(
        `AI 连续两次回应都缺少${lastMissing}。` +
        '本轮作废，请重新宣告——这通常意味着模型没遵循 JSON 格式，换个模型往往能解决'
    );
}

function defaultTaunt(declared) {
    if (declared === 'secret') return '我不告诉你我的计划。';
    return `我这轮宣告出${CHOICE_TEXT[declared] || declared}。`;
}

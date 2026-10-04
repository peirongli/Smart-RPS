// profile.js — 战绩统计与博弈画像
//
// 从 history 算出结构化事实。三个用途：
//   1. 注入 AI 上下文（game.js）
//   2. 给玩家看自己的画像（ui.js 的战绩面板）——让博弈闭环，
//      玩家能意识到"我有这个习惯"，才有反制的动力
//   3. 检测随机性：玩家掺随机时，AI 的规律分析应当失效
//
// 纯逻辑，不碰 DOM、不碰网络。

export const CHOICE_TEXT = { rock: '石头', paper: '布', scissors: '剪刀', secret: '不告诉你' };
export const CHOICES = ['rock', 'paper', 'scissors'];

// 条件模式统计的最小样本量：低于此值不报模式，
// 避免"1 次里中 100%"这种噪音结论反过来误导 AI。
//
// 5 而不是 3：3 轮里 2 轮相同就等于"67% 规律"，那是噪声不是规律。
// 读心者如果把噪声当规律报给玩家，玩家一试就发现是假的，
// 它的可信度会崩——而可信度是这个人格唯一的武器。
// 对照：CONTEXT_ROUNDS = 10，所以 5 是能在单次上下文内达到的上限附近，
// 再往上就永远报不出模式了。
export const MIN_PATTERN_SAMPLES = 5;

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
        // AI 宣告 -> 玩家实际：玩家会不会跟着 AI 的宣告走？
        // 这个最有博弈价值——如果玩家总是被 AI 的宣告带跑，
        // AI 就能反过来喂假信息。
        byAiDeclared: {
            rock: { rock: 0, paper: 0, scissors: 0 },
            paper: { rock: 0, paper: 0, scissors: 0 },
            scissors: { rock: 0, paper: 0, scissors: 0 },
        },
        // AI 宣告 -> AI 实际：AI 自己的说谎习惯（AI 也要可被玩家反向读）
        byAiLie: {
            rock: { rock: 0, paper: 0, scissors: 0 },
            paper: { rock: 0, paper: 0, scissors: 0 },
            scissors: { rock: 0, paper: 0, scissors: 0 },
        },
    };
}

function bump(bucket, key) {
    if (bucket && bucket[key] !== undefined) bucket[key]++;
}

// 统计必须是防御式的：存档可能损坏，字段可能缺失
export function tallyHistory(history) {
    const t = emptyTally();
    if (!Array.isArray(history)) return t;

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

    t.deceived = (t.declared.rock + t.declared.paper + t.declared.scissors)
        - (t.byDeclared.rock.rock + t.byDeclared.paper.paper + t.byDeclared.scissors.scissors);
    t.secrets = t.declared.secret;
    return t;
}

// 从条件计数里取众数
function topOf(row) {
    const entries = Object.entries(row);
    entries.sort((a, b) => b[1] - a[1]);
    return { key: entries[0][0], count: entries[0][1], n: row.rock + row.paper + row.scissors };
}

// 样本量越大，对 share 的要求越严。
// 3/3 = 100% 和 8/10 = 80% 都不该轻易被当成"规律"——前者样本太小，
// 后者虽然看着高但仍有 2 次反例。按样本量收紧门槛可以同时压掉这两类噪声。
function shareThreshold(n) {
    if (n >= 8) return 0.8;
    if (n >= 6) return 0.7;
    return 0.6;   // n 在 [MIN_PATTERN_SAMPLES, 6)
}

// 把条件计数转成结构化模式列表（既给 AI 用，也可展示给玩家）
export function findPatterns(t) {
    const out = [];

    // 1) 玩家的"宣告偏差"：宣告 X 时实际最常出 Y
    for (const dec of CHOICES) {
        const { key, count, n } = topOf(t.byDeclared[dec]);
        if (n < MIN_PATTERN_SAMPLES) continue;
        const share = count / n;
        if (share >= shareThreshold(n) && key !== dec) {
            out.push({
                kind: 'declareBias',
                declared: dec,
                actual: key,
                share,
                n,
                text: `你宣告${CHOICE_TEXT[dec]}时有 ${Math.round(share * 100)}% 实际出${CHOICE_TEXT[key]}`,
            });
        }
    }

    // 2) 玩家是否跟着 AI 的宣告走
    for (const dec of CHOICES) {
        const { key, count, n } = topOf(t.byAiDeclared[dec]);
        if (n < MIN_PATTERN_SAMPLES) continue;
        const share = count / n;
        if (share >= shareThreshold(n)) {
            out.push({
                kind: 'followAi',
                aiDeclared: dec,
                actual: key,
                share,
                n,
                text: `我宣告${CHOICE_TEXT[dec]}时你 ${Math.round(share * 100)}% 会出${CHOICE_TEXT[key]}——这条我可以用`,
            });
        }
    }

    // 3) AI 自己的说谎习惯：玩家也能反向读它
    let aiHonest = 0, aiDeceived = 0;
    for (const dec of CHOICES) {
        aiHonest += t.byAiLie[dec][dec];
        for (const act of CHOICES) {
            if (act !== dec) aiDeceived += t.byAiLie[dec][act];
        }
    }
    const aiTotal = aiHonest + aiDeceived;
    if (aiTotal >= MIN_PATTERN_SAMPLES) {
        if (aiDeceived / aiTotal >= 0.6) {
            out.push({
                kind: 'aiLiar',
                share: aiDeceived / aiTotal,
                n: aiTotal,
                text: '我自己的宣告也不可信，别只盯着我说了什么',
            });
        } else if (aiHonest / aiTotal >= 0.6) {
            out.push({
                kind: 'aiHonest',
                share: aiHonest / aiTotal,
                n: aiTotal,
                text: '我最近基本说实话，代价是你现在知道这一点了',
            });
        }
    }

    return out;
}

export function describePatterns(t) {
    return findPatterns(t).map(p => p.text);
}

// 随机性检测：玩家出拳分布是否已经均匀到让规律分析失效。
// 返回 null 表示分布仍然集中；返回 {maxShare, verdict} 表示已均匀。
//
// 阈值 0.50 的来由（模拟 10 万次、30 轮三拳均匀随机得出）：
//   纯随机时最大拳占比的中位数是 40%，75 分位 46.7%，95 分位 53.3%。
//   若取 0.45，约 40% 的真随机玩家会被误判成"还在用规律"——
//   而这类误判会让读心者宣称自己看穿了，实际却在瞎猜，可信度会崩。
//   取 0.50 时误判降到约 11%，同时真正高度集中的玩家（>50%）仍能被判出。
export const RANDOMIZED_THRESHOLD = 0.5;

export function checkRandomized(t) {
    const total = CHOICES.reduce((sum, c) => sum + t.actual[c], 0);
    if (total < MIN_PATTERN_SAMPLES) return null; // 样本太少，不下结论
    const maxShare = Math.max(...CHOICES.map(c => t.actual[c])) / total;
    if (maxShare >= RANDOMIZED_THRESHOLD) return null;
    return { maxShare, total, verdict: 'randomized' };
}

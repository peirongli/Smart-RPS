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
export const MIN_PATTERN_SAMPLES = 3;

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

// 把条件计数转成结构化模式列表（既给 AI 用，也可展示给玩家）
export function findPatterns(t) {
    const out = [];

    // 1) 玩家的"宣告偏差"：宣告 X 时实际最常出 Y
    for (const dec of CHOICES) {
        const { key, count, n } = topOf(t.byDeclared[dec]);
        if (n < MIN_PATTERN_SAMPLES) continue;
        const share = count / n;
        if (share >= 0.6 && key !== dec) {
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
        if (share >= 0.6) {
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
export function checkRandomized(t) {
    const total = CHOICES.reduce((sum, c) => sum + t.actual[c], 0);
    if (total < 6) return null; // 样本太少，不下结论
    const maxShare = Math.max(...CHOICES.map(c => t.actual[c])) / total;
    if (maxShare >= 0.45) return null;
    return { maxShare, total, verdict: 'randomized' };
}

/**
 * 文案禁用词校验器（施工方案 §9.3 / §10.3、CONTRACT DATA 节）
 *
 * 生物与景观文案统一使用「通常有机会观察到」级别的概率性表达；
 * 禁止固定概率（概率 xx%、百分之百）与必然性文案（必然、一定能看到、保证看到等）。
 * findForbiddenCopy 返回命中的违规描述数组，空数组 = 通过。
 */

interface ForbiddenPattern {
  /** 违规类别标识（用于报错信息） */
  id: string;
  pattern: RegExp;
}

const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
  { id: "必然", pattern: /必然/g },
  { id: "一定能看到", pattern: /一定能看到/g },
  { id: "一定能遇到", pattern: /一定能遇到/g },
  { id: "一定能观察到", pattern: /一定能观察到/g },
  { id: "100%", pattern: /100\s*%/g },
  { id: "百分之百", pattern: /百分之百/g },
  { id: "百分之…（固定概率）", pattern: /百分之[一二三四五六七八九十百千万零〇0-9]+/g },
  { id: "概率 xx%（固定概率）", pattern: /概率\s*[约达高达]?\s*\d+(?:\.\d+)?\s*%/g },
  { id: "出现率 xx%（固定概率）", pattern: /(?:出现率|看到率|遇见率|目击率)\s*[约达高达]?\s*\d+(?:\.\d+)?\s*%/g },
  { id: "保证看到", pattern: /保证看到/g },
  { id: "保证能", pattern: /保证能/g },
  { id: "肯定会遇到", pattern: /肯定会遇到/g },
  { id: "肯定会看到", pattern: /肯定会看到/g },
];

/**
 * 扫描文本中的禁用文案。
 * @returns 命中描述数组，形如「必然（…上下文…）」；空数组 = 通过
 */
export function findForbiddenCopy(text: string): string[] {
  if (!text) return [];
  const hits: string[] = [];
  for (const { id, pattern } of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = Math.max(0, match.index - 8);
      const end = Math.min(text.length, match.index + match[0].length + 8);
      const context = text.slice(start, end).replace(/\s+/g, " ");
      hits.push(`${id}（…${context}…）`);
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }
  return hits;
}

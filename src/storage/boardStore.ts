import { seedCases } from "../data/seed";
import type { ConsentCase } from "../domain/types";

const STORAGE_KEY = "hxwl04.consent-board.v1";

/** 读取看板；无存档或数据损坏时回退到示例数据 */
export function loadCases(): ConsentCase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedCases();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return seedCases();
    return parsed as ConsentCase[];
  } catch {
    return seedCases();
  }
}

export function saveCases(cases: ConsentCase[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  } catch {
    // 存储不可用时静默失败，页面内状态仍可用
  }
}

export function resetCases(): ConsentCase[] {
  const fresh = seedCases();
  saveCases(fresh);
  return fresh;
}

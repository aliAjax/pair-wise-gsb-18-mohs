// 存储层：localStorage 仓储。仅负责持久化与结构校验，不含业务判断。
import { createSeedState } from "../data/seed";
import type { DeskState } from "../data/types";

const STORAGE_KEY = "hxwl-04.consent-desk.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 轻量结构校验：损坏或版本不符时回退种子数据，避免页面白屏 */
export function validateState(value: unknown): value is DeskState {
  if (!isRecord(value)) return false;
  if (typeof value.schemaVersion !== "number") return false;
  if (!Array.isArray(value.patients) || !Array.isArray(value.consents))
    return false;
  return value.consents.every(
    (consent) =>
      isRecord(consent) &&
      typeof consent.id === "string" &&
      typeof consent.patientId === "string" &&
      typeof consent.tooth === "string" &&
      Array.isArray(consent.versions) &&
      Array.isArray(consent.plannedProcedures) &&
      Array.isArray(consent.procedureLog),
  );
}

export const consentRepository = {
  load(): DeskState {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return createSeedState();
      const parsed: unknown = JSON.parse(raw);
      if (validateState(parsed)) return parsed;
      console.warn("知情同意数据结构无效，已回退为初始数据。");
      return createSeedState();
    } catch (error) {
      console.warn("读取本地知情同意数据失败：", error);
      return createSeedState();
    }
  },

  save(state: DeskState): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("知情同意数据保存失败：", error);
    }
  },

  reset(): DeskState {
    const seed = createSeedState();
    this.save(seed);
    return seed;
  },
};

// 判断层：纯函数领域规则。所有“能不能做”的判断集中在这里，UI 与存储不重复实现。
import { RISK_ITEMS } from "../data/catalog";
import type {
  ConsentVersion,
  ProcedureEntry,
  RiskConfirmations,
  ToothConsent,
} from "../data/types";

export type ConsentStatus =
  | "unsigned" // 从未签署
  | "stale" // 已签署，但计划已变化，待重新确认
  | "signed" // 已签署且与当前计划一致
  | "revoked"; // 最新版本为撤销

export const STATUS_META: Record<
  ConsentStatus,
  { label: string; tone: "neutral" | "warn" | "ok" | "danger" }
> = {
  unsigned: { label: "未签署", tone: "neutral" },
  stale: { label: "待重新确认", tone: "warn" },
  signed: { label: "已签署", tone: "ok" },
  revoked: { label: "已撤销", tone: "danger" },
};

export function latestVersion(consent: ToothConsent): ConsentVersion | null {
  return consent.versions.length
    ? consent.versions[consent.versions.length - 1]
    : null;
}

export function latestSignedVersion(
  consent: ToothConsent,
): ConsentVersion | null {
  for (let i = consent.versions.length - 1; i >= 0; i -= 1) {
    const version = consent.versions[i];
    if (version.kind !== "revocation") return version;
  }
  return null;
}

export function isRevoked(consent: ToothConsent): boolean {
  return latestVersion(consent)?.kind === "revocation";
}

export function samePlan(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((code, index) => code === sortedB[index]);
}

/** 计划是否与最新签署版本不一致（含尚未保存的待确认变化） */
export function planMismatch(consent: ToothConsent): boolean {
  const signed = latestSignedVersion(consent);
  if (!signed) return false;
  return !samePlan(signed.planSnapshot, consent.plannedProcedures);
}

export function consentStatus(consent: ToothConsent): ConsentStatus {
  const latest = latestVersion(consent);
  if (!latest) return "unsigned";
  if (latest.kind === "revocation") return "revoked";
  return planMismatch(consent) ? "stale" : "signed";
}

export function missingRisks(riskConfirmed: RiskConfirmations): string[] {
  return RISK_ITEMS.filter((item) => !riskConfirmed[item.id]).map(
    (item) => item.short,
  );
}

export interface GateResult {
  ok: boolean;
  reason: string | null;
}

/** 开髓 / 充填登记前的强制核对：同意书未确认前一律拒绝 */
export function canRegisterStep(
  consent: ToothConsent,
  stepCode: string,
): GateResult {
  const status = consentStatus(consent);
  if (status === "unsigned") {
    return { ok: false, reason: "尚未签署知情同意书，请先完成签署。" };
  }
  if (status === "revoked") {
    return { ok: false, reason: "同意书已撤销，需补签后才能登记操作。" };
  }
  if (status === "stale") {
    return {
      ok: false,
      reason: "治疗计划已变化，需重新签署确认后才能登记操作。",
    };
  }
  const signed = latestSignedVersion(consent);
  if (!signed || !signed.riskConfirmed) {
    return { ok: false, reason: "签署记录缺少风险确认，无法登记。" };
  }
  const missing = missingRisks(signed.riskConfirmed);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `风险确认不完整（缺：${missing.join("、")}），需补签。`,
    };
  }
  if (
    stepCode === "obturation" &&
    !consent.procedureLog.some((entry) => entry.code === "access")
  ) {
    return { ok: false, reason: "该牙位尚未登记开髓，不能直接登记充填。" };
  }
  return { ok: true, reason: null };
}

export function hasProcedure(consent: ToothConsent, code: string): boolean {
  return consent.procedureLog.some((entry) => entry.code === code);
}

export function sortedLog(consent: ToothConsent): ProcedureEntry[] {
  return [...consent.procedureLog].sort((a, b) => a.at.localeCompare(b.at));
}

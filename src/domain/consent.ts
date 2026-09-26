import type {
  ChangeKind,
  ConsentCase,
  ConsentVersion,
  ProcedureRecord,
  RiskKey,
  TreatmentPlan,
  VersionSnapshot,
} from "./types";

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function resetRisks(): Record<RiskKey, boolean> {
  return { pain: false, instrument: false, failure: false, cost: false };
}

/** 当前版本永远是数组最后一版；superseded / revoked 只会出现在历史版本上 */
export function currentVersion(c: ConsentCase): ConsentVersion {
  return c.versions[c.versions.length - 1];
}

export function allRisksConfirmed(v: ConsentVersion): boolean {
  return Object.values(v.risks).every(Boolean);
}

/** 签署前还缺什么，用于门控提示 */
export function missingForSign(v: ConsentVersion): string[] {
  const missing: string[] = [];
  if (!allRisksConfirmed(v)) missing.push("四项风险需全部确认");
  if (!v.signerName.trim()) missing.push("请填写签署人 / 代办人");
  if (!v.signedAt) missing.push("请选择签署日期");
  if (v.plan.items.length === 0) missing.push("治疗计划至少包含一个项目");
  return missing;
}

export function canSign(v: ConsentVersion): boolean {
  return v.status === "draft" && missingForSign(v).length === 0;
}

export function canLock(c: ConsentCase): boolean {
  return currentVersion(c).status === "signed";
}

/** 未确认（或已锁定）前不能登记开髓 / 充填 */
export function canRegisterProcedure(c: ConsentCase): { ok: boolean; reason: string } {
  const cur = currentVersion(c);
  if (cur.status === "signed") return { ok: true, reason: "" };
  if (cur.status === "locked") {
    return { ok: false, reason: "同意书已锁定，治疗已完成，不能再登记处置。" };
  }
  return {
    ok: false,
    reason: `当前第 ${cur.version} 版尚未确认签署，不能登记开髓或充填。`,
  };
}

export function planChanged(a: TreatmentPlan, b: TreatmentPlan): boolean {
  const items = (p: TreatmentPlan) => [...p.items].sort().join("|");
  return a.tooth !== b.tooth || a.note !== b.note || items(a) !== items(b);
}

/** 旧值快照，随撤销 / 补签 / 更正 / 计划变更产生的新版本一起保留 */
export function snapshotOf(v: ConsentVersion): VersionSnapshot {
  return {
    plan: { ...v.plan, items: [...v.plan.items] },
    signerName: v.signerName,
    signerRelation: v.signerRelation,
    signedAt: v.signedAt,
    risks: { ...v.risks },
  };
}

function replaceCurrent(c: ConsentCase, next: ConsentVersion): ConsentCase {
  return { ...c, versions: [...c.versions.slice(0, -1), next] };
}

export type DraftPatch = Partial<
  Pick<ConsentVersion, "plan" | "signerName" | "signerRelation" | "signedAt" | "risks">
>;

/** 只有草稿版可以编辑；签署后内容即不可改 */
export function updateDraft(c: ConsentCase, patch: DraftPatch): ConsentCase {
  const cur = currentVersion(c);
  if (cur.status !== "draft") return c;
  return replaceCurrent(c, { ...cur, ...patch });
}

export function signCurrent(c: ConsentCase): ConsentCase {
  const cur = currentVersion(c);
  if (!canSign(cur)) return c;
  return replaceCurrent(c, { ...cur, status: "signed" });
}

/** 完成后锁定内容 */
export function lockCurrent(c: ConsentCase): ConsentCase {
  const cur = currentVersion(c);
  if (cur.status !== "signed") return c;
  return replaceCurrent(c, { ...cur, status: "locked" });
}

/**
 * 计划变化、撤销、补签、更正：归档当前版并新建草稿版。
 * 新版保留原因与旧值快照，四项风险重置，必须重新确认并签署。
 */
export function revise(
  c: ConsentCase,
  kind: ChangeKind,
  reason: string,
  nextPlan?: TreatmentPlan
): ConsentCase {
  const cur = currentVersion(c);
  if (cur.status !== "signed" && cur.status !== "locked") return c;
  if (!reason.trim()) return c;
  if (kind === "plan-change" && (!nextPlan || !planChanged(cur.plan, nextPlan))) return c;

  const archived: ConsentVersion = {
    ...cur,
    status: kind === "revoke" ? "revoked" : "superseded",
  };
  const draft: ConsentVersion = {
    id: uid(),
    version: cur.version + 1,
    status: "draft",
    plan: nextPlan
      ? { ...nextPlan, items: [...nextPlan.items] }
      : { ...cur.plan, items: [...cur.plan.items] },
    signerName: cur.signerName,
    signerRelation: cur.signerRelation,
    signedAt: null,
    risks: resetRisks(),
    createdAt: today(),
    changeKind: kind,
    changeReason: reason.trim(),
    previousValues: snapshotOf(cur),
  };
  return { ...c, versions: [...c.versions.slice(0, -1), archived, draft] };
}

export function registerProcedure(c: ConsentCase, kind: "开髓" | "充填"): ConsentCase {
  if (!canRegisterProcedure(c).ok) return c;
  const record: ProcedureRecord = {
    id: uid(),
    kind,
    at: today(),
    version: currentVersion(c).version,
  };
  return { ...c, procedures: [...c.procedures, record] };
}

export function createCase(patientName: string, recordNo: string, tooth: string): ConsentCase {
  const first: ConsentVersion = {
    id: uid(),
    version: 1,
    status: "draft",
    plan: { tooth, items: [], note: "" },
    signerName: "",
    signerRelation: "本人",
    signedAt: null,
    risks: resetRisks(),
    createdAt: today(),
  };
  return {
    id: uid(),
    patientName: patientName.trim(),
    recordNo: recordNo.trim(),
    versions: [first],
    procedures: [],
  };
}

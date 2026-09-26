// 判断层：状态迁移（reducer）。所有写入都经过这里，版本只追加、旧版本锁定不改写。
import { GATED_STEPS, PLAN_LABELS, RELATIONS, RISK_ITEMS } from "../data/catalog";
import type {
  ConsentVersion,
  DeskState,
  FieldChange,
  SignPayload,
  ToothConsent,
} from "../data/types";
import { uid } from "../lib/util";
import {
  canRegisterStep,
  consentStatus,
  isRevoked,
  latestSignedVersion,
  latestVersion,
  missingRisks,
  planMismatch,
  samePlan,
} from "./policy";

export type DeskAction =
  | {
      type: "addConsent";
      patientName: string;
      recordNo: string;
      tooth: string;
      diagnosis: string;
      plannedProcedures: string[];
    }
  | {
      type: "changePlan";
      consentId: string;
      nextPlan: string[];
      reason: string;
      changedBy: string;
    }
  | { type: "sign"; consentId: string; payload: SignPayload }
  | {
      type: "correct";
      consentId: string;
      reason: string;
      fields: {
        signDate: string;
        signerName: string;
        signerRelation: string;
        agentName: string;
      };
    }
  | { type: "revoke"; consentId: string; reason: string }
  | {
      type: "registerStep";
      consentId: string;
      code: string;
      operator: string;
      note?: string;
    };

function fail(message: string): never {
  throw new Error(message);
}

function findConsent(state: DeskState, consentId: string): ToothConsent {
  const consent = state.consents.find((item) => item.id === consentId);
  if (!consent) fail("找不到对应的知情同意记录。");
  return consent;
}

function replaceConsent(
  state: DeskState,
  updated: ToothConsent,
): DeskState {
  return {
    ...state,
    consents: state.consents.map((item) =>
      item.id === updated.id ? updated : item,
    ),
  };
}

function assertReason(reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) fail("请填写原因，留痕需要。");
  return trimmed;
}

function assertSignPayload(payload: SignPayload): SignPayload {
  const cleaned: SignPayload = {
    ...payload,
    signDate: payload.signDate.trim(),
    signerName: payload.signerName.trim(),
    signerRelation: payload.signerRelation.trim(),
    agentName: payload.agentName.trim(),
    reason: payload.reason.trim(),
  };
  if (!cleaned.signDate) fail("请选择签署日期。");
  if (!cleaned.signerName) fail("请填写签署人姓名。");
  if (!cleaned.signerRelation) fail("请选择与患者关系。");
  if (!RELATIONS.includes(cleaned.signerRelation))
    fail("与患者关系不在允许范围内。");
  if (!cleaned.agentName) fail("请填写代办人（经办助理）。");
  const missing = missingRisks(cleaned.riskConfirmed);
  if (missing.length > 0)
    fail(`四项风险需全部确认，缺少：${missing.join("、")}。`);
  return cleaned;
}

function nextVersionNumber(consent: ToothConsent): number {
  return consent.versions.length + 1;
}

function planChanges(
  oldPlan: string[],
  newPlan: string[],
): FieldChange[] {
  if (samePlan(oldPlan, newPlan)) return [];
  const label = (codes: string[]) =>
    codes.map((code) => PLAN_LABELS[code] ?? code).join("、") || "（空）";
  return [
    {
      field: "plan",
      label: "治疗计划",
      oldValue: label(oldPlan),
      newValue: label(newPlan),
    },
  ];
}

// ---------- 各动作的迁移 ----------

function applyAddConsent(
  state: DeskState,
  action: Extract<DeskAction, { type: "addConsent" }>,
): DeskState {
  const patientName = action.patientName.trim();
  const recordNo = action.recordNo.trim();
  const tooth = action.tooth.trim();
  if (!patientName) fail("请填写患者姓名。");
  if (!recordNo) fail("请填写病历号。");
  if (!/^\d{2}$/.test(tooth)) fail("牙位需为两位 FDI 编号，如 36、11。");
  if (action.plannedProcedures.length === 0)
    fail("请至少选择一项治疗计划。");

  let patients = state.patients;
  let patient = patients.find(
    (item) => item.recordNo === recordNo || item.name === patientName,
  );
  if (!patient) {
    patient = { id: uid("pat"), name: patientName, recordNo };
    patients = [...patients, patient];
  }
  const duplicated = state.consents.some(
    (item) => item.patientId === patient!.id && item.tooth === tooth,
  );
  if (duplicated) fail(`患者 ${patient.name} 的 ${tooth} 牙已存在同意书。`);

  const consent: ToothConsent = {
    id: uid("consent"),
    patientId: patient.id,
    tooth,
    diagnosis: action.diagnosis.trim() || "待补充诊断",
    plannedProcedures: [...action.plannedProcedures],
    versions: [],
    pendingChange: null,
    procedureLog: [],
    createdAt: new Date().toISOString(),
  };
  return { ...state, patients, consents: [...state.consents, consent] };
}

function applyChangePlan(
  state: DeskState,
  action: Extract<DeskAction, { type: "changePlan" }>,
): DeskState {
  const consent = findConsent(state, action.consentId);
  const reason = assertReason(action.reason);
  const changedBy = action.changedBy.trim();
  if (!changedBy) fail("请填写调整人。");
  if (action.nextPlan.length === 0) fail("治疗计划不能为空。");
  if (samePlan(consent.plannedProcedures, action.nextPlan))
    fail("计划没有变化，无需提交。");
  if (isRevoked(consent))
    fail("同意书已撤销，请先补签恢复，再调整计划。");

  const updated: ToothConsent = {
    ...consent,
    plannedProcedures: [...action.nextPlan],
    pendingChange: {
      previousPlan: [...consent.plannedProcedures],
      nextPlan: [...action.nextPlan],
      reason,
      changedAt: new Date().toISOString(),
      changedBy,
    },
  };
  return replaceConsent(state, updated);
}

function applySign(
  state: DeskState,
  action: Extract<DeskAction, { type: "sign" }>,
): DeskState {
  const consent = findConsent(state, action.consentId);
  const status = consentStatus(consent);
  if (status === "signed") fail("当前版本已签署且与计划一致，无需重复签署。");

  const payload = assertSignPayload(action.payload);
  const kind: ConsentVersion["kind"] =
    status === "unsigned"
      ? "initial"
      : status === "revoked"
        ? "resign"
        : "plan-change";
  if (kind !== "initial" && !payload.reason)
    fail("计划变更重签 / 补签必须填写原因。");

  const signed = latestSignedVersion(consent);
  const latest = latestVersion(consent);
  const changes: FieldChange[] = signed
    ? planChanges(signed.planSnapshot, consent.plannedProcedures)
    : [];
  // 补签紧跟撤销版本，来源指向撤销版；计划变更重签来源为最新签署版
  const sourceVersion =
    kind === "resign"
      ? latest
        ? latest.version
        : null
      : signed
        ? signed.version
        : null;

  const version: ConsentVersion = {
    version: nextVersionNumber(consent),
    kind,
    reason: payload.reason || "首次签署",
    createdAt: new Date().toISOString(),
    signDate: payload.signDate,
    signerName: payload.signerName,
    signerRelation: payload.signerRelation,
    agentName: payload.agentName,
    riskConfirmed: { ...payload.riskConfirmed },
    planSnapshot: [...consent.plannedProcedures],
    changes,
    sourceVersion,
    locked: true,
  };
  const updated: ToothConsent = {
    ...consent,
    versions: [...consent.versions, version],
    pendingChange: null,
  };
  return replaceConsent(state, updated);
}

function applyCorrect(
  state: DeskState,
  action: Extract<DeskAction, { type: "correct" }>,
): DeskState {
  const consent = findConsent(state, action.consentId);
  const reason = assertReason(action.reason);
  const signed = latestSignedVersion(consent);
  if (!signed) fail("尚无已签署版本，无法更正，请直接签署。");
  if (isRevoked(consent)) fail("同意书已撤销，请先补签，再更正。");

  const fields = {
    signDate: action.fields.signDate.trim(),
    signerName: action.fields.signerName.trim(),
    signerRelation: action.fields.signerRelation.trim(),
    agentName: action.fields.agentName.trim(),
  };
  if (!fields.signDate) fail("请选择签署日期。");
  if (!fields.signerName) fail("请填写签署人姓名。");
  if (!fields.signerRelation) fail("请选择与患者关系。");
  if (!RELATIONS.includes(fields.signerRelation))
    fail("与患者关系不在允许范围内。");
  if (!fields.agentName) fail("请填写代办人（经办助理）。");

  const changes: FieldChange[] = [];
  const push = (
    field: string,
    label: string,
    oldValue: string | null,
    newValue: string,
  ) => {
    if ((oldValue ?? "") !== newValue)
      changes.push({ field, label, oldValue: oldValue ?? "（空）", newValue });
  };
  push("signDate", "签署日期", signed.signDate, fields.signDate);
  push("signerName", "签署人", signed.signerName, fields.signerName);
  push("signerRelation", "与患者关系", signed.signerRelation, fields.signerRelation);
  push("agentName", "代办人", signed.agentName, fields.agentName);
  changes.push(...planChanges(signed.planSnapshot, consent.plannedProcedures));
  if (changes.length === 0) fail("内容没有变化，无需更正。");

  const version: ConsentVersion = {
    version: nextVersionNumber(consent),
    kind: "correction",
    reason,
    createdAt: new Date().toISOString(),
    signDate: fields.signDate,
    signerName: fields.signerName,
    signerRelation: fields.signerRelation,
    agentName: fields.agentName,
    // 更正沿用已确认的四项风险；计划若同时变化，也会随快照重新锁定
    riskConfirmed: signed.riskConfirmed ? { ...signed.riskConfirmed } : null,
    planSnapshot: [...consent.plannedProcedures],
    changes,
    sourceVersion: signed.version,
    locked: true,
  };
  const updated: ToothConsent = {
    ...consent,
    versions: [...consent.versions, version],
    pendingChange: null,
  };
  return replaceConsent(state, updated);
}

function applyRevoke(
  state: DeskState,
  action: Extract<DeskAction, { type: "revoke" }>,
): DeskState {
  const consent = findConsent(state, action.consentId);
  const reason = assertReason(action.reason);
  const signed = latestSignedVersion(consent);
  if (!signed) fail("尚未签署，无需撤销。");
  if (isRevoked(consent)) fail("当前已处于撤销状态。");

  const version: ConsentVersion = {
    version: nextVersionNumber(consent),
    kind: "revocation",
    reason,
    createdAt: new Date().toISOString(),
    signDate: null,
    signerName: "",
    signerRelation: "",
    agentName: "",
    riskConfirmed: null,
    // 保留撤销时点锁定的计划与签署内容，便于追溯
    planSnapshot: [...consent.plannedProcedures],
    changes: [],
    sourceVersion: signed.version,
    locked: true,
  };
  const updated: ToothConsent = {
    ...consent,
    versions: [...consent.versions, version],
    pendingChange: null,
  };
  return replaceConsent(state, updated);
}

function applyRegisterStep(
  state: DeskState,
  action: Extract<DeskAction, { type: "registerStep" }>,
): DeskState {
  const consent = findConsent(state, action.consentId);
  const operator = action.operator.trim();
  if (!operator) fail("请填写操作人。");

  // 开髓 / 充填：未确认前一律禁止登记
  if (GATED_STEPS.includes(action.code)) {
    const gate = canRegisterStep(consent, action.code);
    if (!gate.ok) fail(gate.reason ?? "当前状态不允许登记该步骤。");
  }

  const updated: ToothConsent = {
    ...consent,
    procedureLog: [
      ...consent.procedureLog,
      {
        id: uid("proc"),
        code: action.code,
        at: new Date().toISOString(),
        operator,
        note: action.note?.trim() || undefined,
      },
    ],
  };
  return replaceConsent(state, updated);
}

export function deskReducer(state: DeskState, action: DeskAction): DeskState {
  switch (action.type) {
    case "addConsent":
      return applyAddConsent(state, action);
    case "changePlan":
      return applyChangePlan(state, action);
    case "sign":
      return applySign(state, action);
    case "correct":
      return applyCorrect(state, action);
    case "revoke":
      return applyRevoke(state, action);
    case "registerStep":
      return applyRegisterStep(state, action);
    default:
      return state;
  }
}

/** 供 UI 预判签署弹窗类型（与 applySign 内部判断保持一致） */
export function signKindFor(
  consent: ToothConsent,
): "initial" | "plan-change" | "resign" {
  const status = consentStatus(consent);
  if (status === "unsigned") return "initial";
  if (status === "revoked") return "resign";
  return "plan-change";
}


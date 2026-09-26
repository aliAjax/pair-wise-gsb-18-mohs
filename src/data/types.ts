// 资料层：领域类型定义（不包含任何判断逻辑与存储逻辑）

export type RiskId = "anesthesia" | "instrument" | "postop" | "outcome";

/** 四项风险确认：每项必须单独勾选 */
export type RiskConfirmations = Record<RiskId, boolean>;

/** 版本类型：首签 / 计划变更重签 / 补签 / 更正 / 撤销 */
export type VersionKind =
  | "initial"
  | "plan-change"
  | "resign"
  | "correction"
  | "revocation";

/** 字段级留痕：更正、计划变更时保留旧值与新值 */
export interface FieldChange {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

/**
 * 知情同意书版本。版本只追加、不改写：
 * 一旦生成即锁定（locked），撤销 / 补签 / 更正都通过新增版本实现。
 */
export interface ConsentVersion {
  version: number;
  kind: VersionKind;
  /** 新建版本的原因（首签除外均必填） */
  reason: string;
  /** 版本生成时间（系统时间，ISO） */
  createdAt: string;
  /** 签署日期（业务日期，YYYY-MM-DD） */
  signDate: string | null;
  /** 签署人姓名（患者本人或受托人） */
  signerName: string;
  /** 与患者关系 */
  signerRelation: string;
  /** 代办人 / 经办助理（取得并核对签字的工作人员） */
  agentName: string;
  /** 四项风险确认；撤销版本为 null */
  riskConfirmed: RiskConfirmations | null;
  /** 签署时锁定的治疗计划快照（项目代码） */
  planSnapshot: string[];
  /** 相对上一版本的字段变化与旧值 */
  changes: FieldChange[];
  sourceVersion: number | null;
  locked: true;
}

/** 尚未重新签署确认的计划变化 */
export interface PendingPlanChange {
  previousPlan: string[];
  nextPlan: string[];
  reason: string;
  changedAt: string;
  changedBy: string;
}

/** 诊疗登记记录（开髓 / 测长 / 封药 / 充填），同样只追加 */
export interface ProcedureEntry {
  id: string;
  code: string;
  at: string;
  operator: string;
  note?: string;
}

/** 一份同意书 = 一位患者的一颗牙 */
export interface ToothConsent {
  id: string;
  patientId: string;
  /** FDI 牙位，如 36、11 */
  tooth: string;
  diagnosis: string;
  /** 当前治疗计划（项目代码），与最新签署版本快照比对 */
  plannedProcedures: string[];
  versions: ConsentVersion[];
  pendingChange: PendingPlanChange | null;
  procedureLog: ProcedureEntry[];
  createdAt: string;
}

export interface Patient {
  id: string;
  name: string;
  recordNo: string;
}

export interface DeskState {
  schemaVersion: number;
  patients: Patient[];
  consents: ToothConsent[];
}

/** 签署提交内容（首签 / 计划变更重签 / 补签共用） */
export interface SignPayload {
  signDate: string;
  signerName: string;
  signerRelation: string;
  agentName: string;
  riskConfirmed: RiskConfirmations;
  reason: string;
}

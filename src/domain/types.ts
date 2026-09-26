/** 四项风险确认的键 */
export type RiskKey = "pain" | "instrument" | "failure" | "cost";

/** 同意书版本状态：草稿 → 已签署 → 已锁定；被替代 / 已撤销为归档态 */
export type VersionStatus = "draft" | "signed" | "locked" | "superseded" | "revoked";

/** 触发新建版本的原因类型 */
export type ChangeKind = "plan-change" | "revoke" | "supplement" | "correct";

/** 治疗计划（随版本快照，换牙位或加做项目即构成计划变化） */
export interface TreatmentPlan {
  tooth: string;
  items: string[];
  note: string;
}

/** 被替代版本的旧值快照，随新版本一起保留 */
export interface VersionSnapshot {
  plan: TreatmentPlan;
  signerName: string;
  signerRelation: string;
  signedAt: string | null;
  risks: Record<RiskKey, boolean>;
}

export interface ConsentVersion {
  id: string;
  version: number;
  status: VersionStatus;
  plan: TreatmentPlan;
  /** 签署人 / 代办人姓名 */
  signerName: string;
  /** 与患者关系（本人、父母、配偶……） */
  signerRelation: string;
  signedAt: string | null;
  risks: Record<RiskKey, boolean>;
  createdAt: string;
  changeKind?: ChangeKind;
  changeReason?: string;
  previousValues?: VersionSnapshot;
}

/** 开髓 / 充填登记，记录依据的同意书版本 */
export interface ProcedureRecord {
  id: string;
  kind: "开髓" | "充填";
  at: string;
  version: number;
}

/** 一个患者 × 一个牙位的一份核对档案 */
export interface ConsentCase {
  id: string;
  patientName: string;
  recordNo: string;
  versions: ConsentVersion[];
  procedures: ProcedureRecord[];
}

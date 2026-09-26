// 资料层：固定目录（四项风险、治疗计划项目、可登记步骤、关系）
import type { RiskId } from "./types";

export interface RiskItem {
  id: RiskId;
  short: string;
  title: string;
  detail: string;
}

/** 根管治疗知情同意：四项必须逐项确认的风险 */
export const RISK_ITEMS: RiskItem[] = [
  {
    id: "anesthesia",
    short: "麻醉与全身风险",
    title: "麻醉及全身反应",
    detail:
      "已知晓局部麻醉可能出现疼痛、过敏、晕厥等反应，既往药物过敏史与全身病史已如实告知医生。",
  },
  {
    id: "instrument",
    short: "解剖与器械风险",
    title: "根管解剖变异、器械分离与穿孔",
    detail:
      "已知晓根管可能钙化、弯曲或解剖变异，术中可能发生器械分离、台阶、穿孔、侧穿，必要时需加做显微根管治疗、根尖手术甚至拔除。",
  },
  {
    id: "postop",
    short: "术后反应",
    title: "术后疼痛、肿胀与复诊",
    detail:
      "已知晓治疗后可能出现疼痛、肿胀、咬合不适等反应，需遵医嘱用药并按时复诊处理。",
  },
  {
    id: "outcome",
    short: "疗效与后续修复",
    title: "治疗失败、再治疗与冠修复",
    detail:
      "已知晓根管治疗存在失败、需再治疗或拔除的可能；患牙易折裂，通常需行桩核及冠修复，相关费用与复诊安排已告知。",
  },
];

export const RISK_IDS = RISK_ITEMS.map((item) => item.id);

export interface PlanItem {
  code: string;
  label: string;
  hint?: string;
}

/** 治疗计划目录；“显微根管治疗”属于必须重新确认的项目变化 */
export const PLAN_ITEMS: PlanItem[] = [
  { code: "access", label: "开髓" },
  { code: "shaping", label: "根管预备与测长" },
  { code: "medicate", label: "根管封药" },
  { code: "obturation", label: "根管充填" },
  { code: "microscope", label: "显微根管治疗", hint: "加做需重新确认" },
  { code: "postcore", label: "桩核 / 冠修复" },
];

export const PLAN_LABELS: Record<string, string> = Object.fromEntries(
  PLAN_ITEMS.map((item) => [item.code, item.label]),
);

/** 可在诊疗台登记的步骤；开髓与充填受同意书状态强制管控 */
export const STEP_ITEMS: PlanItem[] = [
  { code: "access", label: "开髓" },
  { code: "measure", label: "测长 / 工作长度" },
  { code: "medicate", label: "封药" },
  { code: "obturation", label: "充填" },
];

export const STEP_LABELS: Record<string, string> = Object.fromEntries(
  STEP_ITEMS.map((item) => [item.code, item.label]),
);

/** 需要强制核对同意书才能登记的步骤 */
export const GATED_STEPS = ["access", "obturation"];

export const RELATIONS = ["本人", "配偶", "父母", "子女", "法定监护人", "其他亲属"];

export const VERSION_KIND_LABELS: Record<string, string> = {
  initial: "首签",
  "plan-change": "计划变更重签",
  resign: "补签",
  correction: "更正",
  revocation: "撤销",
};

export function planLabels(codes: string[]): string {
  return codes.map((code) => PLAN_LABELS[code] ?? code).join("、");
}

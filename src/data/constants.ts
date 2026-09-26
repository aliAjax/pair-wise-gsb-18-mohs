import type { ChangeKind, RiskKey, VersionStatus } from "../domain/types";

/** 四项风险确认项 */
export const RISK_ITEMS: { key: RiskKey; label: string; detail: string }[] = [
  { key: "pain", label: "术后反应", detail: "术后可能出现疼痛、肿胀、咬合不适等反应，通常可自行缓解或需对症处理。" },
  { key: "instrument", label: "器械与穿孔", detail: "根管细小钙化时可能发生器械分离、根管侧穿、台阶形成等并发症。" },
  { key: "failure", label: "疗效不确定", detail: "存在治疗失败、炎症复发的可能，必要时需再治疗、根尖手术或拔除患牙。" },
  { key: "cost", label: "费用与疗程", detail: "复诊次数与费用可能随病情调整，加做显微治疗等项目将另行计费。" },
];

/** 治疗计划可选项目 */
export const PLAN_ITEMS = ["开髓", "根管预备", "封药", "充填", "显微治疗"];

/** FDI 牙位（恒牙） */
export const TEETH: string[] = [1, 2, 3, 4].flatMap((q) =>
  [1, 2, 3, 4, 5, 6, 7, 8].map((t) => `${q}${t}`)
);

export const SIGNER_RELATIONS = ["本人", "父母", "配偶", "子女", "其他代办人"];

export const STATUS_LABEL: Record<VersionStatus, string> = {
  draft: "待确认",
  signed: "已签署",
  locked: "已锁定",
  superseded: "已被替代",
  revoked: "已撤销",
};

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = {
  "plan-change": "计划变更",
  revoke: "撤销",
  supplement: "补签",
  correct: "更正",
};

// 资料层：演示用初始数据（三种典型状态：待重新确认 / 未签署 / 已充填、已撤销）
import type {
  ConsentVersion,
  DeskState,
  ProcedureEntry,
  RiskConfirmations,
  ToothConsent,
} from "./types";

const ALL_RISKS: RiskConfirmations = {
  anesthesia: true,
  instrument: true,
  postop: true,
  outcome: true,
};

function version(
  partial: Omit<ConsentVersion, "locked" | "riskConfirmed"> &
    Partial<Pick<ConsentVersion, "riskConfirmed">>,
): ConsentVersion {
  return { riskConfirmed: ALL_RISKS, ...partial, locked: true };
}

function logEntry(
  id: string,
  code: string,
  at: string,
  operator: string,
  note?: string,
): ProcedureEntry {
  return { id, code, at, operator, note };
}

function consent(partial: ToothConsent): ToothConsent {
  return partial;
}

export function createSeedState(): DeskState {
  const patients = [
    { id: "pat_wang", name: "王秀兰", recordNo: "2026090101" },
    { id: "pat_li", name: "李建国", recordNo: "2026090205" },
    { id: "pat_chen", name: "陈晓敏", recordNo: "2026090311" },
  ];

  const consents: ToothConsent[] = [
    // 已开髓；计划加做显微根管治疗 → 待重新确认，充填被拦
    consent({
      id: "consent_36",
      patientId: "pat_wang",
      tooth: "36",
      diagnosis: "慢性根尖周炎",
      plannedProcedures: [
        "access",
        "shaping",
        "medicate",
        "obturation",
        "microscope",
        "postcore",
      ],
      versions: [
        version({
          version: 1,
          kind: "initial",
          reason: "首次签署",
          createdAt: "2026-09-10T08:40:00.000Z",
          signDate: "2026-09-10",
          signerName: "王秀兰",
          signerRelation: "本人",
          agentName: "周敏（助理）",
          planSnapshot: ["access", "shaping", "medicate", "obturation", "postcore"],
          changes: [],
          sourceVersion: null,
        }),
      ],
      pendingChange: {
        previousPlan: ["access", "shaping", "medicate", "obturation", "postcore"],
        nextPlan: [
          "access",
          "shaping",
          "medicate",
          "obturation",
          "microscope",
          "postcore",
        ],
        reason: "术中见 MB2 钙化、弯曲，拟加做显微根管治疗，需重新告知。",
        changedAt: "2026-09-22T03:20:00.000Z",
        changedBy: "高医生",
      },
      procedureLog: [
        logEntry(
          "proc_36_access",
          "access",
          "2026-09-12T02:30:00.000Z",
          "高医生",
          "开髓通畅，MB 主根管定位。",
        ),
        logEntry(
          "proc_36_medicate",
          "medicate",
          "2026-09-12T03:05:00.000Z",
          "高医生",
          "氢氧化钙封药，预约复诊。",
        ),
      ],
      createdAt: "2026-09-10T08:30:00.000Z",
    }),
    // 未签署：开髓登记将被拦截
    consent({
      id: "consent_46",
      patientId: "pat_wang",
      tooth: "46",
      diagnosis: "急性牙髓炎",
      plannedProcedures: ["access", "shaping", "medicate", "obturation"],
      versions: [],
      pendingChange: null,
      procedureLog: [],
      createdAt: "2026-09-25T06:10:00.000Z",
    }),
    // 已完成：签署一致，已充填
    consent({
      id: "consent_11",
      patientId: "pat_li",
      tooth: "11",
      diagnosis: "外伤后牙体变色",
      plannedProcedures: ["access", "shaping", "obturation", "postcore"],
      versions: [
        version({
          version: 1,
          kind: "initial",
          reason: "首次签署",
          createdAt: "2026-09-03T07:15:00.000Z",
          signDate: "2026-09-03",
          signerName: "李建国",
          signerRelation: "本人",
          agentName: "周敏（助理）",
          planSnapshot: ["access", "shaping", "obturation", "postcore"],
          changes: [],
          sourceVersion: null,
        }),
      ],
      pendingChange: null,
      procedureLog: [
        logEntry(
          "proc_11_access",
          "access",
          "2026-09-04T02:00:00.000Z",
          "林医生",
          "单根管，开髓。",
        ),
        logEntry(
          "proc_11_measure",
          "measure",
          "2026-09-04T02:25:00.000Z",
          "林医生",
          "工作长度 21.5mm。",
        ),
        logEntry(
          "proc_11_obturation",
          "obturation",
          "2026-09-18T05:40:00.000Z",
          "林医生",
          "冷侧压充填完成，建议冠修复。",
        ),
      ],
      createdAt: "2026-09-03T07:00:00.000Z",
    }),
    // 已撤销：撤销后开髓 / 充填均被拦，需补签
    consent({
      id: "consent_26",
      patientId: "pat_chen",
      tooth: "26",
      diagnosis: "慢性牙髓炎",
      plannedProcedures: ["access", "shaping", "medicate", "obturation", "postcore"],
      versions: [
        version({
          version: 1,
          kind: "initial",
          reason: "首次签署",
          createdAt: "2026-09-15T08:00:00.000Z",
          signDate: "2026-09-15",
          signerName: "张桂芳",
          signerRelation: "配偶",
          agentName: "周敏（助理）",
          planSnapshot: [
            "access",
            "shaping",
            "medicate",
            "obturation",
            "postcore",
          ],
          changes: [],
          sourceVersion: null,
        }),
        version({
          version: 2,
          kind: "revocation",
          reason: "患者要求暂缓治疗，转外院评估拔除方案。",
          createdAt: "2026-09-20T09:30:00.000Z",
          signDate: null,
          signerName: "",
          signerRelation: "",
          agentName: "",
          riskConfirmed: null,
          planSnapshot: [
            "access",
            "shaping",
            "medicate",
            "obturation",
            "postcore",
          ],
          changes: [],
          sourceVersion: 1,
        }),
      ],
      pendingChange: null,
      procedureLog: [],
      createdAt: "2026-09-15T07:50:00.000Z",
    }),
  ];

  return { schemaVersion: 1, patients, consents };
}

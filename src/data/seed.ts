import { resetRisks, snapshotOf, uid } from "../domain/consent";
import type { ConsentCase, ConsentVersion } from "../domain/types";

function v(partial: Partial<ConsentVersion> & { version: number }): ConsentVersion {
  return {
    id: uid(),
    status: "draft",
    plan: { tooth: "36", items: [], note: "" },
    signerName: "",
    signerRelation: "本人",
    signedAt: null,
    risks: resetRisks(),
    createdAt: "2026-09-01",
    ...partial,
  };
}

const allTrue = { pain: true, instrument: true, failure: true, cost: true };

/** 初始示例：覆盖待确认、已签署、计划变更待重签、已锁定四种情形 */
export function seedCases(): ConsentCase[] {
  const zhaoV1 = v({
    version: 1,
    status: "superseded",
    plan: { tooth: "46", items: ["开髓", "根管预备", "封药"], note: "急性牙髓炎，近中双根管" },
    signerName: "赵敏",
    signedAt: "2026-09-12",
    risks: { ...allTrue },
    createdAt: "2026-09-12",
  });

  return [
    {
      id: uid(),
      patientName: "王芳",
      recordNo: "BL-2026-0117",
      versions: [
        v({
          version: 1,
          status: "signed",
          plan: { tooth: "36", items: ["开髓", "根管预备", "封药"], note: "慢性根尖周炎，MB 工作长度 19.5mm" },
          signerName: "王芳",
          signedAt: "2026-09-18",
          risks: { ...allTrue },
          createdAt: "2026-09-18",
        }),
      ],
      procedures: [{ id: uid(), kind: "开髓", at: "2026-09-18", version: 1 }],
    },
    {
      id: uid(),
      patientName: "李强",
      recordNo: "BL-2026-0121",
      versions: [
        v({
          version: 1,
          plan: { tooth: "11", items: ["开髓", "根管预备", "充填"], note: "外伤后变色，单根管" },
          risks: { ...resetRisks(), pain: true },
          createdAt: "2026-09-24",
        }),
      ],
      procedures: [],
    },
    {
      id: uid(),
      patientName: "赵敏",
      recordNo: "BL-2026-0098",
      versions: [
        zhaoV1,
        v({
          version: 2,
          plan: { tooth: "46", items: ["开髓", "根管预备", "封药", "显微治疗"], note: "急性牙髓炎，近中双根管" },
          signerName: "赵敏",
          createdAt: "2026-09-25",
          changeKind: "plan-change",
          changeReason: "术中发现根管钙化，需加做显微治疗",
          previousValues: snapshotOf(zhaoV1),
        }),
      ],
      procedures: [{ id: uid(), kind: "开髓", at: "2026-09-12", version: 1 }],
    },
    {
      id: uid(),
      patientName: "陈伟",
      recordNo: "BL-2026-0072",
      versions: [
        v({
          version: 1,
          status: "locked",
          plan: { tooth: "26", items: ["开髓", "根管预备", "封药", "充填"], note: "慢性牙髓炎，冷侧压充填完成" },
          signerName: "陈伟",
          signedAt: "2026-09-05",
          risks: { ...allTrue },
          createdAt: "2026-09-05",
        }),
      ],
      procedures: [
        { id: uid(), kind: "开髓", at: "2026-09-05", version: 1 },
        { id: uid(), kind: "充填", at: "2026-09-19", version: 1 },
      ],
    },
  ];
}

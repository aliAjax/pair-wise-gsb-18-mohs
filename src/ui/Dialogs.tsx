// 表示层：操作弹窗（签署 / 计划变更 / 更正 / 撤销 / 步骤登记 / 新建同意书）
import { useState } from "react";
import {
  GATED_STEPS,
  STEP_ITEMS,
  VERSION_KIND_LABELS,
  planLabels,
} from "../data/catalog";
import type { SignPayload, ToothConsent } from "../data/types";
import {
  canRegisterStep,
  consentStatus,
  latestSignedVersion,
} from "../domain/policy";
import { signKindFor } from "../domain/reducer";
import { today } from "../lib/util";
import {
  Field,
  Modal,
  PlanPicker,
  RelationSelect,
  RiskChecklist,
  emptyRisks,
} from "./shared";

type Submit = () => boolean;
function useModalState(submit: Submit, onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    const ok = submit();
    setBusy(false);
    if (ok) onClose();
  };
  return { busy, run };
}

function Footer({
  run,
  busy,
  onClose,
  confirm = "提交并生成新版本",
}: {
  run: () => void;
  busy: boolean;
  onClose: () => void;
  confirm?: string;
}) {
  return (
    <>
      <button onClick={onClose}>取消</button>
      <button className="primary-action" onClick={run} disabled={busy}>
        {busy ? "处理中…" : confirm}
      </button>
    </>
  );
}

// ---------- 签署（首签 / 计划变更重签 / 补签） ----------

export function SignDialog({
  consent,
  onClose,
  onSubmit,
}: {
  consent: ToothConsent;
  onClose: () => void;
  onSubmit: (payload: SignPayload) => boolean;
}) {
  const kind = signKindFor(consent);
  const status = consentStatus(consent);
  const previous = latestSignedVersion(consent);
  const [signDate, setSignDate] = useState(today());
  const [signerName, setSignerName] = useState(previous?.signerName ?? "");
  const [signerRelation, setSignerRelation] = useState(
    previous?.signerRelation ?? "",
  );
  const [agentName, setAgentName] = useState(previous?.agentName ?? "");
  // 计划变化后风险需由签字人重新逐项确认，不沿用旧勾选
  const [risks, setRisks] = useState(emptyRisks);
  const [reason, setReason] = useState(
    consent.pendingChange?.reason ?? "",
  );

  const submit = () =>
    onSubmit({
      signDate,
      signerName,
      signerRelation,
      agentName,
      riskConfirmed: risks,
      reason,
    });
  const { busy, run } = useModalState(submit, onClose);

  return (
    <Modal
      wide
      title={
        <>
          {VERSION_KIND_LABELS[kind]} · {consent.tooth} 牙
          {status === "stale" ? (
            <span className="title-note warn">计划已变化，须重新确认</span>
          ) : null}
        </>
      }
      onClose={onClose}
      footer={<Footer run={run} busy={busy} onClose={onClose} confirm="确认签署并锁定" />}
    >
      {status === "stale" && consent.pendingChange ? (
        <div className="notice warn">
          <strong>计划变化：</strong>
          {planLabels(consent.pendingChange.previousPlan)} →{" "}
          {planLabels(consent.pendingChange.nextPlan)}
          <p>原因：{consent.pendingChange.reason}</p>
        </div>
      ) : null}
      {status === "revoked" ? (
        <div className="notice danger">
          最新版本为撤销记录。补签将生成新版本并恢复同意书效力，请重新完成四项风险告知。
        </div>
      ) : null}

      <div className="form-grid">
        <Field label="签署日期" required>
          <input
            type="date"
            value={signDate}
            onChange={(event) => setSignDate(event.target.value)}
          />
        </Field>
        <Field label="签署人" required hint="患者本人或受托人">
          <input
            value={signerName}
            placeholder="签署人姓名"
            onChange={(event) => setSignerName(event.target.value)}
          />
        </Field>
        <Field label="与患者关系" required>
          <RelationSelect value={signerRelation} onChange={setSignerRelation} />
        </Field>
        <Field label="代办人 / 经办助理" required hint="核对并收取签字的工作人员">
          <input
            value={agentName}
            placeholder="如：周敏（助理）"
            onChange={(event) => setAgentName(event.target.value)}
          />
        </Field>
        {kind !== "initial" ? (
          <Field label="本次签署原因" required>
            <input
              value={reason}
              placeholder="计划变更 / 补签的原因"
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        ) : null}
      </div>

      <fieldset className="risk-fieldset">
        <legend>
          四项风险逐项确认 <em className="req">*</em>
          <small>请由签署人亲自阅读后逐项勾选；计划变化后需重新确认</small>
        </legend>
        <RiskChecklist value={risks} onChange={setRisks} />
      </fieldset>
    </Modal>
  );
}

// ---------- 计划变更 ----------

export function PlanChangeDialog({
  consent,
  onClose,
  onSubmit,
}: {
  consent: ToothConsent;
  onClose: () => void;
  onSubmit: (nextPlan: string[], reason: string, changedBy: string) => boolean;
}) {
  const [nextPlan, setNextPlan] = useState([...consent.plannedProcedures]);
  const [reason, setReason] = useState("");
  const [changedBy, setChangedBy] = useState("");

  const submit = () => onSubmit(nextPlan, reason, changedBy);
  const { busy, run } = useModalState(submit, onClose);

  return (
    <Modal
      wide
      title={<>计划变化 · {consent.tooth} 牙</>}
      onClose={onClose}
      footer={<Footer run={run} busy={busy} onClose={onClose} confirm="记录变化并要求重新确认" />}
    >
      <div className="notice warn">
        计划变化（如更换牙位开髓范围、加做显微根管治疗）将把同意书标记为「待重新确认」；
        重新签署前，<strong>开髓与充填登记将被拦截</strong>。
      </div>
      <Field label="变化原因" required>
        <input
          value={reason}
          placeholder="如：术中见 MB2 钙化，需加做显微根管治疗"
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <Field label="调整人" required>
        <input
          value={changedBy}
          placeholder="提出调整的医生"
          onChange={(event) => setChangedBy(event.target.value)}
        />
      </Field>
      <Field label="调整后的治疗计划" required>
        <PlanPicker value={nextPlan} onChange={setNextPlan} />
      </Field>
    </Modal>
  );
}

// ---------- 更正 ----------

export function CorrectDialog({
  consent,
  onClose,
  onSubmit,
}: {
  consent: ToothConsent;
  onClose: () => void;
  onSubmit: (
    reason: string,
    fields: {
      signDate: string;
      signerName: string;
      signerRelation: string;
      agentName: string;
    },
  ) => boolean;
}) {
  const previous = latestSignedVersion(consent);
  const [reason, setReason] = useState("");
  const [fields, setFields] = useState({
    signDate: previous?.signDate ?? today(),
    signerName: previous?.signerName ?? "",
    signerRelation: previous?.signerRelation ?? "",
    agentName: previous?.agentName ?? "",
  });
  const patch = (key: keyof typeof fields, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const submit = () => onSubmit(reason, fields);
  const { busy, run } = useModalState(submit, onClose);

  return (
    <Modal
      title={<>内容更正 · {consent.tooth} 牙</>}
      onClose={onClose}
      footer={<Footer run={run} busy={busy} onClose={onClose} confirm="更正并生成新版本" />}
    >
      <div className="notice warn">
        已锁定内容不能直接改写。更正将基于最新版本生成新版本，保留原因与每项字段的旧值。
      </div>
      <div className="form-grid">
        <Field label="更正原因" required>
          <input
            value={reason}
            placeholder="如：签署日期录入错误"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <Field label="签署日期" required>
          <input
            type="date"
            value={fields.signDate}
            onChange={(event) => patch("signDate", event.target.value)}
          />
        </Field>
        <Field label="签署人" required>
          <input
            value={fields.signerName}
            onChange={(event) => patch("signerName", event.target.value)}
          />
        </Field>
        <Field label="与患者关系" required>
          <RelationSelect
            value={fields.signerRelation}
            onChange={(value) => patch("signerRelation", value)}
          />
        </Field>
        <Field label="代办人 / 经办助理" required>
          <input
            value={fields.agentName}
            onChange={(event) => patch("agentName", event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------- 撤销 ----------

export function RevokeDialog({
  consent,
  onClose,
  onSubmit,
}: {
  consent: ToothConsent;
  onClose: () => void;
  onSubmit: (reason: string) => boolean;
}) {
  const [reason, setReason] = useState("");
  const submit = () => onSubmit(reason);
  const { busy, run } = useModalState(submit, onClose);

  return (
    <Modal
      title={<>撤销同意书 · {consent.tooth} 牙</>}
      onClose={onClose}
      footer={<Footer run={run} busy={busy} onClose={onClose} confirm="撤销并生成新版本" />}
    >
      <div className="notice danger">
        撤销后立即锁定为新版本，原因留痕；撤销期间不能登记开髓或充填，补签后恢复。
      </div>
      <Field label="撤销原因" required>
        <input
          value={reason}
          placeholder="如：患者要求暂缓治疗，转外院评估"
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
    </Modal>
  );
}

// ---------- 诊疗步骤登记（开髓 / 测长 / 封药 / 充填） ----------

export function RegisterStepDialog({
  consent,
  onClose,
  onSubmit,
}: {
  consent: ToothConsent;
  onClose: () => void;
  onSubmit: (code: string, operator: string, note: string) => boolean;
}) {
  const [code, setCode] = useState("");
  const [operator, setOperator] = useState("");
  const [note, setNote] = useState("");
  const blocked = code ? canRegisterStep(consent, code) : null;

  const submit = () => onSubmit(code, operator, note);
  const { busy, run } = useModalState(submit, onClose);

  return (
    <Modal
      title={<>诊疗登记 · {consent.tooth} 牙</>}
      onClose={onClose}
      footer={<Footer run={run} busy={busy} onClose={onClose} confirm="登记步骤" />}
    >
      <Field label="步骤" required>
        <select value={code} onChange={(event) => setCode(event.target.value)}>
          <option value="">请选择步骤</option>
          {STEP_ITEMS.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
              {GATED_STEPS.includes(item.code) ? "（需同意书确认）" : ""}
            </option>
          ))}
        </select>
      </Field>
      {code && blocked && !blocked.ok ? (
        <div className="notice danger">⛔ {blocked.reason}</div>
      ) : null}
      {code && blocked?.ok ? (
        <div className="notice ok">同意书核对通过，可以登记。</div>
      ) : null}
      <Field label="操作人" required>
        <input
          value={operator}
          placeholder="执行该步骤的医生"
          onChange={(event) => setOperator(event.target.value)}
        />
      </Field>
      <Field label="备注">
        <textarea
          rows={3}
          value={note}
          placeholder="工作长度、封药、根管情况等"
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
    </Modal>
  );
}

// ---------- 新建同意书 ----------

export function NewConsentDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: {
    patientName: string;
    recordNo: string;
    tooth: string;
    diagnosis: string;
    plannedProcedures: string[];
  }) => boolean;
}) {
  const [patientName, setPatientName] = useState("");
  const [recordNo, setRecordNo] = useState("");
  const [tooth, setTooth] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [plannedProcedures, setPlannedProcedures] = useState<string[]>([
    "access",
    "shaping",
    "obturation",
  ]);

  const submit = () =>
    onSubmit({ patientName, recordNo, tooth, diagnosis, plannedProcedures });
  const { busy, run } = useModalState(submit, onClose);

  return (
    <Modal
      wide
      title="新增知情同意书（按患者与牙位）"
      onClose={onClose}
      footer={<Footer run={run} busy={busy} onClose={onClose} confirm="建立同意书" />}
    >
      <div className="form-grid">
        <Field label="患者姓名" required>
          <input
            value={patientName}
            placeholder="患者姓名"
            onChange={(event) => setPatientName(event.target.value)}
          />
        </Field>
        <Field label="病历号" required hint="已存在病历将并入该患者">
          <input
            value={recordNo}
            placeholder="如 2026092601"
            onChange={(event) => setRecordNo(event.target.value)}
          />
        </Field>
        <Field label="牙位（FDI）" required hint="如 36、11">
          <input
            value={tooth}
            maxLength={2}
            placeholder="两位数字"
            onChange={(event) => setTooth(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="诊断">
          <input
            value={diagnosis}
            placeholder="如 慢性根尖周炎"
            onChange={(event) => setDiagnosis(event.target.value)}
          />
        </Field>
      </div>
      <Field label="拟定治疗计划" required>
        <PlanPicker value={plannedProcedures} onChange={setPlannedProcedures} />
      </Field>
    </Modal>
  );
}

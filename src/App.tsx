import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { ChangeKind, ConsentCase, ConsentVersion, TreatmentPlan } from "./domain/types";
import {
  CHANGE_KIND_LABEL,
  PLAN_ITEMS,
  RISK_ITEMS,
  SIGNER_RELATIONS,
  STATUS_LABEL,
  TEETH,
} from "./data/constants";
import {
  canRegisterProcedure,
  canSign,
  createCase,
  currentVersion,
  lockCurrent,
  missingForSign,
  planChanged,
  registerProcedure,
  revise,
  signCurrent,
  updateDraft,
} from "./domain/consent";
import { loadCases, resetCases, saveCases } from "./storage/boardStore";

function statusLabel(v: ConsentVersion): string {
  return v.status === "draft" && v.version > 1 ? "需重新确认" : STATUS_LABEL[v.status];
}

function PlanEditor({
  plan,
  disabled,
  onChange,
}: {
  plan: TreatmentPlan;
  disabled: boolean;
  onChange: (p: TreatmentPlan) => void;
}) {
  return (
    <div className="plan-editor">
      <label>
        <span>牙位（FDI）</span>
        <select
          value={plan.tooth}
          disabled={disabled}
          onChange={(e) => onChange({ ...plan, tooth: e.target.value })}
        >
          {TEETH.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="field-label">治疗项目</span>
        <div className="chips plan-items">
          {PLAN_ITEMS.map((item) => {
            const on = plan.items.includes(item);
            return (
              <button
                key={item}
                type="button"
                className={on ? "chip-on" : ""}
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...plan,
                    items: on ? plan.items.filter((i) => i !== item) : [...plan.items, item],
                  })
                }
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>
      <label>
        <span>备注（诊断、工作长度等）</span>
        <input
          value={plan.note}
          disabled={disabled}
          placeholder="例如：慢性根尖周炎，MB 19.5mm"
          onChange={(e) => onChange({ ...plan, note: e.target.value })}
        />
      </label>
    </div>
  );
}

function CaseDetail({
  c,
  onChange,
}: {
  c: ConsentCase;
  onChange: (fn: (c: ConsentCase) => ConsentCase) => void;
}) {
  const cur = currentVersion(c);
  const editable = cur.status === "draft";
  const gate = canRegisterProcedure(c);

  const [pending, setPending] = useState<ChangeKind | null>(null);
  const [reason, setReason] = useState("");
  const [planEdit, setPlanEdit] = useState<TreatmentPlan | null>(null);
  const [planReason, setPlanReason] = useState("");

  const submitRevision = (kind: ChangeKind) => {
    onChange((cc) => revise(cc, kind, reason));
    setPending(null);
    setReason("");
  };

  const submitPlanChange = () => {
    if (!planEdit) return;
    onChange((cc) => revise(cc, "plan-change", planReason, planEdit));
    setPlanEdit(null);
    setPlanReason("");
  };

  return (
    <div className="detail-stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>
              {c.recordNo} · 共 {c.versions.length} 个版本
            </p>
            <h2>
              {c.patientName} · 牙位 #{cur.plan.tooth}
            </h2>
          </div>
          <span className={`badge badge-${cur.status}`}>
            {statusLabel(cur)} · 第 {cur.version} 版
          </span>
        </div>

        {cur.status === "draft" && cur.version > 1 && (
          <div className="banner banner-warn">
            本版本因「{cur.changeKind ? CHANGE_KIND_LABEL[cur.changeKind] : "变更"}」新建：
            {cur.changeReason}。四项风险需重新确认并签署，确认前不能登记开髓或充填。
          </div>
        )}
        {cur.status === "locked" && (
          <div className="banner banner-lock">
            本同意书已完成并锁定，内容不可修改；如需撤销、补签或更正，将新建版本并保留原因和旧值。
          </div>
        )}

        <h3>知情同意书 · 第 {cur.version} 版</h3>
        <div className="field-grid">
          <label>
            <span>签署人 / 代办人</span>
            <input
              value={cur.signerName}
              disabled={!editable}
              placeholder="患者或代办人姓名"
              onChange={(e) => onChange((cc) => updateDraft(cc, { signerName: e.target.value }))}
            />
          </label>
          <label>
            <span>与患者关系</span>
            <select
              value={cur.signerRelation}
              disabled={!editable}
              onChange={(e) => onChange((cc) => updateDraft(cc, { signerRelation: e.target.value }))}
            >
              {SIGNER_RELATIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>签署日期</span>
            <input
              type="date"
              value={cur.signedAt ?? ""}
              disabled={!editable}
              onChange={(e) =>
                onChange((cc) => updateDraft(cc, { signedAt: e.target.value || null }))
              }
            />
          </label>
        </div>

        <div className="risk-list">
          {RISK_ITEMS.map((r) => (
            <label
              key={r.key}
              className={`risk-row ${cur.risks[r.key] ? "checked" : ""}`}
            >
              <input
                type="checkbox"
                checked={cur.risks[r.key]}
                disabled={!editable}
                onChange={() =>
                  onChange((cc) => {
                    const latest = currentVersion(cc);
                    return updateDraft(cc, {
                      risks: { ...latest.risks, [r.key]: !latest.risks[r.key] },
                    });
                  })
                }
              />
              <div>
                <strong>{r.label}</strong>
                <p>{r.detail}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="action-row">
          {cur.status === "draft" && (
            <button
              className="primary-action"
              disabled={!canSign(cur)}
              onClick={() => onChange(signCurrent)}
            >
              确认签署（第 {cur.version} 版）
            </button>
          )}
          {cur.status === "signed" && (
            <button className="primary-action" onClick={() => onChange(lockCurrent)}>
              治疗完成，锁定内容
            </button>
          )}
          {(cur.status === "signed" || cur.status === "locked") && (
            <>
              <button onClick={() => setPending("revoke")}>撤销</button>
              <button onClick={() => setPending("supplement")}>补签</button>
              <button onClick={() => setPending("correct")}>更正</button>
            </>
          )}
        </div>
        {cur.status === "draft" && !canSign(cur) && (
          <ul className="missing-list">
            {missingForSign(cur).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        {pending && (
          <div className="reason-panel">
            <p>
              将把第 {cur.version} 版归档为「
              {pending === "revoke" ? STATUS_LABEL.revoked : STATUS_LABEL.superseded}
              」，并新建第 {cur.version + 1} 版草稿（{CHANGE_KIND_LABEL[pending]}
              ），旧值随版本保留，四项风险需重新确认。
            </p>
            <textarea
              value={reason}
              placeholder="请填写原因（必填）"
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="action-row">
              <button
                className="primary-action"
                disabled={!reason.trim()}
                onClick={() => submitRevision(pending)}
              >
                确认{CHANGE_KIND_LABEL[pending]}并新建版本
              </button>
              <button
                onClick={() => {
                  setPending(null);
                  setReason("");
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>治疗计划</p>
            <h2>计划与变更</h2>
          </div>
          {cur.status === "signed" && !planEdit && (
            <button onClick={() => setPlanEdit({ ...cur.plan, items: [...cur.plan.items] })}>
              变更计划
            </button>
          )}
        </div>

        {editable && (
          <PlanEditor
            plan={cur.plan}
            disabled={false}
            onChange={(plan) => onChange((cc) => updateDraft(cc, { plan }))}
          />
        )}
        {!editable && !planEdit && <PlanEditor plan={cur.plan} disabled onChange={() => {}} />}

        {planEdit && (
          <div className="reason-panel">
            <p>
              修改牙位或治疗项目（如换牙位开髓、加做显微治疗）后，第 {cur.version}{" "}
              版将归档，需重新确认四项风险并签署。
            </p>
            <PlanEditor plan={planEdit} disabled={false} onChange={setPlanEdit} />
            <textarea
              value={planReason}
              placeholder="计划变更原因（必填），例如：术中发现根管钙化，加做显微治疗"
              onChange={(e) => setPlanReason(e.target.value)}
            />
            <div className="action-row">
              <button
                className="primary-action"
                disabled={
                  !planReason.trim() ||
                  !planChanged(cur.plan, planEdit) ||
                  planEdit.items.length === 0
                }
                onClick={submitPlanChange}
              >
                提交变更并新建第 {cur.version + 1} 版
              </button>
              <button
                onClick={() => {
                  setPlanEdit(null);
                  setPlanReason("");
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>处置登记</p>
            <h2>开髓 / 充填</h2>
          </div>
        </div>
        {!gate.ok && <p className="gate-msg">{gate.reason}</p>}
        <div className="action-row">
          <button disabled={!gate.ok} onClick={() => onChange((cc) => registerProcedure(cc, "开髓"))}>
            登记开髓
          </button>
          <button disabled={!gate.ok} onClick={() => onChange((cc) => registerProcedure(cc, "充填"))}>
            登记充填
          </button>
        </div>
        {c.procedures.length > 0 ? (
          <ul className="proc-log">
            {c.procedures.map((p) => (
              <li key={p.id}>
                {p.at} · {p.kind} · 依据第 {p.version} 版同意书
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-hint">尚无处置记录。</p>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>留痕</p>
            <h2>版本记录</h2>
          </div>
        </div>
        <div className="history-list">
          {[...c.versions].reverse().map((ver) => (
            <article key={ver.id} className="history-item">
              <header>
                <strong>第 {ver.version} 版</strong>
                <span className={`badge badge-${ver.status}`}>{statusLabel(ver)}</span>
              </header>
              <p>
                牙位 #{ver.plan.tooth} · {ver.plan.items.join("、") || "未选项目"}
                {ver.plan.note ? ` · ${ver.plan.note}` : ""}
              </p>
              <p>
                签署：{ver.signerName || "—"}（{ver.signerRelation}）
                {ver.signedAt ? ` · ${ver.signedAt}` : " · 未签"} · 风险确认{" "}
                {Object.values(ver.risks).filter(Boolean).length}/4 · 建档 {ver.createdAt}
              </p>
              {ver.changeReason && (
                <p className="history-reason">
                  {ver.changeKind ? CHANGE_KIND_LABEL[ver.changeKind] : "变更"}原因：
                  {ver.changeReason}
                </p>
              )}
              {ver.previousValues && (
                <details>
                  <summary>查看旧值（被替代的第 {ver.version - 1} 版）</summary>
                  <p>
                    牙位 #{ver.previousValues.plan.tooth} ·{" "}
                    {ver.previousValues.plan.items.join("、") || "未选项目"}
                    {ver.previousValues.plan.note ? ` · ${ver.previousValues.plan.note}` : ""}
                  </p>
                  <p>
                    签署：{ver.previousValues.signerName || "—"}（
                    {ver.previousValues.signerRelation}）
                    {ver.previousValues.signedAt
                      ? ` · ${ver.previousValues.signedAt}`
                      : " · 未签"}{" "}
                    · 风险确认{" "}
                    {Object.values(ver.previousValues.risks).filter(Boolean).length}/4
                  </p>
                </details>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function App() {
  const [cases, setCases] = useState<ConsentCase[]>(loadCases);
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRecordNo, setNewRecordNo] = useState("");
  const [newTooth, setNewTooth] = useState("36");

  useEffect(() => saveCases(cases), [cases]);

  const selected = cases.find((c) => c.id === selectedId) ?? cases[0];

  const counts = useMemo(() => {
    let draft = 0,
      signed = 0,
      locked = 0,
      reconfirm = 0;
    for (const c of cases) {
      const cur = currentVersion(c);
      if (cur.status === "signed") signed += 1;
      else if (cur.status === "locked") locked += 1;
      else {
        draft += 1;
        if (cur.version > 1) reconfirm += 1;
      }
    }
    return { draft, signed, locked, reconfirm };
  }, [cases]);

  const updateSelected = (fn: (c: ConsentCase) => ConsentCase) => {
    setCases((cs) => cs.map((c) => (c.id === selected?.id ? fn(c) : c)));
  };

  const addCase = () => {
    if (!newName.trim() || !newRecordNo.trim()) return;
    const nc = createCase(newName, newRecordNo, newTooth);
    setCases((cs) => [...cs, nc]);
    setSelectedId(nc.id);
    setNewName("");
    setNewRecordNo("");
  };

  const metrics = [
    { label: "待确认", value: counts.draft, cls: "status-watch" },
    { label: "已签署", value: counts.signed, cls: "status-ok" },
    { label: "已锁定", value: counts.locked, cls: "status-ok" },
    { label: "需重新确认", value: counts.reconfirm, cls: "status-danger" },
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-04 · 牙体牙髓科</p>
          <h1>知情同意核对台</h1>
          <p className="subtitle">
            按患者与牙位管理知情同意：记录版本、签署日期、代办人与四项风险确认。
            计划变化后须重新确认，未确认前不能登记开髓或充填；完成后锁定内容，
            撤销、补签或更正均新建版本并保留原因和旧值。
          </p>
        </div>
        <div className="stack-card">
          <span>组织方式</span>
          <strong>资料 data / 判断 domain / 存储 storage 分层</strong>
          <span>状态与版本记录保存在本机，重开页面不丢失</span>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((m) => (
          <article key={m.label} className="metric-card">
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <i className={m.cls} />
          </article>
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>患者与牙位</h2>
          <div className="case-list">
            {cases.map((c) => {
              const cur = currentVersion(c);
              return (
                <button
                  key={c.id}
                  className={`case-item ${c.id === selected?.id ? "active" : ""}`}
                  onClick={() => setSelectedId(c.id)}
                >
                  <strong>
                    {c.patientName} · #{cur.plan.tooth}
                  </strong>
                  <span>
                    {statusLabel(cur)} · 第 {cur.version} 版
                  </span>
                </button>
              );
            })}
          </div>

          <h2>新建核对</h2>
          <div className="new-case-form">
            <label>
              <span>患者姓名</span>
              <input
                value={newName}
                placeholder="姓名"
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label>
              <span>病历号</span>
              <input
                value={newRecordNo}
                placeholder="BL-2026-XXXX"
                onChange={(e) => setNewRecordNo(e.target.value)}
              />
            </label>
            <label>
              <span>牙位（FDI）</span>
              <select value={newTooth} onChange={(e) => setNewTooth(e.target.value)}>
                {TEETH.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary-action"
              disabled={!newName.trim() || !newRecordNo.trim()}
              onClick={addCase}
            >
              新建同意书草稿
            </button>
            <button onClick={() => setCases(resetCases())}>恢复示例数据</button>
          </div>
        </aside>

        {selected && <CaseDetail key={selected.id} c={selected} onChange={updateSelected} />}
      </section>
    </main>
  );
}

export default App;

// 表示层：同意书详情抽屉（当前签署内容、版本时间线、诊疗记录）
import {
  GATED_STEPS,
  RISK_ITEMS,
  STEP_LABELS,
  VERSION_KIND_LABELS,
  planLabels,
} from "../data/catalog";
import type { ConsentVersion, ToothConsent } from "../data/types";
import {
  STATUS_META,
  consentStatus,
  latestSignedVersion,
  latestVersion,
  sortedLog,
} from "../domain/policy";
import { LockTag, StatusBadge, formatDateTime } from "./shared";

export type DrawerAction =
  | { kind: "sign" }
  | { kind: "plan" }
  | { kind: "correct" }
  | { kind: "revoke" }
  | { kind: "register" };

function RiskSummary({ version }: { version: ConsentVersion }) {
  if (!version.riskConfirmed) {
    return <p className="muted">撤销版本：无风险确认内容。</p>;
  }
  return (
    <ul className="risk-summary">
      {RISK_ITEMS.map((item) => {
        const ok = version.riskConfirmed?.[item.id] ?? false;
        return (
          <li key={item.id} className={ok ? "ok" : "miss"}>
            {ok ? "✓" : "✗"} {item.short}
          </li>
        );
      })}
    </ul>
  );
}

function VersionNode({
  version,
  isLatest,
}: {
  version: ConsentVersion;
  isLatest: boolean;
}) {
  return (
    <li className={`version-node kind-${version.kind}`}>
      <div className="version-head">
        <span className="version-no">v{version.version}</span>
        <span className={`kind-tag kind-${version.kind}`}>
          {VERSION_KIND_LABELS[version.kind]}
        </span>
        {isLatest ? <span className="latest-tag">最新</span> : null}
        <LockTag />
        <time>{formatDateTime(version.createdAt)}</time>
      </div>
      <p className="version-reason">原因：{version.reason}</p>
      {version.kind !== "revocation" ? (
        <dl className="version-fields">
          <div>
            <dt>签署日期</dt>
            <dd>{version.signDate ?? "—"}</dd>
          </div>
          <div>
            <dt>签署人</dt>
            <dd>
              {version.signerName}（{version.signerRelation}）
            </dd>
          </div>
          <div>
            <dt>代办人</dt>
            <dd>{version.agentName}</dd>
          </div>
          <div>
            <dt>锁定计划</dt>
            <dd>{planLabels(version.planSnapshot)}</dd>
          </div>
        </dl>
      ) : null}
      {version.changes.length > 0 ? (
        <table className="changes-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>旧值</th>
              <th>新值</th>
            </tr>
          </thead>
          <tbody>
            {version.changes.map((change) => (
              <tr key={change.field}>
                <td>{change.label}</td>
                <td className="old">{change.oldValue}</td>
                <td className="new">{change.newValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {version.kind !== "revocation" ? <RiskSummary version={version} /> : null}
    </li>
  );
}

export function Drawer({
  consent,
  patientName,
  recordNo,
  onClose,
  onAction,
}: {
  consent: ToothConsent;
  patientName: string;
  recordNo: string;
  onClose: () => void;
  onAction: (action: DrawerAction) => void;
}) {
  const status = consentStatus(consent);
  const signed = latestSignedVersion(consent);
  const latest = latestVersion(consent);
  const log = sortedLog(consent);
  const versionsDesc = [...consent.versions].reverse();

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer">
        <header className="drawer-head">
          <div>
            <p className="eyebrow">
              {patientName} · 病历号 {recordNo}
            </p>
            <h2>
              {consent.tooth} 牙 · {consent.diagnosis}
            </h2>
            <StatusBadge status={status} />
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>

        <div className="drawer-actions">
          <button className="primary-action" onClick={() => onAction({ kind: "sign" })}>
            {status === "unsigned"
              ? "签署"
              : status === "revoked"
                ? "补签"
                : status === "stale"
                  ? "重新确认签署"
                  : "签署"}
          </button>
          <button onClick={() => onAction({ kind: "plan" })}>计划变化</button>
          <button onClick={() => onAction({ kind: "correct" })} disabled={!signed}>
            更正
          </button>
          <button
            className="danger-btn"
            onClick={() => onAction({ kind: "revoke" })}
            disabled={!signed || status === "revoked"}
          >
            撤销
          </button>
          <button onClick={() => onAction({ kind: "register" })}>诊疗登记</button>
        </div>

        {consent.pendingChange ? (
          <div className="notice warn">
            <strong>待重新确认：</strong>
            {planLabels(consent.pendingChange.previousPlan)} →{" "}
            {planLabels(consent.pendingChange.nextPlan)}
            <p>
              {consent.pendingChange.changedBy} 于{" "}
              {formatDateTime(consent.pendingChange.changedAt)} 调整：
              {consent.pendingChange.reason}
            </p>
            <p>未重新签署前，开髓与充填登记被拦截。</p>
          </div>
        ) : null}

        <section className="drawer-section">
          <h3>当前计划</h3>
          <p className="plan-line">{planLabels(consent.plannedProcedures)}</p>
          {signed ? (
            <p className="muted">
              最新签署：v{signed.version} · {signed.signDate} ·{" "}
              {signed.signerName}（{signed.signerRelation}）· 代办{" "}
              {signed.agentName}
            </p>
          ) : (
            <p className="muted">尚无签署记录。</p>
          )}
          {latest?.kind === "revocation" ? (
            <p className="muted">已于 {formatDateTime(latest.createdAt)} 撤销：{latest.reason}</p>
          ) : null}
        </section>

        <section className="drawer-section">
          <h3>诊疗记录（{log.length}）</h3>
          {log.length === 0 ? (
            <p className="muted">暂无登记。开髓 / 充填需先通过同意书核对。</p>
          ) : (
            <ul className="proc-list">
              {log.map((entry) => (
                <li key={entry.id}>
                  <span className={`proc-code ${GATED_STEPS.includes(entry.code) ? "gated" : ""}`}>
                    {STEP_LABELS[entry.code] ?? entry.code}
                  </span>
                  <span className="proc-meta">
                    {formatDateTime(entry.at)} · {entry.operator}
                  </span>
                  {entry.note ? <p>{entry.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="drawer-section">
          <h3>版本记录（{consent.versions.length}）</h3>
          {versionsDesc.length === 0 ? (
            <p className="muted">尚未签署，完成签署后生成 v1 并锁定。</p>
          ) : (
            <ol className="version-list">
              {versionsDesc.map((version, index) => (
                <VersionNode key={version.version} version={version} isLatest={index === 0} />
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}

export { STATUS_META };

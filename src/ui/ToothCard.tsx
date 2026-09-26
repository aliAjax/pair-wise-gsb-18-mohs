// 表示层：牙位卡片（看板单元）
import { STEP_LABELS, planLabels } from "../data/catalog";
import type { ToothConsent } from "../data/types";
import {
  canRegisterStep,
  consentStatus,
  latestSignedVersion,
  sortedLog,
} from "../domain/policy";
import { StatusBadge, formatDateTime } from "./shared";

export function ToothCard({
  consent,
  onOpen,
  onSign,
  onPlan,
  onRegister,
}: {
  consent: ToothConsent;
  onOpen: () => void;
  onSign: () => void;
  onPlan: () => void;
  onRegister: () => void;
}) {
  const status = consentStatus(consent);
  const signed = latestSignedVersion(consent);
  const accessGate = canRegisterStep(consent, "access");
  const obturationGate = canRegisterStep(consent, "obturation");
  const recentLog = sortedLog(consent).slice(-2).reverse();

  return (
    <article className={`tooth-card status-${status}`}>
      <header>
        <div className="tooth-no">#{consent.tooth}</div>
        <div className="tooth-main">
          <h3>{consent.diagnosis}</h3>
          <StatusBadge status={status} />
        </div>
        <button className="icon-btn" onClick={onOpen} aria-label="查看详情">
          ➜
        </button>
      </header>

      <p className="plan-line" title={planLabels(consent.plannedProcedures)}>
        计划：{planLabels(consent.plannedProcedures)}
      </p>

      {signed ? (
        <p className="sign-line">
          v{signed.version} · {signed.signDate} · {signed.signerName}（
          {signed.signerRelation}）· 代办 {signed.agentName}
        </p>
      ) : (
        <p className="sign-line muted">尚未签署</p>
      )}

      {consent.pendingChange ? (
        <p className="pending-line">
          ⚠ 计划已变化：{consent.pendingChange.reason}
        </p>
      ) : null}

      <div className="gate-row">
        <span className={accessGate.ok ? "gate ok" : "gate blocked"}>
          开髓{accessGate.ok ? "可登记" : "已拦截"}
        </span>
        <span className={obturationGate.ok ? "gate ok" : "gate blocked"}>
          充填{obturationGate.ok ? "可登记" : "已拦截"}
        </span>
      </div>

      {recentLog.length > 0 ? (
        <ul className="mini-log">
          {recentLog.map((entry) => (
            <li key={entry.id}>
              {STEP_LABELS[entry.code] ?? entry.code} ·{" "}
              {formatDateTime(entry.at).slice(5, 16)} · {entry.operator}
            </li>
          ))}
        </ul>
      ) : null}

      <footer>
        <button
          className="primary-action"
          onClick={onSign}
          disabled={status === "signed"}
        >
          {status === "unsigned"
            ? "签署"
            : status === "revoked"
              ? "补签"
              : status === "stale"
                ? "重新确认"
                : "已签署"}
        </button>
        <button onClick={onPlan}>计划变化</button>
        <button onClick={onRegister}>登记</button>
      </footer>
    </article>
  );
}

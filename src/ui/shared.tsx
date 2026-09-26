// 表示层：共享 UI 原语
import type { ReactNode } from "react";
import {
  PLAN_ITEMS,
  RELATIONS,
  RISK_ITEMS,
} from "../data/catalog";
import type { RiskConfirmations } from "../data/types";
import { STATUS_META, type ConsentStatus } from "../domain/policy";

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function StatusBadge({ status }: { status: ConsentStatus }) {
  const meta = STATUS_META[status];
  return <span className={`badge tone-${meta.tone}`}>{meta.label}</span>;
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required ? <em className="req">*</em> : null}
        {hint ? <small className="field-hint">{hint}</small> : null}
      </span>
      {children}
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function RiskChecklist({
  value,
  onChange,
}: {
  value: RiskConfirmations;
  onChange: (next: RiskConfirmations) => void;
}) {
  const toggle = (id: keyof RiskConfirmations) =>
    onChange({ ...value, [id]: !value[id] });
  return (
    <div className="risk-list">
      {RISK_ITEMS.map((item) => (
        <label key={item.id} className="risk-item">
          <input
            type="checkbox"
            checked={value[item.id]}
            onChange={() => toggle(item.id)}
          />
          <div>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

export function emptyRisks(): RiskConfirmations {
  return { anesthesia: false, instrument: false, postop: false, outcome: false };
}

export function PlanPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (code: string) =>
    onChange(
      value.includes(code)
        ? value.filter((item) => item !== code)
        : [...value, code],
    );
  return (
    <div className="plan-picker">
      {PLAN_ITEMS.map((item) => (
        <label key={item.code} className="plan-option">
          <input
            type="checkbox"
            checked={value.includes(item.code)}
            onChange={() => toggle(item.code)}
          />
          <span>{item.label}</span>
          {item.hint ? <small>{item.hint}</small> : null}
        </label>
      ))}
    </div>
  );
}

export function RelationSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">请选择关系</option>
      {RELATIONS.map((relation) => (
        <option key={relation} value={relation}>
          {relation}
        </option>
      ))}
    </select>
  );
}

export function LockTag() {
  return <span className="lock-tag">🔒 已锁定</span>;
}

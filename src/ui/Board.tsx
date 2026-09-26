// 表示层：看板（指标、筛选、按患者分组的牙位核对台）
import { useMemo, useState } from "react";
import type { DeskState, SignPayload } from "../data/types";
import { groupByPatient, metricsOf } from "../domain/selectors";
import { consentStatus } from "../domain/policy";
import type { ConsentStatus } from "../domain/policy";
import { STATUS_META } from "../domain/policy";
import { ToothCard } from "./ToothCard";
import { Drawer, type DrawerAction } from "./Drawer";
import {
  CorrectDialog,
  NewConsentDialog,
  PlanChangeDialog,
  RegisterStepDialog,
  RevokeDialog,
  SignDialog,
} from "./Dialogs";

type DialogType = "new" | "sign" | "plan" | "correct" | "revoke" | "register";

const FILTERS: Array<{ key: "all" | ConsentStatus; label: string }> = [
  { key: "all", label: "全部" },
  { key: "unsigned", label: STATUS_META.unsigned.label },
  { key: "stale", label: STATUS_META.stale.label },
  { key: "signed", label: STATUS_META.signed.label },
  { key: "revoked", label: STATUS_META.revoked.label },
];

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "warn" | "ok" | "danger";
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function Board({
  state,
  act,
}: {
  state: DeskState;
  act: (action: import("../domain/reducer").DeskAction) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ConsentStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogType | null>(null);

  const metrics = metricsOf(state);
  const groups = useMemo(() => groupByPatient(state), [state]);

  const selected = state.consents.find((item) => item.id === selectedId) ?? null;
  const selectedPatient = selected
    ? state.patients.find((patient) => patient.id === selected.patientId)
    : null;

  const keyword = query.trim().toLowerCase();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter(({ consent, patient }) => {
        const matchStatus =
          filter === "all" || consentStatus(consent) === filter;
        const matchQuery =
          !keyword ||
          patient.name.toLowerCase().includes(keyword) ||
          patient.recordNo.toLowerCase().includes(keyword) ||
          consent.tooth.includes(keyword) ||
          consent.diagnosis.toLowerCase().includes(keyword);
        return matchStatus && matchQuery;
      }),
    }))
    .filter((group) => group.rows.length > 0);

  const openDialog = (consentId: string, type: DialogType) => {
    setSelectedId(consentId);
    setDialog(type);
  };
  const closeDialog = () => setDialog(null);

  return (
    <>
      <section className="metrics-grid">
        <MetricCard label="待重新确认（计划已变化）" value={metrics.stale} tone="warn" />
        <MetricCard label="未签署" value={metrics.unsigned} tone="neutral" />
        <MetricCard label="已撤销（需补签）" value={metrics.revoked} tone="danger" />
        <MetricCard label="已充填" value={metrics.obturated} tone="ok" />
      </section>

      <section className="toolbar panel">
        <input
          className="search-box"
          placeholder="搜索患者姓名 / 病历号 / 牙位 / 诊断"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="filter-chips">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              className={filter === item.key ? "chip active" : "chip"}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          className="primary-action"
          onClick={() => {
            setSelectedId(null);
            setDialog("new");
          }}
        >
          + 新增同意书
        </button>
      </section>

      <section className="board">
        {visibleGroups.length === 0 ? (
          <div className="panel empty-state">没有匹配的牙位记录。</div>
        ) : (
          visibleGroups.map(({ patient, rows }) => (
            <div key={patient.id} className="patient-group">
              <header className="group-head">
                <h2>{patient.name}</h2>
                <span className="record-no">病历号 {patient.recordNo}</span>
                <span className="tooth-count">{rows.length} 颗牙</span>
              </header>
              <div className="tooth-grid">
                {rows.map(({ consent }) => (
                  <ToothCard
                    key={consent.id}
                    consent={consent}
                    onOpen={() => setSelectedId(consent.id)}
                    onSign={() => openDialog(consent.id, "sign")}
                    onPlan={() => openDialog(consent.id, "plan")}
                    onRegister={() => openDialog(consent.id, "register")}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {selected && selectedPatient ? (
        <Drawer
          consent={selected}
          patientName={selectedPatient.name}
          recordNo={selectedPatient.recordNo}
          onClose={() => setSelectedId(null)}
          onAction={(action: DrawerAction) => setDialog(action.kind)}
        />
      ) : null}

      {dialog === "new" ? (
        <NewConsentDialog
          onClose={closeDialog}
          onSubmit={(input) => {
            const ok = act({ type: "addConsent", ...input });
            return ok;
          }}
        />
      ) : null}
      {dialog === "sign" && selected ? (
        <SignDialog
          consent={selected}
          onClose={closeDialog}
          onSubmit={(payload: SignPayload) =>
            act({ type: "sign", consentId: selected.id, payload })
          }
        />
      ) : null}
      {dialog === "plan" && selected ? (
        <PlanChangeDialog
          consent={selected}
          onClose={closeDialog}
          onSubmit={(nextPlan, reason, changedBy) =>
            act({
              type: "changePlan",
              consentId: selected.id,
              nextPlan,
              reason,
              changedBy,
            })
          }
        />
      ) : null}
      {dialog === "correct" && selected ? (
        <CorrectDialog
          consent={selected}
          onClose={closeDialog}
          onSubmit={(reason, fields) =>
            act({ type: "correct", consentId: selected.id, reason, fields })
          }
        />
      ) : null}
      {dialog === "revoke" && selected ? (
        <RevokeDialog
          consent={selected}
          onClose={closeDialog}
          onSubmit={(reason) =>
            act({ type: "revoke", consentId: selected.id, reason })
          }
        />
      ) : null}
      {dialog === "register" && selected ? (
        <RegisterStepDialog
          consent={selected}
          onClose={closeDialog}
          onSubmit={(code, operator, note) =>
            act({
              type: "registerStep",
              consentId: selected.id,
              code,
              operator,
              note,
            })
          }
        />
      ) : null}
    </>
  );
}

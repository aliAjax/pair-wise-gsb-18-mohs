// 判断层：读模型（看板汇总与患者分组）
import type { DeskState, Patient, ToothConsent } from "../data/types";
import { consentStatus, hasProcedure } from "./policy";

export interface ConsentRow {
  consent: ToothConsent;
  patient: Patient;
}

export function rowsOf(state: DeskState): ConsentRow[] {
  return state.consents.map((consent) => ({
    consent,
    patient:
      state.patients.find((patient) => patient.id === consent.patientId) ?? {
        id: "unknown",
        name: "未知患者",
        recordNo: "-",
      },
  }));
}

export function groupByPatient(state: DeskState): Array<{
  patient: Patient;
  rows: ConsentRow[];
}> {
  return state.patients
    .map((patient) => ({
      patient,
      rows: rowsOf(state)
        .filter((row) => row.patient.id === patient.id)
        .sort((a, b) => a.consent.tooth.localeCompare(b.consent.tooth)),
    }))
    .filter((group) => group.rows.length > 0);
}

export interface DeskMetrics {
  unsigned: number;
  stale: number;
  revoked: number;
  obturated: number;
}

export function metricsOf(state: DeskState): DeskMetrics {
  const metrics: DeskMetrics = { unsigned: 0, stale: 0, revoked: 0, obturated: 0 };
  for (const consent of state.consents) {
    const status = consentStatus(consent);
    if (status === "unsigned") metrics.unsigned += 1;
    if (status === "stale") metrics.stale += 1;
    if (status === "revoked") metrics.revoked += 1;
    if (hasProcedure(consent, "obturation")) metrics.obturated += 1;
  }
  return metrics;
}

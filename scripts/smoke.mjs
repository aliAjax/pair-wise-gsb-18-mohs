// 领域规则冒烟测试：esbuild 打包后由 node 执行，不依赖浏览器
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "consent-smoke-"));
const entry = join(dir, "entry.ts");
writeFileSync(
  entry,
  `
import { createSeedState } from "/workspace/src/data/seed";
import { deskReducer } from "/workspace/src/domain/reducer";
import { canRegisterStep, consentStatus, latestVersion, latestSignedVersion } from "/workspace/src/domain/policy";
import { validateState } from "/workspace/src/storage/repository";

let failures = 0;
function check(name, cond) {
  if (cond) console.log("PASS", name);
  else { console.error("FAIL", name); failures += 1; }
}
function risks() { return { anesthesia: true, instrument: true, postop: true, outcome: true }; }

let state = createSeedState();
const c36 = state.consents.find(c => c.tooth === "36");
const c46 = state.consents.find(c => c.tooth === "46");
const c11 = state.consents.find(c => c.tooth === "11");
const c26 = state.consents.find(c => c.tooth === "26");

check("36 计划加做显微治疗 → 待重新确认", consentStatus(c36) === "stale");
check("36 充填登记被拦", canRegisterStep(c36, "obturation").ok === false);
check("46 未签署 → 开髓被拦", canRegisterStep(c46, "access").ok === false);
check("11 已签署且一致", consentStatus(c11) === "signed");
check("11 充填允许", canRegisterStep(c11, "obturation").ok === true);
check("26 已撤销", consentStatus(c26) === "revoked");
check("26 开髓被拦", canRegisterStep(c26, "access").ok === false);

// 未签风险全选不能签
const badSign = () => deskReducer(state, { type: "sign", consentId: c46.id, payload: {
  signDate: "2026-09-26", signerName: "王秀兰", signerRelation: "本人", agentName: "周敏",
  riskConfirmed: { anesthesia: true, instrument: false, postop: true, outcome: true }, reason: "" } });
check("风险未全选签署被拒", (() => { try { badSign(); return false; } catch { return true; } })());

// 46 首签成功
state = deskReducer(state, { type: "sign", consentId: c46.id, payload: {
  signDate: "2026-09-26", signerName: "王秀兰", signerRelation: "本人", agentName: "周敏（助理）",
  riskConfirmed: risks(), reason: "" } });
let c46next = state.consents.find(c => c.id === c46.id);
check("46 首签后状态已签署", consentStatus(c46next) === "signed");
check("46 首签版本 v1 锁定", c46next.versions[0].version === 1 && c46next.versions[0].locked === true);
check("46 开髓放行", canRegisterStep(c46next, "access").ok === true);

// 未开髓不能先充填
check("未开髓先充填被拦", canRegisterStep(c46next, "obturation").ok === false);

// 登记开髓
state = deskReducer(state, { type: "registerStep", consentId: c46.id, code: "access", operator: "高医生", note: "开髓" });
c46next = state.consents.find(c => c.id === c46.id);
check("开髓已登记", c46next.procedureLog.some(p => p.code === "access"));
check("开髓后充填放行", canRegisterStep(c46next, "obturation").ok === true);

// 11 计划变化（加做显微）→ stale，无原因被拒
const mustFail = (fn) => { try { fn(); return false; } catch { return true; } };
check("计划变化无原因被拒", mustFail(() => deskReducer(state, { type: "changePlan", consentId: c11.id, nextPlan: [...c11.plannedProcedures, "microscope"], reason: "  ", changedBy: "林医生" })));
state = deskReducer(state, { type: "changePlan", consentId: c11.id, nextPlan: [...c11.plannedProcedures, "microscope"], reason: "术中钙化需显微辅助", changedBy: "林医生" });
let c11next = state.consents.find(c => c.id === c11.id);
check("11 变化后待重新确认", consentStatus(c11next) === "stale");
check("11 开髓被拦（重新确认前）", canRegisterStep(c11next, "access").ok === false);
check("11 充填被拦（重新确认前）", canRegisterStep(c11next, "obturation").ok === false);
check("重签无原因被拒", mustFail(() => deskReducer(state, { type: "sign", consentId: c11.id, payload: {
  signDate: "2026-09-26", signerName: "李建国", signerRelation: "本人", agentName: "周敏", riskConfirmed: risks(), reason: "" } })));
state = deskReducer(state, { type: "sign", consentId: c11.id, payload: {
  signDate: "2026-09-26", signerName: "李建国", signerRelation: "本人", agentName: "周敏（助理）", riskConfirmed: risks(), reason: "加做显微治疗，重新告知" } });
c11next = state.consents.find(c => c.id === c11.id);
check("11 重签后已签署", consentStatus(c11next) === "signed");
check("生成 v2 且类型 plan-change", c11next.versions.length === 2 && c11next.versions[1].kind === "plan-change");
const change = c11next.versions[1].changes[0];
check("v2 保留计划旧值/新值", change.oldValue.includes("显微") === false && change.newValue.includes("显微根管治疗"));
check("v2 记录原因", c11next.versions[1].reason === "加做显微治疗，重新告知");
check("旧 v1 未被改写", c11next.versions[0].planSnapshot.includes("microscope") === false);

// 撤销 → 补签
state = deskReducer(state, { type: "revoke", consentId: c46.id, reason: "患者临时改期" });
let c46rev = state.consents.find(c => c.id === c46.id);
check("撤销后状态 revoked", consentStatus(c46rev) === "revoked");
check("撤销版本 riskConfirmed 为 null", latestVersion(c46rev).riskConfirmed === null);
check("撤销后开髓被拦", canRegisterStep(c46rev, "access").ok === false);
check("重复撤销被拒", mustFail(() => deskReducer(state, { type: "revoke", consentId: c46.id, reason: "x" })));
state = deskReducer(state, { type: "sign", consentId: c46.id, payload: {
  signDate: "2026-09-27", signerName: "王秀兰", signerRelation: "本人", agentName: "周敏（助理）", riskConfirmed: risks(), reason: "患者复诊补签" } });
let c46resign = state.consents.find(c => c.id === c46.id);
check("补签类型 resign 且恢复", c46resign.versions.at(-1).kind === "resign" && consentStatus(c46resign) === "signed");
check("补签来源版本指向撤销版", c46resign.versions.at(-1).sourceVersion === 2);

// 更正：改代办人，要求原因与旧值
check("更正无原因被拒", mustFail(() => deskReducer(state, { type: "correct", consentId: c11.id, reason: " ", fields: { signDate: "2026-09-26", signerName: "李建国", signerRelation: "本人", agentName: "周敏（助理）" } })));
check("更正无变化被拒", mustFail(() => deskReducer(state, { type: "correct", consentId: c11.id, reason: "核对", fields: { signDate: "2026-09-26", signerName: "李建国", signerRelation: "本人", agentName: "周敏（助理）" } })));
state = deskReducer(state, { type: "correct", consentId: c11.id, reason: "代办人录入错误", fields: { signDate: "2026-09-26", signerName: "李建国", signerRelation: "本人", agentName: "吴桐（助理）" } });
c11next = state.consents.find(c => c.id === c11.id);
const v3 = c11next.versions.at(-1);
check("更正生成 v3", v3.version === 3 && v3.kind === "correction");
const agentChange = v3.changes.find(ch => ch.field === "agentName");
check("v3 保留代办人旧值", agentChange && agentChange.oldValue === "周敏（助理）" && agentChange.newValue === "吴桐（助理）");
check("v3 原因留痕", v3.reason === "代办人录入错误");
check("旧版本仍锁定且未被修改", c11next.versions[1].agentName === "周敏（助理）");

// 同患者同牙位不能重复
check("重复牙位被拒", mustFail(() => deskReducer(state, { type: "addConsent", patientName: "王秀兰", recordNo: "2026090101", tooth: "46", diagnosis: "x", plannedProcedures: ["access"] })));
check("牙位格式校验", mustFail(() => deskReducer(state, { type: "addConsent", patientName: "赵六", recordNo: "2026092699", tooth: "6", diagnosis: "x", plannedProcedures: ["access"] })));

// 存储层结构校验
check("validateState 接受正常状态", validateState(state) === true);
check("validateState 拒绝坏数据", validateState({ schemaVersion: 1, patients: [], consents: [{ id: 1 }] }) === false);

if (failures > 0) { console.error(failures + " 项失败"); process.exit(1); }
console.log("全部冒烟用例通过");
`,
);

await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: join(dir, "out.mjs"),
  absWorkingDir: "/workspace",
  logLevel: "silent",
});

await import(join(dir, "out.mjs"));

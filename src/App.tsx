import { useDesk } from "./state/useDesk";
import { Board } from "./ui/Board";

function App() {
  const { state, error, clearError, act, resetToSeed } = useDesk();

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-04 · 牙体牙髓科 · 知情同意核对台</p>
          <h1>知情同意核对台</h1>
          <p className="subtitle">
            按患者与牙位分别管理知情同意书：记录版本、签署日期、代办人与四项风险确认。
            换牙位开髓或加做显微治疗后须重新签署，未确认前不能登记开髓或充填；版本一旦锁定不可改写。
          </p>
        </div>
        <div className="stack-card">
          <span>资料 / 判断 / 存储 三层分离</span>
          <strong>类型目录与种子 · 纯函数领域规则 · localStorage 仓储</strong>
          <small>重开页面后状态与版本记录仍可见</small>
        </div>
      </section>

      {error ? (
        <div className="error-banner" role="alert">
          <span>⛔ {error}</span>
          <button onClick={clearError}>知道了</button>
        </div>
      ) : null}

      <Board state={state} act={act} />

      <footer className="page-foot">
        <button onClick={resetToSeed}>恢复演示数据</button>
        <span>数据保存在本机浏览器（localStorage），仅用于科室内部核对演示。</span>
      </footer>
    </main>
  );
}

export default App;

// 状态编排：连接判断层与存储层（UI 不直接接触 localStorage / reducer 细节）
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { deskReducer, type DeskAction } from "../domain/reducer";
import { consentRepository } from "../storage/repository";
import type { DeskState } from "../data/types";

export interface DeskApi {
  state: DeskState;
  error: string | null;
  clearError: () => void;
  /** 提交动作；业务校验失败时返回 false 并暴露原因，不改变数据 */
  act: (action: DeskAction) => boolean;
  resetToSeed: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作未完成，请检查输入。";
}

export function useDesk(): DeskApi {
  const [state, dispatch] = useReducer(deskReducer, undefined, () =>
    consentRepository.load(),
  );
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 状态变化即落盘：重开页面后状态与版本记录仍可见
  useEffect(() => {
    consentRepository.save(state);
  }, [state]);

  const act = useCallback((action: DeskAction) => {
    try {
      // 纯函数预检：失败直接抛错，不触发状态更新
      deskReducer(stateRef.current, action);
      setError(null);
      dispatch(action);
      return true;
    } catch (caught) {
      setError(errorMessage(caught));
      return false;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const resetToSeed = useCallback(() => {
    // 先写回种子数据，再重新加载：reducer 初始化时会读取仓储
    consentRepository.reset();
    window.location.reload();
  }, []);

  return { state, error, clearError, act, resetToSeed };
}

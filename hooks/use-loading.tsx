'use client';

import { useState, useCallback } from 'react';

/**
 * ローディング状態管理のためのカスタムフック
 */
export function useLoading(initialState: boolean = false) {
  const [isLoading, setIsLoading] = useState(initialState);

  const startLoading = useCallback(() => setIsLoading(true), []);
  const stopLoading = useCallback(() => setIsLoading(false), []);
  const toggleLoading = useCallback(() => setIsLoading(prev => !prev), []);

  // 非同期関数を実行しながらローディング状態を管理
  const executeWithLoading = useCallback(async <T>(
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    startLoading();
    try {
      const result = await asyncFn();
      return result;
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading]);

  return {
    isLoading,
    startLoading,
    stopLoading,
    toggleLoading,
    executeWithLoading,
  };
}

/**
 * 複数のローディング状態を管理するフック
 */
export function useMultipleLoading() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: loading
    }));
  }, []);

  const isLoading = useCallback((key: string): boolean => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  const isAnyLoading = useCallback((): boolean => {
    return Object.values(loadingStates).some(Boolean);
  }, [loadingStates]);

  const clearAll = useCallback(() => {
    setLoadingStates({});
  }, []);

  const executeWithLoading = useCallback(async <T>(
    key: string,
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    setLoading(key, true);
    try {
      const result = await asyncFn();
      return result;
    } finally {
      setLoading(key, false);
    }
  }, [setLoading]);

  return {
    loadingStates,
    setLoading,
    isLoading,
    isAnyLoading,
    clearAll,
    executeWithLoading,
  };
}

/**
 * タイムアウト付きローディング状態管理
 */
export function useLoadingWithTimeout(timeoutMs: number = 30000) {
  const { isLoading, startLoading, stopLoading, executeWithLoading } = useLoading();
  const [isTimedOut, setIsTimedOut] = useState(false);

  const executeWithTimeout = useCallback(async <T>(
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    setIsTimedOut(false);
    const timeoutId = setTimeout(() => {
      setIsTimedOut(true);
      stopLoading();
    }, timeoutMs);

    try {
      const result = await executeWithLoading(asyncFn);
      clearTimeout(timeoutId);
      setIsTimedOut(false);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      setIsTimedOut(false);
      throw error;
    }
  }, [executeWithLoading, stopLoading, timeoutMs]);

  return {
    isLoading,
    isTimedOut,
    startLoading,
    stopLoading,
    executeWithTimeout,
  };
}

/**
 * 段階的ローディング状態管理（例：準備中 → 処理中 → 完了）
 */
export function useSteppedLoading<T extends string>(steps: readonly T[]) {
  const [currentStep, setCurrentStep] = useState<T | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<T>>(new Set());

  const startStep = useCallback((step: T) => {
    setCurrentStep(step);
  }, []);

  const completeStep = useCallback((step: T) => {
    setCompletedSteps(prev => new Set([...prev, step]));
    setCurrentStep(null);
  }, []);

  const isStepActive = useCallback((step: T): boolean => {
    return currentStep === step;
  }, [currentStep]);

  const isStepCompleted = useCallback((step: T): boolean => {
    return completedSteps.has(step);
  }, [completedSteps]);

  const reset = useCallback(() => {
    setCurrentStep(null);
    setCompletedSteps(new Set());
  }, []);

  const isAnyStepActive = currentStep !== null;

  const executeStep = useCallback(async <R>(
    step: T,
    asyncFn: () => Promise<R>
  ): Promise<R> => {
    startStep(step);
    try {
      const result = await asyncFn();
      completeStep(step);
      return result;
    } catch (error) {
      setCurrentStep(null);
      throw error;
    }
  }, [startStep, completeStep]);

  return {
    currentStep,
    completedSteps,
    startStep,
    completeStep,
    isStepActive,
    isStepCompleted,
    isAnyStepActive,
    reset,
    executeStep,
  };
}

/**
 * デバウンス付きローディング状態（高頻度の更新を制御）
 */
export function useDebouncedLoading(delay: number = 300) {
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedIsLoading, setDebouncedIsLoading] = useState(false);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setDebouncedIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    const timeoutId = setTimeout(() => {
      setDebouncedIsLoading(false);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [delay]);

  return {
    isLoading,
    debouncedIsLoading,
    startLoading,
    stopLoading,
  };
}

/**
 * ローディング状態のコンテキストプロバイダー用の型
 */
export interface LoadingContextValue {
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
  componentLoadings: Record<string, boolean>;
  setComponentLoading: (component: string, loading: boolean) => void;
}

/**
 * 使用例：
 * 
 * // 基本的な使用
 * const { isLoading, executeWithLoading } = useLoading();
 * 
 * const handleSubmit = async () => {
 *   await executeWithLoading(async () => {
 *     await submitData();
 *   });
 * };
 * 
 * // 複数のローディング状態
 * const { isLoading, executeWithLoading } = useMultipleLoading();
 * 
 * const loadUsers = () => executeWithLoading('users', fetchUsers);
 * const loadPosts = () => executeWithLoading('posts', fetchPosts);
 * 
 * // 段階的ローディング
 * const steps = ['preparing', 'uploading', 'processing'] as const;
 * const { currentStep, executeStep } = useSteppedLoading(steps);
 * 
 * const handleUpload = async () => {
 *   await executeStep('preparing', prepareFiles);
 *   await executeStep('uploading', uploadFiles);
 *   await executeStep('processing', processFiles);
 * };
 */
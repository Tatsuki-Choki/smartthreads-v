'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from './loading-states';
import { cn } from '@/lib/utils';

/**
 * グローバルローディング表示コンポーネント
 * ページ遷移時の読み込み状態を表示
 */
export function GlobalLoading() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleStart = () => {
      // 短時間の遷移では表示しないように少し遅延
      timeoutId = setTimeout(() => {
        setIsLoading(true);
      }, 100);
    };

    const handleComplete = () => {
      clearTimeout(timeoutId);
      setIsLoading(false);
    };

    // Next.js App Routerでのルート変更検知は困難なため、
    // 代わりにリンククリック等でのローディング表示を実装
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-4">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">ページを読み込み中...</p>
      </div>
    </div>
  );
}

/**
 * トップレベルの進行状況バー
 */
export function TopProgressBar() {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  // ページの読み込み進行状況をシミュレート
  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const startProgress = () => {
    setIsVisible(true);
    setProgress(10);
  };

  const completeProgress = () => {
    setProgress(100);
    setTimeout(() => {
      setIsVisible(false);
      setProgress(0);
    }, 200);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-background">
      <div 
        className="h-full bg-primary transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/**
 * APIリクエスト状態表示
 */
interface ApiLoadingIndicatorProps {
  requests: number;
  className?: string;
}

export function ApiLoadingIndicator({ 
  requests, 
  className 
}: ApiLoadingIndicatorProps) {
  if (requests === 0) return null;

  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-40 bg-background border rounded-lg px-3 py-2 shadow-lg',
      className
    )}>
      <div className="flex items-center gap-2">
        <Spinner size="sm" />
        <span className="text-xs text-muted-foreground">
          {requests > 1 ? `${requests}件の` : ''}処理中...
        </span>
      </div>
    </div>
  );
}

/**
 * フェードインローディング
 */
interface FadeLoadingProps {
  loading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  delay?: number;
}

export function FadeLoading({ 
  loading, 
  children, 
  fallback,
  className,
  delay = 0 
}: FadeLoadingProps) {
  const [showLoading, setShowLoading] = useState(loading);

  useEffect(() => {
    if (loading) {
      const timeoutId = setTimeout(() => {
        setShowLoading(true);
      }, delay);
      return () => clearTimeout(timeoutId);
    } else {
      setShowLoading(false);
    }
  }, [loading, delay]);

  return (
    <div className={cn('relative', className)}>
      <div 
        className={cn(
          'transition-opacity duration-300',
          showLoading ? 'opacity-30 pointer-events-none' : 'opacity-100'
        )}
      >
        {children}
      </div>
      
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          {fallback || <Spinner />}
        </div>
      )}
    </div>
  );
}

/**
 * コンテンツ切り替え時のローディング
 */
interface ContentSwitchLoadingProps {
  loading: boolean;
  currentContent: React.ReactNode;
  loadingContent?: React.ReactNode;
  className?: string;
}

export function ContentSwitchLoading({
  loading,
  currentContent,
  loadingContent,
  className
}: ContentSwitchLoadingProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (loading) {
      setIsTransitioning(true);
    } else {
      const timeoutId = setTimeout(() => {
        setIsTransitioning(false);
      }, 150); // フェードアウト時間
      return () => clearTimeout(timeoutId);
    }
  }, [loading]);

  return (
    <div className={cn('relative', className)}>
      <div 
        className={cn(
          'transition-all duration-150',
          isTransitioning 
            ? 'opacity-0 transform scale-98' 
            : 'opacity-100 transform scale-100'
        )}
      >
        {isTransitioning ? (
          loadingContent || (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          )
        ) : (
          currentContent
        )}
      </div>
    </div>
  );
}

/**
 * 段階的表示ローディング（要素が順次表示される）
 */
interface StaggeredLoadingProps {
  items: React.ReactNode[];
  loading: boolean;
  staggerDelay?: number;
  className?: string;
}

export function StaggeredLoading({
  items,
  loading,
  staggerDelay = 100,
  className
}: StaggeredLoadingProps) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!loading && items.length > 0) {
      let count = 0;
      const interval = setInterval(() => {
        count++;
        setVisibleCount(count);
        if (count >= items.length) {
          clearInterval(interval);
        }
      }, staggerDelay);

      return () => clearInterval(interval);
    } else if (loading) {
      setVisibleCount(0);
    }
  }, [loading, items.length, staggerDelay]);

  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="animate-pulse bg-muted h-16 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {items.slice(0, visibleCount).map((item, index) => (
        <div
          key={index}
          className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

/**
 * React Suspense用のローディングフォールバック
 */
export function SuspenseLoading({ 
  message = '読み込み中...',
  minimal = false 
}: { 
  message?: string;
  minimal?: boolean;
}) {
  if (minimal) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-center space-y-4">
        <Spinner size="lg" />
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  );
}
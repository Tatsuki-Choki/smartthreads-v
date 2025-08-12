'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 基本的なスピナー
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  return (
    <Loader2 className={cn('animate-spin', sizeClasses[size], className)} />
  );
}

// インライン読み込み状態
interface InlineLoadingProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function InlineLoading({ 
  text = '読み込み中...', 
  size = 'md',
  className 
}: InlineLoadingProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Spinner size={size} />
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}

// ページ全体の読み込み状態
export function PageLoading({ message = '読み込み中...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <Spinner size="lg" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// カード形式の読み込み状態
export function CardLoading({ count = 1 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// テーブルの読み込み状態
export function TableLoading({ 
  columns = 4, 
  rows = 5 
}: { 
  columns?: number; 
  rows?: number; 
}) {
  return (
    <div className="space-y-3">
      {/* ヘッダー */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* 行 */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={`cell-${rowIndex}-${colIndex}`} 
              className="h-6 flex-1" 
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// リスト項目の読み込み状態
export function ListLoading({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

// フォームの読み込み状態
export function FormLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="flex gap-2 justify-end">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-16" />
      </div>
    </div>
  );
}

// 投稿カードの読み込み状態
export function PostCardLoading({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-48 w-full rounded-md" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// エラー状態と再試行
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ 
  message = 'データの読み込みに失敗しました', 
  onRetry,
  className 
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center min-h-[300px] space-y-4', className)}>
      <div className="text-center space-y-2">
        <p className="text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          再試行
        </Button>
      )}
    </div>
  );
}

// 空の状態
interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ 
  title = 'データがありません',
  description = 'まだ何も作成されていません',
  action,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center min-h-[300px] space-y-4', className)}>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

// ボタンの読み込み状態
interface LoadingButtonProps {
  loading: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
  onClick?: () => void;
}

export function LoadingButton({
  loading,
  children,
  disabled,
  className,
  variant = 'default',
  size = 'default',
  onClick
}: LoadingButtonProps) {
  return (
    <Button
      disabled={disabled || loading}
      className={className}
      variant={variant}
      size={size}
      onClick={onClick}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </Button>
  );
}

// プログレスバー
interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ 
  value, 
  max = 100, 
  className,
  showLabel = true 
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn('space-y-2', className)}>
      {showLabel && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>進行状況</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// スケルトンレイアウト構成用のコンポーネント
export function SkeletonLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-pulse">
      {children}
    </div>
  );
}
'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  fallbackSrc?: string;
  showSkeleton?: boolean;
  skeletonClassName?: string;
  containerClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  fallbackSrc = '/images/placeholder.png',
  showSkeleton = true,
  skeletonClassName,
  containerClassName,
  className,
  onLoad,
  onError,
  ...props
}: OptimizedImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  const handleLoad = () => {
    setLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    }
    onError?.();
  };

  return (
    <div className={cn('relative overflow-hidden', containerClassName)}>
      {loading && showSkeleton && (
        <Skeleton 
          className={cn(
            'absolute inset-0 w-full h-full',
            skeletonClassName
          )} 
        />
      )}
      
      <Image
        src={currentSrc}
        alt={alt}
        className={cn(
          'transition-opacity duration-300',
          loading ? 'opacity-0' : 'opacity-100',
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  );
}

// プロフィール画像専用コンポーネント
interface ProfileImageProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function ProfileImage({ 
  src, 
  alt, 
  size = 'md', 
  className 
}: ProfileImageProps) {
  const sizes = {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  };

  const sizeValue = sizes[size];

  return (
    <div className={cn(
      'relative rounded-full overflow-hidden bg-gray-100',
      className
    )}>
      <OptimizedImage
        src={src || '/images/default-avatar.png'}
        alt={alt}
        width={sizeValue}
        height={sizeValue}
        className="object-cover"
        fallbackSrc="/images/default-avatar.png"
      />
    </div>
  );
}

// メディア投稿用画像コンポーネント
interface MediaImageProps {
  src: string;
  alt: string;
  aspectRatio?: 'square' | 'video' | 'auto';
  className?: string;
  priority?: boolean;
}

export function MediaImage({ 
  src, 
  alt, 
  aspectRatio = 'auto',
  className,
  priority = false
}: MediaImageProps) {
  const aspectRatioClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    auto: '',
  };

  return (
    <div className={cn(
      'relative w-full overflow-hidden rounded-lg bg-gray-100',
      aspectRatioClasses[aspectRatio],
      className
    )}>
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        className="object-cover"
        priority={priority}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  );
}

// 複数画像のカルーセル/グリッド表示用
interface MediaGridProps {
  images: Array<{
    src: string;
    alt: string;
  }>;
  maxImages?: number;
  className?: string;
}

export function MediaGrid({ 
  images, 
  maxImages = 4, 
  className 
}: MediaGridProps) {
  const displayImages = images.slice(0, maxImages);
  const remainingCount = images.length - maxImages;

  const getGridLayout = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-2 grid-rows-2';
    return 'grid-cols-2 grid-rows-2';
  };

  return (
    <div className={cn(
      'grid gap-2',
      getGridLayout(displayImages.length),
      className
    )}>
      {displayImages.map((image, index) => (
        <div
          key={index}
          className={cn(
            'relative',
            displayImages.length === 3 && index === 0 ? 'row-span-2' : '',
            displayImages.length >= 4 && index >= 2 ? 'relative' : ''
          )}
        >
          <MediaImage
            src={image.src}
            alt={image.alt}
            aspectRatio="square"
            className="h-full"
          />
          
          {/* 残りの画像数を表示 */}
          {index === maxImages - 1 && remainingCount > 0 && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <span className="text-white font-semibold text-lg">
                +{remainingCount}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ローディング画像プレースホルダー
export function ImageSkeleton({ 
  className,
  aspectRatio = 'auto' 
}: {
  className?: string;
  aspectRatio?: 'square' | 'video' | 'auto';
}) {
  const aspectRatioClasses = {
    square: 'aspect-square',
    video: 'aspect-video',  
    auto: 'h-32',
  };

  return (
    <Skeleton className={cn(
      'w-full rounded-lg',
      aspectRatioClasses[aspectRatio],
      className
    )} />
  );
}

import React from 'react';
import { cn } from './Shadcn';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export const Skeleton = ({ className, ...props }: SkeletonProps) => {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800", className)}
      {...props}
    />
  );
};

export const SkeletonCard = () => (
    <div className="flex flex-col space-y-3">
      <Skeleton className="h-[125px] w-full rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
);

export const SkeletonList = ({ count = 5 }: { count?: number }) => (
    <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
        ))}
    </div>
);

import * as React from 'react';
import { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PullToRefresh = React.forwardRef<HTMLDivElement, PullToRefreshProps>(
  ({ onRefresh, children }, ref) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const threshold = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
      if (containerRef.current?.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (isRefreshing || containerRef.current?.scrollTop !== 0) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      
      if (diff > 0 && startY.current > 0) {
        // Apply resistance to pull
        const distance = Math.min(diff * 0.5, threshold * 1.5);
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
      startY.current = 0;
    };

    const progress = Math.min(pullDistance / threshold, 1);
    const rotation = progress * 180;

    return (
      <div
        ref={(node) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className="h-full overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: pullDistance }}
        >
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            style={{ transform: isRefreshing ? undefined : `rotate(${rotation}deg)` }}
          >
            <RefreshCw className={`w-5 h-5 ${progress >= 1 ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
        </div>
        
        {children}
      </div>
    );
  }
);

PullToRefresh.displayName = "PullToRefresh";

export { PullToRefresh };

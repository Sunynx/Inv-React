'use client';
import { useState, useEffect, useRef } from 'react';

/**
 * Hook that animates a number from 0 to target value
 * Uses easeOutExpo for a satisfying deceleration effect
 */
export function useAnimatedCounter(target: number, duration: number = 1200, enabled: boolean = true) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setCount(target);
      return;
    }

    const startValue = prevTarget.current;
    const startTime = performance.now();
    
    const easeOutExpo = (t: number): number => {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    };

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);
      
      const currentValue = Math.round(startValue + (target - startValue) * easedProgress);
      setCount(currentValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    prevTarget.current = target;

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target, duration, enabled]);

  return count;
}

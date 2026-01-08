
import { useState, useEffect, useRef } from 'react';

/**
 * Enforces a minimum loading time to ensure skeletons are visible 
 * long enough to prevent UI flashing on initial load, but avoids 
 * extending the wait time unnecessarily if the network is slow.
 * 
 * Strategy:
 * - Start timer when loading starts.
 * - When loading finishes, check elapsed time.
 * - If elapsed < minDuration, wait the difference.
 * - If elapsed > minDuration, hide immediately.
 * 
 * @param isLoading - The actual data loading state
 * @param minDuration - Minimum duration in ms (default 1000ms)
 * @returns boolean - True if skeleton should be shown
 */
export const useMinimumLoading = (isLoading: boolean, minDuration: number = 1000) => {
    const [showSkeleton, setShowSkeleton] = useState(isLoading);
    const startTimeRef = useRef<number | null>(null);

    useEffect(() => {
        if (isLoading) {
            setShowSkeleton(true);
            if (!startTimeRef.current) {
                startTimeRef.current = Date.now();
            }
        } else {
            if (startTimeRef.current) {
                const elapsed = Date.now() - startTimeRef.current;
                const remaining = minDuration - elapsed;

                if (remaining > 0) {
                    const timeout = setTimeout(() => {
                        setShowSkeleton(false);
                        startTimeRef.current = null;
                    }, remaining);
                    return () => clearTimeout(timeout);
                }
            }
            setShowSkeleton(false);
            startTimeRef.current = null;
        }
    }, [isLoading, minDuration]);

    return showSkeleton;
};

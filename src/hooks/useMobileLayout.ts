import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useMobileLayout() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isMobile };
}

export function useSafeAreaHeight() {
  // This is a placeholder. In a real app, you'd get this from the device.
  const [safeArea, setSafeArea] = useState({ top: 0, bottom: 0 });

  useEffect(() => {
    // Simulate getting safe area insets
    setSafeArea({ top: 20, bottom: 34 });
  }, []);

  const headerHeight = 44 + safeArea.top;
  const dockHeight = 50 + safeArea.bottom;

  return { headerHeight, dockHeight, safeArea };
}

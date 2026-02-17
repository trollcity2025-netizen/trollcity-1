import { useEffect, useMemo, useState } from 'react';

const MOBILE_BREAKPOINT = 768;
const BASE_HEADER_HEIGHT = 44;
const BASE_DOCK_HEIGHT = 50;

const readCssInset = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getSafeArea = () => {
  if (typeof window === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const styles = getComputedStyle(document.documentElement);
  return {
    top: readCssInset(styles.getPropertyValue('--sat')),
    bottom: readCssInset(styles.getPropertyValue('--sab')),
    left: readCssInset(styles.getPropertyValue('--sal')),
    right: readCssInset(styles.getPropertyValue('--sar')),
  };
};

export function useMobileLayout() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    setIsMobile(mediaQuery.matches);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return { isMobile };
}

export function useSafeAreaHeight() {
  const [safeArea, setSafeArea] = useState(() => getSafeArea());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let raf = 0;
    const updateSafeArea = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setSafeArea(getSafeArea());
      });
    };

    updateSafeArea();

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', updateSafeArea);
    viewport?.addEventListener('scroll', updateSafeArea);
    window.addEventListener('resize', updateSafeArea);
    window.addEventListener('orientationchange', updateSafeArea);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      viewport?.removeEventListener('resize', updateSafeArea);
      viewport?.removeEventListener('scroll', updateSafeArea);
      window.removeEventListener('resize', updateSafeArea);
      window.removeEventListener('orientationchange', updateSafeArea);
    };
  }, []);

  const headerHeight = useMemo(() => BASE_HEADER_HEIGHT + safeArea.top, [safeArea.top]);
  const dockHeight = useMemo(() => BASE_DOCK_HEIGHT + safeArea.bottom, [safeArea.bottom]);

  return { headerHeight, dockHeight, safeArea };
}

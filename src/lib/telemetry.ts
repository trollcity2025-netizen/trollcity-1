
export interface TelemetryEvent {
  event_type: string;
  message: string;
  stack?: string;
  fingerprint?: string;
  url?: string;
  user_id?: string;
  session_id?: string;
  device?: string;
  browser?: string;
  os?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  tags?: Record<string, any>;
  breadcrumbs?: Breadcrumb[];
  request_info?: Record<string, any>;
  extra?: Record<string, any>;
  env?: string;
  app_version?: string;
}

export interface Breadcrumb {
  timestamp: string;
  type: 'ui' | 'navigation' | 'api' | 'console';
  category?: string;
  message: string;
  data?: any;
}

const BREADCRUMB_LIMIT = 50;
const breadcrumbs: Breadcrumb[] = [];
let sessionId = sessionStorage.getItem('telemetry_session_id');

if (!sessionId) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    sessionId = crypto.randomUUID();
  } else {
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  sessionStorage.setItem('telemetry_session_id', sessionId);
}

const API_ENDPOINT = '/api/telemetry';

function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1) browser = 'Safari';
  else if (ua.indexOf('Edge') > -1) browser = 'Edge';
  
  let os = 'Unknown';
  if (ua.indexOf('Win') > -1) os = 'Windows';
  else if (ua.indexOf('Mac') > -1) os = 'MacOS';
  else if (ua.indexOf('Linux') > -1) os = 'Linux';
  else if (ua.indexOf('Android') > -1) os = 'Android';
  else if (ua.indexOf('iOS') > -1) os = 'iOS';

  return { browser, os, device: /Mobile|Tablet/.test(ua) ? 'Mobile' : 'Desktop' };
}

export function addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>) {
  breadcrumbs.push({
    ...breadcrumb,
    timestamp: new Date().toISOString()
  });
  if (breadcrumbs.length > BREADCRUMB_LIMIT) {
    breadcrumbs.shift();
  }
}

export async function trackEvent(event: Omit<TelemetryEvent, 'session_id' | 'device' | 'browser' | 'os' | 'breadcrumbs'>) {
  const { browser, os, device } = getBrowserInfo();
  
  const payload: TelemetryEvent = {
    ...event,
    session_id: sessionId!,
    device,
    browser,
    os,
    breadcrumbs: [...breadcrumbs], // Snapshot
    url: window.location.href,
    env: import.meta.env.MODE,
    app_version: '1.0.0' // Should come from package.json in a real build
  };

  try {
    // Fire and forget, but catch errors to prevent loops
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      keepalive: true // Ensure it sends even if page unloads
    }).catch(err => console.error('Telemetry send failed', err));
  } catch (e) {
    console.error('Telemetry construction failed', e);
  }
}

export function initTelemetry() {
  window.onerror = (message, source, lineno, colno, error) => {
    trackEvent({
      event_type: 'uncaught_error',
      message: String(message),
      stack: error?.stack,
      severity: 'error',
      fingerprint: `${message}-${source}-${lineno}`,
      extra: { source, lineno, colno }
    });
    addBreadcrumb({ type: 'console', category: 'error', message: String(message) });
  };

  window.onunhandledrejection = (event) => {
    trackEvent({
      event_type: 'unhandled_rejection',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      severity: 'error',
      fingerprint: `rejection-${event.reason?.message || String(event.reason)}`
    });
    addBreadcrumb({ type: 'console', category: 'error', message: 'Unhandled Rejection' });
  };

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const text = target.innerText?.slice(0, 30) || target.tagName;
    addBreadcrumb({
      type: 'ui',
      category: 'click',
      message: `Clicked ${target.tagName}`,
      data: { text, id: target.id, class: target.className }
    });
    detectRageClick(e);
  }, true);

  document.addEventListener('submit', (e) => {
    const target = e.target as HTMLFormElement | null
    if (!target) return
    const now = Date.now()
    const key = target.id || target.getAttribute('name') || window.location.pathname
    submitHistory = submitHistory.filter(s => now - s.time < REPEATED_SUBMIT_WINDOW)
    submitHistory.push({ key, time: now })
    const count = submitHistory.filter(s => s.key === key).length
    if (count >= REPEATED_SUBMIT_THRESHOLD) {
      trackEvent({
        event_type: 'repeated_submit',
        message: 'Repeated submit detected',
        severity: 'warning',
        fingerprint: `repeated_submit-${window.location.pathname}-${key}`,
        extra: { count }
      })
      submitHistory = submitHistory.filter(s => s.key !== key)
    }
  }, true)

  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      addBreadcrumb({
        type: 'navigation',
        message: `Navigated to ${window.location.pathname}`,
      });
    }
  }).observe(document, { subtree: true, childList: true });
}

// Stuck Detection
let clickHistory: { x: number, y: number, time: number }[] = [];
const RAGE_CLICK_THRESHOLD = 7;
const RAGE_CLICK_TIME = 4000;
const RAGE_CLICK_RADIUS = 20;
let submitHistory: { key: string, time: number }[] = [];
const REPEATED_SUBMIT_THRESHOLD = 3;
const REPEATED_SUBMIT_WINDOW = 30000;
type FlowTimer = { timeoutId: number; startedAt: number };
const flowTimers: Record<string, FlowTimer> = {};
const FLOW_ABANDONMENT_MINUTES_DEFAULT = 5;

function detectRageClick(e: MouseEvent) {
  const now = Date.now();
  clickHistory.push({ x: e.clientX, y: e.clientY, time: now });
  
  // Filter old clicks
  clickHistory = clickHistory.filter(c => now - c.time < RAGE_CLICK_TIME);
  
  if (clickHistory.length >= RAGE_CLICK_THRESHOLD) {
    // Check clustering
    const recent = clickHistory.slice(-RAGE_CLICK_THRESHOLD);
    const first = recent[0];
    const isCluster = recent.every(c => 
      Math.abs(c.x - first.x) < RAGE_CLICK_RADIUS && 
      Math.abs(c.y - first.y) < RAGE_CLICK_RADIUS
    );

    if (isCluster) {
      trackEvent({
        event_type: 'rage_click',
        message: 'Rage click detected',
        severity: 'warning',
        fingerprint: `rage_click-${window.location.pathname}-${first.x}-${first.y}`,
        extra: { clicks: clickHistory.length }
      });
      // Reset to avoid spam
      clickHistory = [];
    }
  }
}

export function reportSpinnerStuck(component: string, duration: number) {
  trackEvent({
    event_type: 'spinner_stuck',
    message: `Spinner stuck for ${duration}ms in ${component}`,
    severity: 'warning',
    fingerprint: `spinner-${component}`,
    extra: { duration }
  });
}

export function startFlow(flowName: string, timeoutMinutes: number = FLOW_ABANDONMENT_MINUTES_DEFAULT) {
  if (!flowName) return
  const existing = flowTimers[flowName]
  if (existing) {
    clearTimeout(existing.timeoutId)
  }
  const startedAt = Date.now()
  const timeoutMs = timeoutMinutes * 60 * 1000
  const timeoutId = window.setTimeout(() => {
    trackEvent({
      event_type: 'flow_abandonment',
      message: `Flow ${flowName} abandoned after ${timeoutMinutes} minutes`,
      severity: 'warning',
      fingerprint: `flow-${flowName}`,
      extra: { startedAt, timeoutMinutes }
    })
    delete flowTimers[flowName]
  }, timeoutMs)
  flowTimers[flowName] = { timeoutId, startedAt }
}

export function completeFlow(flowName: string) {
  const existing = flowTimers[flowName]
  if (!existing) return
  clearTimeout(existing.timeoutId)
  delete flowTimers[flowName]
  const startedAt = existing.startedAt
  const durationMs = Date.now() - startedAt
  trackEvent({
    event_type: 'flow_completed',
    message: `Flow ${flowName} completed`,
    severity: 'info',
    fingerprint: `flow-${flowName}`,
    extra: { startedAt, durationMs }
  })
}

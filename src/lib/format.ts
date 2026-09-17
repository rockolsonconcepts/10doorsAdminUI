export function formatDateTime(millis: number | null | undefined): string {
  if (!millis) return '—';
  return new Date(millis).toLocaleString();
}

export function formatRelative(millis: number | null | undefined, now = Date.now()): string {
  if (!millis) return '—';
  const diff = Math.max(0, now - millis);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatDuration(millis: number): string {
  const s = Math.floor(millis / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export function prettyJson(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function labelFor(enumValue: string): string {
  return enumValue.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function formatUntil(millis: number): string {
  const s = Math.max(0, Math.round((millis - Date.now()) / 1000));
  if (s < 60) return 'in <1 min';
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `in ${h}h ${m % 60}m`;
  return `in ${Math.floor(h / 24)} days`;
}

export function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 6) return cron;
  const [sec, min, hour, dom, , dow] = parts;
  const time = (h: string, m: string) => `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  if (sec === '0' && min.startsWith('*/') && hour === '*') return `every ${min.slice(2)} min`;
  if (sec === '0' && hour.startsWith('*/') && min !== '*') return `every ${hour.slice(2)} h at :${min.padStart(2, '0')}`;
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*') {
    if (dow === '*' || dow === '?') return `daily ${time(hour, min)}`;
    return `${dow.charAt(0) + dow.slice(1).toLowerCase()} ${time(hour, min)}`;
  }
  return cron;
}

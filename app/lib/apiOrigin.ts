/** Production API host for native builds (Capacitor). Empty on web → relative `/api`. */
const configuredOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? '';

export function getApiOrigin(): string {
  return configuredOrigin;
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return configuredOrigin ? `${configuredOrigin}${normalized}` : normalized;
}

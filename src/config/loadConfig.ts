export type AppEnv = 'development' | 'staging' | 'production';

export type AppConfig = {
  appEnv: AppEnv;
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  apiKey: string;
  scope: string;
};

const DEFAULT_CONFIG: AppConfig = {
  appEnv: 'development',
  apiBaseUrl: import.meta.env.DEV ? '/api' : 'http://localhost:8080',
  clientId: '',
  clientSecret: '',
  apiKey: '',
  scope: 'openid profile offline_access',
};

type RuntimeConfig = Partial<Record<keyof AppConfig, string>>;

function envOverrides(): Partial<AppConfig> {
  const env = import.meta.env;
  const out: Partial<AppConfig> = {};
  if (env.VITE_APP_ENV) out.appEnv = env.VITE_APP_ENV as AppEnv;
  if (env.VITE_API_BASE_URL) out.apiBaseUrl = env.VITE_API_BASE_URL;
  if (env.VITE_OAUTH_CLIENT_ID) out.clientId = env.VITE_OAUTH_CLIENT_ID;
  if (env.VITE_OAUTH_CLIENT_SECRET) out.clientSecret = env.VITE_OAUTH_CLIENT_SECRET;
  if (env.VITE_API_KEY) out.apiKey = env.VITE_API_KEY;
  if (env.VITE_OAUTH_SCOPE) out.scope = env.VITE_OAUTH_SCOPE;
  return out;
}

function nonEmpty(runtime: RuntimeConfig): Partial<AppConfig> {
  const out: Partial<AppConfig> = {};
  for (const key of ['appEnv', 'apiBaseUrl', 'clientId', 'clientSecret', 'apiKey', 'scope'] as const) {
    const value = runtime[key];
    if (typeof value === 'string' && value.trim() !== '') {
      (out as Record<string, string>)[key] = value;
    }
  }
  return out;
}

let cached: Promise<AppConfig> | null = null;

/** Priority: /config/app-config.json (runtime) > VITE_* (build) > defaults. */
export function loadConfig(): Promise<AppConfig> {
  if (!cached) {
    cached = (async () => {
      let runtime: RuntimeConfig = {};
      try {
        const response = await fetch('/config/app-config.json', { cache: 'no-store' });
        if (response.ok) runtime = (await response.json()) as RuntimeConfig;
      } catch {
        console.warn('Runtime config not available, using environment variables');
      }
      return { ...DEFAULT_CONFIG, ...envOverrides(), ...nonEmpty(runtime) };
    })();
  }
  return cached;
}

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { loadConfig } from '@/config/loadConfig';
import { TokenStorage } from './tokenStorage';
import { TokenResponse, isExpired, parseTokenResponse } from '@/model/TokenResponse';
import {
  AdminIdentity, AdministratorSummary, ClientConfiguration, Entitlement, HealthResponse,
  PagedResponse, SystemStatus, TracedError, TracedErrorSummary,
} from '@/model/admin';
import {
  AgentAction, AttributionLink, AudienceSegment, Campaign, Channel, ContentAsset, ContentCharter, MarketingInsight,
  MarketingObjective, Publication, PublicationStatus, StrategyRule,
} from '@/model/marketing';

export interface ApiError {
  status: number;
  message: string;
  detailMessage?: string;
  errorCode?: string;
  tracedErrorId?: string;
  path?: string;
}

export class BackendError extends Error {
  constructor(public readonly api: ApiError) {
    super(api.detailMessage || api.message);
  }
}

function toBackendError(error: unknown): BackendError {
  if (axios.isAxiosError(error)) {
    const e = error as AxiosError<Partial<ApiError>>;
    const data = e.response?.data;
    return new BackendError({
      status: e.response?.status ?? 0,
      message: data?.message ?? e.message,
      detailMessage: data?.detailMessage,
      errorCode: data?.errorCode,
      tracedErrorId: data?.tracedErrorId,
      path: data?.path,
    });
  }
  return new BackendError({ status: 0, message: error instanceof Error ? error.message : 'Unknown error' });
}

type UnauthorizedHandler = () => void;

class BackendApi {
  private http: AxiosInstance = axios.create();
  private onUnauthorized: UnauthorizedHandler | null = null;
  private refreshing: Promise<TokenResponse | null> | null = null;

  setUnauthorizedHandler(handler: UnauthorizedHandler) {
    this.onUnauthorized = handler;
  }

  // ---- auth -------------------------------------------------------------

  private async tokenCall(params: URLSearchParams, extraHeaders: Record<string, string> = {}): Promise<TokenResponse> {
    const config = await loadConfig();
    const basic = 'Basic ' + btoa(`${config.clientId}:${config.clientSecret}`);
    try {
      const res = await this.http.post(`${config.apiBaseUrl}/v1/oauth2/token`, params, {
        headers: {
          Authorization: basic,
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
          ...extraHeaders,
        },
      });
      return parseTokenResponse(res.data);
    } catch (e) {
      throw toBackendError(e);
    }
  }

  async login(username: string, password: string): Promise<TokenResponse> {
    const params = new URLSearchParams({ grant_type: 'password', username, password });
    const token = await this.tokenCall(params);
    TokenStorage.persistUserToken(token);
    return token;
  }

  private async refresh(current: TokenResponse): Promise<TokenResponse | null> {
    if (!this.refreshing) {
      this.refreshing = this.tokenCall(new URLSearchParams({ grant_type: 'refresh_token' }), {
        'refresh-token': current.refreshToken,
      })
        .then((t) => {
          TokenStorage.persistUserToken(t);
          return t;
        })
        .catch(() => null)
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  private async accessToken(): Promise<string | null> {
    const token = TokenStorage.getUserToken();
    if (!token) return null;
    if (!isExpired(token)) return token.accessToken;
    const refreshed = await this.refresh(token);
    return refreshed?.accessToken ?? null;
  }

  logout() {
    TokenStorage.clear();
  }

  // ---- generic ----------------------------------------------------------

  private async request<T>(config: AxiosRequestConfig & { url: string }): Promise<T> {
    const appConfig = await loadConfig();
    const token = await this.accessToken();
    if (!token) {
      this.onUnauthorized?.();
      throw new BackendError({ status: 401, message: 'Not signed in' });
    }
    try {
      const res = await this.http.request<T>({
        ...config,
        url: `${appConfig.apiBaseUrl}${config.url}`,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(appConfig.apiKey ? { 'x-api-key': appConfig.apiKey } : {}),
          ...(config.headers ?? {}),
        },
      });
      return res.data;
    } catch (e) {
      const err = toBackendError(e);
      if (err.api.status === 401) this.onUnauthorized?.();
      throw err;
    }
  }

  private get<T>(url: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>({ method: 'get', url, params });
  }
  private put<T>(url: string, data?: unknown, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>({ method: 'put', url, data, params });
  }
  private post<T>(url: string, data?: unknown) {
    return this.request<T>({ method: 'post', url, data });
  }

  // ---- public health (no auth) -----------------------------------------

  async health(): Promise<{ ok: boolean; latencyMs: number; message: string; status?: number }> {
    const config = await loadConfig();
    const started = performance.now();
    try {
      const res = await this.http.get<HealthResponse>(`${config.apiBaseUrl}/v1/health`, {
        timeout: 10_000,
        headers: config.apiKey ? { 'x-api-key': config.apiKey } : undefined,
      });
      return { ok: true, latencyMs: Math.round(performance.now() - started), message: res.data.message, status: res.status };
    } catch (e) {
      const err = toBackendError(e);
      return { ok: false, latencyMs: Math.round(performance.now() - started), message: err.message, status: err.api.status };
    }
  }

  // ---- admin console ----------------------------------------------------

  me = () => this.get<AdminIdentity>('/v1/admin/me');
  system = () => this.get<SystemStatus>('/v1/admin/system');
  tracedErrors = (params: { errorCode?: string; since?: number; page?: number; size?: number }) =>
    this.get<PagedResponse<TracedErrorSummary>>('/v1/admin/traced-errors', params);
  tracedError = (id: string) => this.get<TracedError>(`/v1/admin/traced-errors/${encodeURIComponent(id)}`);
  administrators = () => this.get<AdministratorSummary[]>('/v1/admin/administrators');
  clients = () => this.get<ClientConfiguration[]>('/v1/admin/clients');
  entitlements = (userId: string) => this.get<Entitlement[]>('/v1/admin/entitlements', { userId });

  // ---- marketing agent --------------------------------------------------

  pendingActions = () => this.get<AgentAction[]>('/v1/marketing/actions/pending');
  actions = (params?: { campaignId?: string; targetEntityId?: string }) => this.get<AgentAction[]>('/v1/marketing/actions', params);
  reviewAction = (actionId: string, approved: boolean, reason: string) =>
    this.put<AgentAction>(`/v1/marketing/actions/${actionId}/review`, { approved, reason });

  publications = (status: PublicationStatus) => this.get<Publication[]>('/v1/marketing/publications', { status });
  recordPublicationResult = (publicationId: string, body: { status: PublicationStatus; externalPostId?: string; externalUrl?: string; failureReason?: string }) =>
    this.put<Publication>(`/v1/marketing/publications/${publicationId}/result`, body);
  asset = (assetId: string) => this.get<ContentAsset>(`/v1/marketing/assets/${assetId}`);
  attributionLink = (attributionLinkId: string) => this.get<AttributionLink>(`/v1/marketing/attribution/links/${attributionLinkId}`);
  campaignLinks = (campaignId: string) => this.get<AttributionLink[]>('/v1/marketing/attribution/links', { campaignId });
  createAttributionLink = (link: Partial<AttributionLink>) => this.post<AttributionLink>('/v1/marketing/attribution/links', link);

  objectives = () => this.get<MarketingObjective[]>('/v1/marketing/objectives');
  segments = () => this.get<AudienceSegment[]>('/v1/marketing/segments');
  channels = () => this.get<Channel[]>('/v1/marketing/channels');
  campaigns = () => this.get<Campaign[]>('/v1/marketing/campaigns');
  rules = () => this.get<StrategyRule[]>('/v1/marketing/rules');
  insights = () => this.get<MarketingInsight[]>('/v1/marketing/insights');
  setRuleStatus = (ruleId: string, status: string) => this.put<StrategyRule>(`/v1/marketing/rules/${ruleId}/status`, { status });
  setInsightActive = (insightId: string, active: boolean) =>
    this.put<MarketingInsight>(`/v1/marketing/insights/${insightId}/active`, undefined, { active });
  createChannel = (channel: Partial<Channel>) => this.post<Channel>('/v1/marketing/channels', channel);
  updateChannel = (channelId: string, channel: Partial<Channel>) => this.put<Channel>(`/v1/marketing/channels/${channelId}`, channel);
  charter = () => this.get<ContentCharter>('/v1/marketing/charter');
  saveCharter = (charter: Partial<ContentCharter>) => this.put<ContentCharter>('/v1/marketing/charter', charter);
}

export const backendApi = new BackendApi();

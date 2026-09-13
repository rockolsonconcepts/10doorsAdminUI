export interface AdminIdentity {
  subjectId: string;
  email: string | null;
  clientId: string;
  systemAdmin: boolean;
}

export interface MarketingAgentStatus {
  enabled: boolean;
  openAiConfigured: boolean;
  googleAnalyticsConfigured: boolean;
  timezone: string;
  pendingReview: number;
  actionsLast24h: number;
  failedLast24h: number;
  lastActionAtMillis: number;
}

export interface SystemStatus {
  status: 'UP' | 'DEGRADED';
  databaseUp: boolean;
  databaseProduct: string;
  uptimeMillis: number;
  startedAtMillis: number;
  serverTimeMillis: number;
  activeProfiles: string[];
  javaVersion: string;
  applicationVersion: string;
  tracedErrorsLast24h: number;
  tracedErrorsLast7d: number;
  propertyManagers: number;
  tenants: number;
  properties: number;
  clients: number;
  marketingAgent: MarketingAgentStatus;
}

export interface HealthResponse {
  message: string;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface TracedErrorSummary {
  tracedErrorId: string;
  timestampMillis: number;
  errorCode: string | null;
  errorDescription: string | null;
  path: string | null;
  subjectId: string | null;
  subjectEntityType: string | null;
}

export interface TracedError {
  tracedErrorId: string;
  timestamp: string;
  errorDescription: string | null;
  exceptionTrace: string | null;
  subjectId: string | null;
  subjectEntityType: string | null;
  path: string | null;
  inputPayload: string | null;
  errorCode: string | null;
}

export interface AdministratorSummary {
  administratorId: string;
  email: string;
  createdAt: number;
  default: boolean;
}

export interface ClientConfiguration {
  clientId: string;
  clientName?: string;
  isDefault?: boolean;
  [key: string]: unknown;
}

export interface Entitlement {
  entitlementId: string;
  clientId: string;
  resourceId: string;
  resourceOwnerId: string;
  resourceType: string;
  role: string;
  [key: string]: unknown;
}

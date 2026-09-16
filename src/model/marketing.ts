export type GuardDecision = 'PENDING_REVIEW' | 'AUTO_APPROVED' | 'APPROVED' | 'REJECTED' | 'BLOCKED_BY_POLICY';
export type ExecutionStatus = 'NOT_EXECUTED' | 'EXECUTED' | 'FAILED' | 'SKIPPED';
export type PublicationStatus = 'PENDING' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED' | 'REMOVED';

export interface AgentAction {
  actionId: string;
  clientId: string;
  actionType: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  campaignId: string | null;
  proposedPayload: string | null;
  rationale: string | null;
  guardDecision: GuardDecision;
  guardReason: string | null;
  reviewedBy: string | null;
  reviewedAtMillis: number;
  executionStatus: ExecutionStatus;
  executedAtMillis: number;
  failureReason: string | null;
  modelUsed: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  createdAtMillis: number;
  updatedAtMillis: number;
}

export interface Publication {
  publicationId: string;
  contentAssetId: string | null;
  channelId: string | null;
  campaignId: string | null;
  attributionLinkId: string | null;
  targetLocation: string | null;
  externalPostId: string | null;
  externalUrl: string | null;
  scheduledAtMillis: number;
  publishedAtMillis: number;
  publicationStatus: PublicationStatus;
  failureReason: string | null;
  createdAtMillis: number;
}

export interface ContentAsset {
  contentAssetId: string;
  contentIdeaId: string | null;
  contentType: string;
  targetChannelType: string | null;
  title: string | null;
  body: string | null;
  hook: string | null;
  topic: string | null;
  callToAction: string | null;
  contentStatus: string;
  createdAtMillis: number;
}

export interface ContentCharter {
  contentCharterId: string | null;
  clientId: string | null;
  productName: string | null;
  voice: string | null;
  audienceTruths: string | null;
  contentPrinciples: string | null;
  productMentionGuidance: string | null;
  bannedPhrases: string | null;
  goodExample: string | null;
  badExample: string | null;
  maxPromotionalShare: number | null;
  maxProductMentions: number;
  createdAtMillis: number;
  updatedAtMillis: number;
}

export interface MarketingObjective {
  objectiveId: string;
  name: string;
  description: string | null;
  type: string;
  targetValue: number | null;
  baselineValue: number | null;
  currentValue: number | null;
  status: string;
}

export interface AudienceSegment {
  audienceSegmentId: string;
  name: string;
  description: string | null;
  painPoints: string | null; // JSON array of strings
  interests: string | null; // JSON array of strings
  preferredContentTypes: string | null; // JSON array of ContentType names
  active: boolean;
}

export interface Channel {
  channelId: string;
  channelType: string;
  name: string;
  handle: string | null;
  enabled: boolean;
  capabilities: string | null; // JSON array of ChannelCapability names
  maxPostsPerDay: number;
}

export type AttributionScope = 'PUBLICATION' | 'CAMPAIGN';

export interface AttributionLink {
  attributionLinkId: string;
  code: string;
  scope: AttributionScope | null;
  vanityPath: string | null;
  trackedUrl: string;
  campaignId: string | null;
  publicationId: string | null;
  channelId: string | null;
  destinationUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  clickCount: number;
  active: boolean;
}

export interface StrategyRule {
  ruleId: string;
  name: string;
  ruleType: string;
  condition: string | null;
  action: string | null;
  priority: number | null;
  source: string;
  ruleStatus: string;
}

export interface MarketingInsight {
  marketingInsightId: string;
  insightType: string;
  statement: string;
  confidence: number | null;
  sampleSize: number;
  source: string;
  active: boolean;
  discoveredAtMillis: number;
}

export interface Campaign {
  campaignId: string;
  name: string;
  description: string | null;
  campaignStatus: string;
  objectiveId: string | null;
  hypothesis: string | null;
  startDateMillis: number;
  endDateMillis: number;
}

export const OBJECTIVE_TYPES = ['AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'REGISTRATION', 'ACTIVATION', 'PAID_CONVERSION', 'RETENTION', 'REVENUE'] as const;
export const CHANNEL_TYPES = ['REDDIT', 'INSTAGRAM', 'THREADS', 'LINKEDIN', 'X', 'FACEBOOK', 'BLOG', 'SUBSTACK', 'EMAIL', 'SEO', 'YOUTUBE', 'TIKTOK'] as const;

export type DiagnosticIntegration = 'openai' | 'google-analytics';

export interface ConnectionTestResponse {
  integration: DiagnosticIntegration;
  configured: boolean;
  ok: boolean;
  detail: string;
  latencyMillis: number;
  testedAtMillis: number;
}

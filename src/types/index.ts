// ============================================
// Database entity types
// ============================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  tenant_id: string;
  platform: Platform;
  external_account_id: string;
  name: string;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  tenant_id: string;
  account_id: string;
  external_id: string;
  name: string;
  status: EntityStatus;
  objective?: string;
  budget_daily?: number;
  budget_lifetime?: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Adset {
  id: string;
  tenant_id: string;
  campaign_id: string;
  external_id: string;
  name: string;
  status: EntityStatus;
  budget_daily?: number;
  budget_lifetime?: number;
  bid_strategy?: string;
  targeting?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Ad {
  id: string;
  tenant_id: string;
  adset_id: string;
  external_id: string;
  name: string;
  status: EntityStatus;
  creative_id?: string;
  ad_format?: string;
  created_at: string;
  updated_at: string;
}

export interface Creative {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  url?: string;
  thumbnail_url?: string;
  headline?: string;
  body?: string;
  call_to_action?: string;
  platform?: Platform;
  external_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Audience {
  id: string;
  tenant_id: string;
  name: string;
  platform: Platform;
  external_id?: string;
  size?: number;
  type?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Ad Insights (fact table)
// ============================================

export interface AdInsight {
  id?: string;
  tenant_id: string;
  date: string;
  hour?: number;
  platform: Platform;
  account_id?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  creative_id?: string;
  device?: string;
  placement?: string;
  age_range?: string;
  gender?: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  video_views?: number;
  video_completions?: number;
  likes?: number;
  shares?: number;
  comments?: number;
}

// ============================================
// Berekende metrics
// ============================================

export interface ComputedMetrics {
  ctr: number;      // clicks / impressions
  cpc: number;      // spend / clicks
  cpm: number;      // (spend / impressions) * 1000
  conversion_rate: number; // conversions / clicks
  roas: number;     // conversion_value / spend
  cost_per_conversion: number; // spend / conversions
}

export interface AggregatedMetrics extends ComputedMetrics {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
}

// ============================================
// Benchmarks
// ============================================

export interface Benchmark {
  id: string;
  tenant_id: string;
  platform: Platform;
  level: EntityLevel;
  metric: MetricName;
  min_value?: number;
  max_value?: number;
  target_value?: number;
  description?: string;
}

// ============================================
// Automation
// ============================================

export interface AutomationRule {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  level: EntityLevel;
  platform?: Platform;
  condition_json: RuleCondition[];
  action_json: RuleAction;
  mode: 'auto' | 'suggest';
  active: boolean;
  lookback_days: number;
  min_impressions: number;
  created_at: string;
  updated_at: string;
}

export interface RuleCondition {
  metric: MetricName;
  operator: ConditionOperator;
  value: number;
}

export interface RuleAction {
  type: 'pause' | 'enable' | 'adjust_budget' | 'adjust_bid' | 'notify';
  params?: Record<string, unknown>;
}

export interface AutomationLog {
  id: string;
  tenant_id: string;
  rule_id: string;
  entity_type: EntityLevel;
  entity_id: string;
  action: RuleAction;
  status: 'suggested' | 'executed' | 'failed' | 'dismissed';
  metrics_snapshot?: AggregatedMetrics;
  response?: string;
  reviewed_by?: string;
  created_at: string;
}

export interface AutomationResult {
  rule: AutomationRule;
  entity_type: EntityLevel;
  entity_id: string;
  entity_name: string;
  triggered: boolean;
  metrics: AggregatedMetrics;
  action: RuleAction;
}

// ============================================
// Enums / union types
// ============================================

export type Platform = 'meta' | 'google_ads' | 'linkedin' | 'tiktok' | 'pinterest' | 'snapchat' | string;
export type EntityStatus = 'active' | 'paused' | 'archived' | 'deleted';
export type EntityLevel = 'campaign' | 'adset' | 'ad';
export type ConditionOperator = '<' | '>' | '<=' | '>=' | '==';

export type MetricName =
  | 'impressions' | 'reach' | 'clicks' | 'spend' | 'conversions' | 'conversion_value'
  | 'ctr' | 'cpc' | 'cpm' | 'conversion_rate' | 'roas' | 'cost_per_conversion';

// ============================================
// Suggestions
// ============================================

export interface Suggestion {
  id: string;
  tenant_id: string;
  campaign_id?: string;
  creative_id?: string;
  type: SuggestionType;
  current_value?: string;
  suggested_value?: string;
  reasoning: string;
  status: SuggestionStatus;
  priority: SuggestionPriority;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  metadata?: Record<string, unknown>;
  // Joined fields
  campaign_name?: string;
  creative_name?: string;
}

export type SuggestionType = 'headline_change' | 'description_change' | 'pause_ad' | 'add_negative_keyword' | 'new_headline' | 'new_description';
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'applied';
export type SuggestionPriority = 'high' | 'medium' | 'low';

// ============================================
// Supermetrics raw input
// ============================================

export interface RawSupermetricsRow {
  Date: string;
  Hour?: string | number;
  Platform?: string;
  'Account ID'?: string;
  'Campaign ID'?: string;
  'Campaign Name'?: string;
  'Ad Set ID'?: string;
  'Ad Set Name'?: string;
  'Ad ID'?: string;
  'Ad Name'?: string;
  Device?: string;
  Placement?: string;
  Impressions?: string | number;
  Reach?: string | number;
  Clicks?: string | number;
  Spend?: string | number;
  Conversions?: string | number;
  'Conversion Value'?: string | number;
  [key: string]: unknown;
}

import { supabase } from '../lib/supabase.js';
import type {
  AggregatedMetrics,
  AutomationResult,
  AutomationRule,
  ConditionOperator,
  MetricName,
  RuleCondition,
} from '../types/index.js';
import { getEntityIds, getMetricsForEntity } from './metrics.service.js';

/**
 * Haal alle actieve automation rules op voor een tenant.
 */
export async function getRules(tenantId: string): Promise<AutomationRule[]> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (error) {
    console.error('Error fetching rules:', error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Evalueer een enkele conditie tegen de metrics.
 */
function evaluateCondition(
  condition: RuleCondition,
  metrics: AggregatedMetrics,
): boolean {
  const metricValue = metrics[condition.metric as keyof AggregatedMetrics];
  if (typeof metricValue !== 'number') return false;

  const ops: Record<ConditionOperator, (a: number, b: number) => boolean> = {
    '<': (a, b) => a < b,
    '>': (a, b) => a > b,
    '<=': (a, b) => a <= b,
    '>=': (a, b) => a >= b,
    '==': (a, b) => a === b,
  };

  const fn = ops[condition.operator];
  return fn ? fn(metricValue, condition.value) : false;
}

/**
 * Evalueer alle condities van een rule (AND logica).
 */
export function evaluateRule(
  rule: AutomationRule,
  metrics: AggregatedMetrics,
): boolean {
  const conditions = rule.condition_json;
  return conditions.every((c) => evaluateCondition(c, metrics));
}

/**
 * Voer alle automation rules uit voor een tenant en retourneer resultaten.
 */
export async function evaluateRulesForTenant(
  tenantId: string,
): Promise<AutomationResult[]> {
  const rules = await getRules(tenantId);
  const results: AutomationResult[] = [];

  for (const rule of rules) {
    const entities = await getEntityIds(tenantId, rule.level);

    for (const entity of entities) {
      const metrics = await getMetricsForEntity(
        tenantId,
        rule.level,
        entity.id,
        rule.lookback_days,
      );

      if (!metrics) continue;

      // Sla entities met te weinig data over
      if (metrics.impressions < rule.min_impressions) continue;

      const triggered = evaluateRule(rule, metrics);

      if (triggered) {
        results.push({
          rule,
          entity_type: rule.level,
          entity_id: entity.id,
          entity_name: entity.name,
          triggered: true,
          metrics,
          action: rule.action_json,
        });
      }
    }
  }

  return results;
}

/**
 * Log een automation resultaat naar de database.
 */
export async function logResult(
  tenantId: string,
  result: AutomationResult,
): Promise<void> {
  const { error } = await supabase.from('automation_logs').insert({
    tenant_id: tenantId,
    rule_id: result.rule.id,
    entity_type: result.entity_type,
    entity_id: result.entity_id,
    action: result.action,
    status: result.rule.mode === 'auto' ? 'executed' : 'suggested',
    metrics_snapshot: result.metrics,
  });

  if (error) {
    console.error('Error logging automation result:', error.message);
  }
}

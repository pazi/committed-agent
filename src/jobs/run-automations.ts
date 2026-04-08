import 'dotenv/config';
import { supabase } from '../lib/supabase.js';
import { evaluateRulesForTenant, logResult } from '../services/automation.service.js';
import type { AutomationResult } from '../types/index.js';

function formatResult(r: AutomationResult): string {
  const metrics = [
    `CTR: ${(r.metrics.ctr * 100).toFixed(2)}%`,
    `CPC: €${r.metrics.cpc.toFixed(2)}`,
    `CPM: €${r.metrics.cpm.toFixed(2)}`,
    `Spend: €${r.metrics.spend.toFixed(2)}`,
    `Conversions: ${r.metrics.conversions}`,
  ].join(' | ');

  const action = r.rule.mode === 'auto' ? '⚡ ACTIE' : '💡 SUGGESTIE';

  return [
    `${action}: ${r.rule.name}`,
    `  ${r.entity_type}: ${r.entity_name} (${r.entity_id})`,
    `  Metrics: ${metrics}`,
    `  Actie: ${r.action.type}${r.action.params ? ` — ${JSON.stringify(r.action.params)}` : ''}`,
  ].join('\n');
}

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    // Haal alle tenants op en evalueer allemaal
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id, name');

    if (error || !tenants || tenants.length === 0) {
      console.error('Geen tenants gevonden of fout:', error?.message);
      process.exit(1);
      return; // unreachable, maar helpt TS narrowing
    }

    console.log(`${tenants.length} tenant(s) gevonden\n`);

    for (const tenant of tenants) {
      await processTenant(tenant.id, tenant.name);
    }
  } else {
    await processTenant(tenantId, tenantId);
  }
}

async function processTenant(tenantId: string, tenantName: string) {
  console.log(`=== Tenant: ${tenantName} ===`);

  const results = await evaluateRulesForTenant(tenantId);

  if (results.length === 0) {
    console.log('  Geen triggers gevonden.\n');
    return;
  }

  console.log(`  ${results.length} trigger(s) gevonden:\n`);

  for (const result of results) {
    console.log(formatResult(result));
    console.log();

    // Log naar database
    await logResult(tenantId, result);
  }
}

main().catch((err) => {
  console.error('Automation run mislukt:', err);
  process.exit(1);
});

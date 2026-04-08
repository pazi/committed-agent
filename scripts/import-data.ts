import 'dotenv/config';
import { readFileSync } from 'fs';
import { supabase } from '../src/lib/supabase.js';
import { mapAndValidateBatch, type MappingContext } from '../src/mappings/supermetrics.mapping.js';
import type { RawSupermetricsRow } from '../src/types/index.js';

const BATCH_SIZE = 500;

async function main() {
  const filePath = process.argv[2];
  const tenantId = process.argv[3];
  const platform = process.argv[4] ?? 'meta';

  if (!filePath || !tenantId) {
    console.error('Gebruik: npm run import-data -- <data.json> <tenant-id> [platform]');
    console.error('Voorbeeld: npm run import-data -- data/export.json abc-123 meta');
    process.exit(1);
  }

  console.log(`Laden van ${filePath}...`);
  const raw: RawSupermetricsRow[] = JSON.parse(readFileSync(filePath, 'utf-8'));
  console.log(`${raw.length} rijen geladen`);

  const ctx: MappingContext = {
    tenantId,
    platform,
  };

  const { valid, errors } = mapAndValidateBatch(raw, ctx);

  if (errors.length > 0) {
    console.warn(`${errors.length} rijen overgeslagen met fouten:`);
    for (const e of errors.slice(0, 10)) {
      console.warn(`  Rij ${e.index}: ${e.error}`);
    }
    if (errors.length > 10) {
      console.warn(`  ... en ${errors.length - 10} meer`);
    }
  }

  console.log(`${valid.length} valide rijen worden geïmporteerd...`);

  let inserted = 0;
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('ad_insights')
      .upsert(batch, {
        onConflict: 'tenant_id,date,hour,platform,campaign_id,adset_id,ad_id,device,placement',
      });

    if (error) {
      console.error(`Fout bij batch ${i}-${i + batch.length}:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`  ${inserted}/${valid.length} rijen geïmporteerd`);
    }
  }

  console.log(`Klaar! ${inserted} rijen succesvol geïmporteerd.`);
}

main().catch((err) => {
  console.error('Import mislukt:', err);
  process.exit(1);
});

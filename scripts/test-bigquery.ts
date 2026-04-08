import 'dotenv/config';
import { getGoogleAdsData } from '../src/services/bigquery.service.js';

async function main() {
  console.log('BigQuery connectie testen...\n');

  const rows = await getGoogleAdsData(5);

  console.log(`${rows.length} rij(en) opgehaald:\n`);
  console.table(rows);
}

main().catch((err) => {
  console.error('Test mislukt:', err.message);
  process.exit(1);
});

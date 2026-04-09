import { getAccountsWithCounts } from '../../../src/services/bigquery.service';

export async function GET() {
  try {
    const data = await getAccountsWithCounts();
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Fout' }, { status: 500 });
  }
}

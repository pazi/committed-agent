import { getAccounts, getPlatforms } from '../../../src/services/bigquery.service';

export async function GET() {
  try {
    const [accounts, platforms] = await Promise.all([getAccounts(), getPlatforms()]);
    return Response.json({ accounts, platforms });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Fout' }, { status: 500 });
  }
}

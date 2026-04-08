import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const dataset = process.env.BIGQUERY_DATASET ?? 'supermetrics_data';

if (!projectId) {
  throw new Error(
    'Missing GOOGLE_CLOUD_PROJECT in environment variables.',
  );
}

// Op Vercel: credentials via env var (JSON string)
// Lokaal: via GOOGLE_APPLICATION_CREDENTIALS bestandspad
const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
const credentials = credentialsJson ? JSON.parse(credentialsJson) : undefined;

export const bigquery = new BigQuery({
  projectId,
  ...(credentials ? { credentials } : {}),
});
export const DATASET = dataset;

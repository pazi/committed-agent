import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const dataset = process.env.BIGQUERY_DATASET ?? 'supermetrics_data';

if (!projectId) {
  throw new Error(
    'Missing GOOGLE_CLOUD_PROJECT in environment variables. ' +
    'Copy .env.example to .env and fill in your GCP project ID.',
  );
}

export const bigquery = new BigQuery({ projectId });
export const DATASET = dataset;

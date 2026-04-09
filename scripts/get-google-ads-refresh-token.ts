import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

// ============================================
// Google Ads OAuth refresh token generator
// ============================================
//
// Eenmalig script. Doorloopt de OAuth Authorization Code flow tegen
// Google's OAuth endpoint en print een refresh token dat je in .env
// kunt zetten als GOOGLE_ADS_REFRESH_TOKEN.
//
// Gebruik:
//   1. Zorg dat GOOGLE_ADS_CLIENT_ID en GOOGLE_ADS_CLIENT_SECRET in .env staan.
//   2. Run:  npm run google-ads:get-refresh-token
//   3. De browser opent → log in met een Google account dat toegang
//      heeft tot het Academy Google Ads account → accepteer de scope.
//   4. Het script print het refresh token in je terminal.
//   5. Plak het in .env achter GOOGLE_ADS_REFRESH_TOKEN=
//
// Geen externe dependencies — alles met Node built-ins.

const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/adwords';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function openBrowser(url: string) {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open'
            : platform === 'win32'  ? 'start'
            : 'xdg-open';
  spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

async function exchangeCodeForToken(
  code: string,
  client_id: string,
  client_secret: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id,
    client_secret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    throw new Error(
      `Token exchange mislukt: ${data.error ?? res.status} — ${data.error_description ?? ''}`,
    );
  }
  return data;
}

async function main() {
  const client_id = process.env.GOOGLE_ADS_CLIENT_ID;
  const client_secret = process.env.GOOGLE_ADS_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    console.error(
      '\n❌ GOOGLE_ADS_CLIENT_ID en/of GOOGLE_ADS_CLIENT_SECRET ontbreken in .env.\n' +
      '   Vul ze eerst in en draai dit script opnieuw.\n',
    );
    process.exit(1);
  }

  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set('client_id', client_id);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline'); // verplicht voor refresh_token
  authUrl.searchParams.set('prompt', 'consent');      // forceer refresh_token, ook bij re-auth
  authUrl.searchParams.set('state', state);

  console.log('\n🔑 Google Ads OAuth flow gestart');
  console.log(`   Redirect URI: ${REDIRECT_URI}`);
  console.log(`   Scope:        ${SCOPE}\n`);

  // Setup een eenmalige loopback server die de redirect ontvangt
  const tokenPromise = new Promise<TokenResponse>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url) return;
        const url = new URL(req.url, `http://localhost:${PORT}`);

        if (url.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end();
          return;
        }

        const returnedState = url.searchParams.get('state');
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>OAuth fout</h1><p>${error}</p>`);
          server.close();
          reject(new Error(`OAuth fout: ${error}`));
          return;
        }

        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>State mismatch</h1>');
          server.close();
          reject(new Error('OAuth state mismatch — mogelijke CSRF.'));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Geen code ontvangen</h1>');
          server.close();
          reject(new Error('Geen authorization code ontvangen.'));
          return;
        }

        const token = await exchangeCodeForToken(code, client_id, client_secret);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <head><title>Klaar</title></head>
            <body style="font-family: sans-serif; max-width: 540px; margin: 80px auto; line-height: 1.5;">
              <h1>✅ Refresh token ontvangen</h1>
              <p>Je kunt dit tabblad sluiten en terug naar je terminal gaan.</p>
            </body>
          </html>
        `);
        server.close();
        resolve(token);
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(PORT, () => {
      console.log(`   Loopback server luistert op poort ${PORT}`);
      console.log(`   → Browser wordt geopend...\n`);
      openBrowser(authUrl.toString());
      console.log('   Lukt de browser niet automatisch? Open deze URL handmatig:\n');
      console.log(`   ${authUrl.toString()}\n`);
    });

    server.on('error', reject);
  });

  const token = await tokenPromise;

  if (!token.refresh_token) {
    console.error(
      '\n❌ Geen refresh_token in de response.\n' +
      '   Dit gebeurt soms als de gebruiker al eerder consent heeft gegeven.\n' +
      '   Het script gebruikt prompt=consent om dit te voorkomen — als je dit\n' +
      '   tóch ziet, ga naar https://myaccount.google.com/permissions, verwijder\n' +
      '   de toegang van de OAuth client en draai het script opnieuw.\n',
    );
    process.exit(1);
  }

  console.log('━'.repeat(60));
  console.log('✅ Refresh token ontvangen!');
  console.log('━'.repeat(60));
  console.log('\nPlak deze regel in je .env:\n');
  console.log(`GOOGLE_ADS_REFRESH_TOKEN=${token.refresh_token}\n`);
  console.log('Daarna kun je GOOGLE_ADS_USE_STUB op false zetten en de live');
  console.log('client gebruiken (zodra LiveGoogleAdsClient is geïmplementeerd).\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Fout:', err instanceof Error ? err.message : err);
  process.exit(1);
});

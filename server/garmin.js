// The Garmin Connect Personal API behind /api/garmin/*, for Vite's dev and preview servers.
// The page asks for a path, this adds the bearer token and forwards it: the API key never
// leaves Node, and Garmin's host (which sends no CORS headers) is called server to server.
// Auth as Garmin's own client (github.com/garmin/connect-personal-api-python): POST the key
// as `Authorization: ApiKey <key>`, get a JWT back as plain text, send it as Bearer.

export const GARMIN_BASE_URL = "https://personal.connectapi.garmin.com";
export const API_PREFIX = "/api/garmin";
const TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token";

// A token is replaced an hour before it expires, as Garmin's client does: a request never
// starts on a token about to lapse.
const REFRESH_WINDOW_S = 3600;

export class GarminError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The JWT's `exp` (s since the epoch), unverified: Garmin checks the signature, not us.
export function jwtExpiry(token) {
  const payload = token.split(".")[1];
  if (!payload) throw new GarminError(502, "The token endpoint did not return a JWT.");
  const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!Number.isFinite(exp)) throw new GarminError(502, "The token has no exp claim.");
  return exp;
}

// The bearer token, kept in memory and exchanged again when it nears its end.
// why one pending exchange: the page asks for several things at once on its first load, and
// each would otherwise spend a token exchange of its own.
export function createTokenSource({ apiKey, baseUrl, fetch, now }) {
  let token = null;
  let pending = null;

  async function exchange() {
    const response = await fetch(`${baseUrl}${TOKEN_PATH}`, {
      method: "POST",
      headers: { Accept: "*/*", Authorization: `ApiKey ${apiKey}` },
    });
    if (!response.ok) {
      throw new GarminError(response.status, `Garmin refused the API key (${response.status}).`);
    }
    const access = (await response.text()).trim();
    token = { access, expiresAt: jwtExpiry(access) };
    return access;
  }

  return {
    get(force = false) {
      if (!force && token && token.expiresAt - now() > REFRESH_WINDOW_S) {
        return Promise.resolve(token.access);
      }
      pending ??= exchange().finally(() => {
        pending = null;
      });
      return pending;
    },
  };
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

// Connect-style middleware: answers /api/garmin/*, passes everything else on.
export function createGarminMiddleware({
  apiKey,
  baseUrl = GARMIN_BASE_URL,
  fetch = globalThis.fetch,
  now = () => Date.now() / 1000,
}) {
  const tokens = apiKey ? createTokenSource({ apiKey, baseUrl, fetch, now }) : null;

  const forward = (url, accept, token) =>
    fetch(url, { headers: { Accept: accept, Authorization: `Bearer ${token}` } });

  return async function garminApi(req, res, next) {
    if (!req.url.startsWith(`${API_PREFIX}/`)) return next();
    // Read only: the Personal API is GET, and nothing here should write to an account.
    if (req.method !== "GET") return sendJson(res, 405, { error: "Only GET is forwarded." });
    if (!tokens) {
      return sendJson(res, 503, { error: "GARMIN_PERSONAL_API_KEY is not set in .env." });
    }
    // The path starts with "/", so the host stays Garmin's whatever the page asks for.
    const url = `${baseUrl}${req.url.slice(API_PREFIX.length)}`;
    const accept = req.headers.accept ?? "application/json";
    try {
      let upstream = await forward(url, accept, await tokens.get());
      // A token revoked before its exp: one fresh exchange, then Garmin's answer stands.
      if (upstream.status === 401) upstream = await forward(url, accept, await tokens.get(true));
      res.statusCode = upstream.status;
      const type = upstream.headers.get("content-type");
      if (type) res.setHeader("Content-Type", type);
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      sendJson(res, err.status ?? 502, { error: err.message });
    }
  };
}

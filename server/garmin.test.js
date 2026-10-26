// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createGarminMiddleware, createTokenSource, jwtExpiry } from "./garmin.js";

const BASE = "https://garmin.test";

// A JWT shaped enough for jwtExpiry: header.payload.signature, payload base64url JSON.
const jwt = (exp) => `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;

const textResponse = (status, text, type = "text/plain") =>
  new Response(text, { status, headers: { "Content-Type": type } });

// A fake Garmin: the token endpoint hands out `tokens` in turn, data paths answer `data`.
function fakeGarmin({ tokens = [jwt(10_000)], data = () => textResponse(200, "[]") } = {}) {
  let issued = 0;
  return vi.fn(async (url, init = {}) => {
    if (url.endsWith("/personal-api-key/token")) {
      return textResponse(200, `${tokens[Math.min(issued++, tokens.length - 1)]}\n`);
    }
    return data(url, init);
  });
}

// Runs the middleware on one request and collects what it wrote.
async function call(middleware, { url, method = "GET", headers = {} }) {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = Buffer.isBuffer(body) ? body.toString("utf8") : body;
    },
  };
  const next = vi.fn();
  await middleware({ url, method, headers }, res, next);
  return { res, next };
}

describe("jwtExpiry", () => {
  it("reads the exp claim", () => {
    expect(jwtExpiry(jwt(1234))).toBe(1234);
  });

  it("refuses a token that is not a JWT", () => {
    expect(() => jwtExpiry("opaque")).toThrow(/did not return a JWT/);
  });
});

describe("createTokenSource", () => {
  it("exchanges the key once for requests made together", async () => {
    const fetch = fakeGarmin();
    const source = createTokenSource({ apiKey: "k", baseUrl: BASE, fetch, now: () => 0 });
    const [a, b] = await Promise.all([source.get(), source.get()]);
    expect(a).toBe(b);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("ApiKey k");
  });

  it("exchanges again within an hour of the token's end", async () => {
    let clock = 0;
    const fetch = fakeGarmin({ tokens: [jwt(5000), jwt(20_000)] });
    const source = createTokenSource({ apiKey: "k", baseUrl: BASE, fetch, now: () => clock });
    expect(await source.get()).toBe(jwt(5000));
    clock = 1000;
    expect(await source.get()).toBe(jwt(5000));
    clock = 1500;
    expect(await source.get()).toBe(jwt(20_000));
  });

  it("says when Garmin refuses the key", async () => {
    const fetch = vi.fn(async () => textResponse(401, "nope"));
    const source = createTokenSource({ apiKey: "k", baseUrl: BASE, fetch, now: () => 0 });
    await expect(source.get()).rejects.toMatchObject({ status: 401 });
  });
});

describe("createGarminMiddleware", () => {
  it("leaves other paths to the next handler", async () => {
    const middleware = createGarminMiddleware({ apiKey: "k", baseUrl: BASE, fetch: fakeGarmin() });
    const { next } = await call(middleware, { url: "/src/main.jsx" });
    expect(next).toHaveBeenCalled();
  });

  it("forwards a GET with the bearer token and Garmin's answer", async () => {
    const fetch = fakeGarmin({
      data: () => textResponse(200, '[{"activityId":1}]', "application/json"),
    });
    const middleware = createGarminMiddleware({ apiKey: "k", baseUrl: BASE, fetch });
    const { res } = await call(middleware, {
      url: "/api/garmin/activitylist-service/activities/search/activities?start=0&limit=1",
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(res.body)).toEqual([{ activityId: 1 }]);
    const [url, init] = fetch.mock.calls[1];
    expect(url).toBe(`${BASE}/activitylist-service/activities/search/activities?start=0&limit=1`);
    expect(init.headers.Authorization).toBe(`Bearer ${jwt(10_000)}`);
  });

  it("retries once with a fresh token when Garmin says 401", async () => {
    const fetch = fakeGarmin({
      tokens: [jwt(10_000), jwt(30_000)],
      data: (url, init) =>
        init.headers.Authorization === `Bearer ${jwt(10_000)}`
          ? textResponse(401, "revoked")
          : textResponse(200, "{}", "application/json"),
    });
    const middleware = createGarminMiddleware({ apiKey: "k", baseUrl: BASE, fetch, now: () => 0 });
    const { res } = await call(middleware, { url: "/api/garmin/userprofile-service/x" });
    expect(res.statusCode).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("answers 503 without a key, and never calls Garmin", async () => {
    const fetch = fakeGarmin();
    const middleware = createGarminMiddleware({ apiKey: undefined, baseUrl: BASE, fetch });
    const { res } = await call(middleware, { url: "/api/garmin/userprofile-service/x" });
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error).toMatch(/GARMIN_PERSONAL_API_KEY/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards nothing but GET", async () => {
    const fetch = fakeGarmin();
    const middleware = createGarminMiddleware({ apiKey: "k", baseUrl: BASE, fetch });
    const { res } = await call(middleware, { url: "/api/garmin/x", method: "POST" });
    expect(res.statusCode).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the request on Garmin's host", async () => {
    const fetch = fakeGarmin();
    const middleware = createGarminMiddleware({ apiKey: "k", baseUrl: BASE, fetch });
    await call(middleware, { url: "/api/garmin//evil.test/x" });
    expect(new URL(fetch.mock.calls[1][0]).host).toBe("garmin.test");
  });

  it("turns a refused key into a JSON error, without the key in it", async () => {
    const fetch = vi.fn(async () => textResponse(401, "nope"));
    const middleware = createGarminMiddleware({ apiKey: "secret-key", baseUrl: BASE, fetch });
    const { res } = await call(middleware, { url: "/api/garmin/x" });
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatch(/refused the API key/);
    expect(res.body).not.toMatch(/secret-key/);
  });
});

// GitHub sign-in (OAuth web flow) and signed session cookies. The GitHub access token is used once to read the
// profile and then dropped; nothing about the user's GitHub account is stored beyond id, login, name and avatar.
import type { Env, User } from "./env"
import { b64url, cookie, err, fromB64url, randomToken, safeEqual, setCookie } from "./util"

const SESSION_DAYS = 30

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)))
}

export async function signSession(env: Env, user: User) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ ...user, exp: Date.now() + SESSION_DAYS * 864e5 })))
  return `${payload}.${await hmac(env.SESSION_SECRET, payload)}`
}

export async function currentUser(req: Request, env: Env): Promise<User | null> {
  const raw = cookie(req, "sid")
  if (!raw || !env.SESSION_SECRET) return null
  const [payload, sig] = raw.split(".")
  if (!payload || !sig || !safeEqual(sig, await hmac(env.SESSION_SECRET, payload))) return null
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)))
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null
    return { uid: String(data.uid), login: data.login, name: data.name, avatar: data.avatar }
  } catch {
    return null
  }
}

export function login(req: Request, env: Env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return err("GitHub sign-in isn't configured on this server yet.", 503)
  const url = new URL(req.url)
  const state = randomToken(16)
  const auth = new URL("https://github.com/login/oauth/authorize")
  auth.searchParams.set("client_id", env.GITHUB_CLIENT_ID)
  auth.searchParams.set("redirect_uri", `${url.origin}/auth/callback`)
  auth.searchParams.set("scope", "read:user")
  auth.searchParams.set("state", state)
  auth.searchParams.set("allow_signup", "true")
  return new Response(null, { status: 302, headers: { location: auth.toString(), "set-cookie": setCookie("oauth_state", state, 600) } })
}

export async function callback(req: Request, env: Env) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const expected = cookie(req, "oauth_state")
  if (!code || !state || !expected || !safeEqual(state, expected)) return err("Sign-in expired or was tampered with. Try again.", 400)

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${url.origin}/auth/callback` }),
  })
  const tok = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error_description?: string }
  if (!tok.access_token) return err(`GitHub sign-in failed: ${tok.error_description ?? "no token"}`, 400)

  const userRes = await fetch("https://api.github.com/user", {
    headers: { authorization: `Bearer ${tok.access_token}`, accept: "application/vnd.github+json", "user-agent": "clearspec-web" },
  })
  if (!userRes.ok) return err("Couldn't read your GitHub profile.", 502)
  const gh = (await userRes.json()) as { id: number; login: string; name: string | null; avatar_url: string }
  const user: User = { uid: String(gh.id), login: gh.login, name: gh.name ?? gh.login, avatar: gh.avatar_url }

  const headers = new Headers({ location: "/" })
  headers.append("set-cookie", setCookie("sid", await signSession(env, user), SESSION_DAYS * 86400))
  headers.append("set-cookie", setCookie("oauth_state", "", 0))
  return new Response(null, { status: 302, headers })
}

export function logout() {
  return new Response(null, { status: 302, headers: { location: "/", "set-cookie": setCookie("sid", "", 0) } })
}

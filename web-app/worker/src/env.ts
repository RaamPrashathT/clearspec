export interface Env {
  ASSETS: Fetcher
  USER_HUB: DurableObjectNamespace
  RUN: DurableObjectNamespace
  PAIRING: DurableObjectNamespace
  /** GitHub OAuth app client id (public). */
  GITHUB_CLIENT_ID: string
  /** Secret: GitHub OAuth app client secret. */
  GITHUB_CLIENT_SECRET: string
  /** Secret: signs session cookies. */
  SESSION_SECRET: string
  /** Local development only (.dev.vars): enables /auth/dev-login on localhost. */
  DEV_LOGIN?: string
}

export type User = { uid: string; login: string; name: string; avatar: string }

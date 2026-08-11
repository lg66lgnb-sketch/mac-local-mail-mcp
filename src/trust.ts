import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type AccountKind = "personal" | "campus";
export type TrustScope = "address" | "domain";
export type AuthenticationStatus = "pass" | "fail" | "neutral" | "none" | "unknown";

export interface AuthenticationResults {
  spf: AuthenticationStatus;
  dkim: AuthenticationStatus;
  dmarc: AuthenticationStatus;
}

export interface TrustRule {
  id: string;
  scope: TrustScope;
  value: string;
  createdAt: string;
}

interface AccessInput {
  accountKind: AccountKind;
  internalDomains?: string[];
  sender: string;
  authentication: AuthenticationResults;
  trustRules: TrustRule[];
  allowedOnce?: boolean;
}

export interface AccessDecision {
  status: "allowed" | "review";
  reason: "allowed_once" | "trusted_sender" | "campus_internal" | "authentication_anomaly" | "untrusted_sender";
  senderAddress: string;
  senderDomain: string;
  allowedActions?: ["allow_once", "trust_address", "trust_domain"];
}

const AUTH_KEYS = ["spf", "dkim", "dmarc"] as const;

export function parseAuthenticationResults(header: string): AuthenticationResults {
  const result: AuthenticationResults = { spf: "unknown", dkim: "unknown", dmarc: "unknown" };
  for (const key of AUTH_KEYS) {
    const match = header.match(new RegExp(`(?:^|[;\\s])${key}=([a-z]+)`, "i"));
    const value = match?.[1]?.toLowerCase();
    if (value === "pass" || value === "fail" || value === "neutral" || value === "none") {
      result[key] = value;
    }
  }
  return result;
}

export function extractAddress(sender: string): string {
  const angle = sender.match(/<([^<>]+)>/);
  const candidate = (angle?.[1] ?? sender).trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(candidate) ? candidate : "";
}

function domainMatches(domain: string, configured: string): boolean {
  const normalized = configured.trim().toLowerCase().replace(/^@/, "");
  return domain === normalized || domain.endsWith(`.${normalized}`);
}

function isAuthenticated(authentication: AuthenticationResults): boolean {
  return authentication.dmarc === "pass" || (authentication.spf === "pass" && authentication.dkim === "pass");
}

export function decideMessageAccess(input: AccessInput): AccessDecision {
  const senderAddress = extractAddress(input.sender);
  const senderDomain = senderAddress.split("@")[1] ?? "";
  const base = { senderAddress, senderDomain };

  if (AUTH_KEYS.some((key) => input.authentication[key] === "fail")) {
    return { ...base, status: "review", reason: "authentication_anomaly", allowedActions: ["allow_once", "trust_address", "trust_domain"] };
  }
  if (input.allowedOnce) return { ...base, status: "allowed", reason: "allowed_once" };

  const authenticated = isAuthenticated(input.authentication);
  const trusted = input.trustRules.some((rule) =>
    rule.scope === "address" ? rule.value === senderAddress : domainMatches(senderDomain, rule.value),
  );
  if (authenticated && trusted) return { ...base, status: "allowed", reason: "trusted_sender" };

  const internal = input.accountKind === "campus"
    && (input.internalDomains ?? []).some((domain) => domainMatches(senderDomain, domain));
  if (authenticated && internal) return { ...base, status: "allowed", reason: "campus_internal" };

  return { ...base, status: "review", reason: "untrusted_sender", allowedActions: ["allow_once", "trust_address", "trust_domain"] };
}

export class FileTrustStore {
  constructor(private readonly path: string) {}

  async list(): Promise<TrustRule[]> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as { rules?: TrustRule[] };
      return Array.isArray(parsed.rules) ? parsed.rules : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async add(scope: TrustScope, value: string): Promise<TrustRule> {
    const normalized = value.trim().toLowerCase().replace(scope === "domain" ? /^@/ : /\s+/g, "");
    if (scope === "address" && !extractAddress(normalized)) throw new Error("Invalid email address");
    if (scope === "domain" && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) throw new Error("Invalid domain");
    const rules = await this.list();
    const existing = rules.find((rule) => rule.scope === scope && rule.value === normalized);
    if (existing) return existing;
    const rule = { id: randomUUID(), scope, value: normalized, createdAt: new Date().toISOString() };
    await this.write([...rules, rule]);
    return rule;
  }

  async remove(id: string): Promise<boolean> {
    const rules = await this.list();
    const remaining = rules.filter((rule) => rule.id !== id);
    if (remaining.length === rules.length) return false;
    await this.write(remaining);
    return true;
  }

  private async write(rules: TrustRule[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ rules }, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.path);
  }
}

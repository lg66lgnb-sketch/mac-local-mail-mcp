import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AccountKind } from "./trust.js";

export interface AccountPolicy {
  accountId: string;
  kind: AccountKind;
  internalDomains: string[];
}

export class FileAccountPolicyStore {
  constructor(private readonly path: string) {}

  async list(): Promise<AccountPolicy[]> {
    try {
      const data = JSON.parse(await readFile(this.path, "utf8")) as { accounts?: AccountPolicy[] };
      return Array.isArray(data.accounts) ? data.accounts : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async get(accountId: string): Promise<AccountPolicy> {
    return (await this.list()).find((policy) => policy.accountId === accountId)
      ?? { accountId, kind: "personal", internalDomains: [] };
  }

  async set(policy: AccountPolicy): Promise<AccountPolicy> {
    const domains = [...new Set(policy.internalDomains.map((domain) => domain.trim().toLowerCase().replace(/^@/, "")))];
    if (domains.some((domain) => !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))) throw new Error("Invalid internal domain");
    const accounts = (await this.list()).filter((existing) => existing.accountId !== policy.accountId);
    const normalized = { ...policy, internalDomains: domains };
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ accounts: [...accounts, normalized] }, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.path);
    return normalized;
  }
}

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ALLOWED_BRIDGE_ACTIONS = [
  "listAccounts",
  "listMailboxes",
  "searchMessages",
  "getMessage",
  "listAttachments",
  "getThread",
  "createDraft",
  "createReplyDraft",
  "createReplyAllDraft",
  "createForwardDraft",
] as const;

export type BridgeAction = (typeof ALLOWED_BRIDGE_ACTIONS)[number];
export type BridgeExecutor = (action: BridgeAction, input: unknown) => Promise<unknown>;

export interface MessageSummary {
  id: number;
  messageId?: string;
  accountId: string;
  mailboxPath: string[];
  mailboxRole?: string;
  subject: string;
  sender: string;
  dateReceived?: string;
  dateSent?: string;
  size?: number;
  read?: boolean;
  replied?: boolean;
  forwarded?: boolean;
  attachmentCount?: number;
}

export interface SearchInput {
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  accountIds?: string[];
  mailboxRoles?: string[];
  limit?: number;
}

function assertAllowed(action: string): asserts action is BridgeAction {
  if (!(ALLOWED_BRIDGE_ACTIONS as readonly string[]).includes(action)) {
    throw new Error(`Bridge operation is not allowed: ${action}`);
  }
}

export class MailClient {
  constructor(private readonly executor: BridgeExecutor = runOsascript) {}

  listAccounts(): Promise<unknown> { return this.executor("listAccounts", {}); }
  listMailboxes(accountId?: string): Promise<unknown> { return this.executor("listMailboxes", { accountId }); }
  getMessage(id: number): Promise<unknown> { return this.executor("getMessage", { id }); }
  getThread(id: number, limit = 50): Promise<unknown> { return this.executor("getThread", { id, limit: Math.min(Math.max(limit, 1), 100) }); }
  listAttachments(id: number): Promise<unknown> { return this.executor("listAttachments", { id }); }

  async searchMessages(input: SearchInput): Promise<MessageSummary[]> {
    const output = await this.executor("searchMessages", {
      ...input,
      query: input.query?.slice(0, 500) ?? "",
      limit: Math.min(Math.max(input.limit ?? 50, 1), 100),
    });
    return output as MessageSummary[];
  }

  runDraftAction(action: Extract<BridgeAction, `create${string}Draft`>, input: unknown): Promise<unknown> {
    return this.executor(action, input);
  }

  runUnsafeForTest(action: string, input: unknown): Promise<unknown> {
    assertAllowed(action);
    return this.executor(action, input);
  }
}

async function runOsascript(action: BridgeAction, input: unknown): Promise<unknown> {
  assertAllowed(action);
  const payload = JSON.stringify(input ?? {});
  if (Buffer.byteLength(payload) > 1_000_000) throw new Error("Bridge input exceeds 1 MB");
  const script = fileURLToPath(new URL("../scripts/mail-bridge.js", import.meta.url));

  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/osascript", ["-l", "JavaScript", script, action, payload], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `Apple Mail bridge exited with ${code}`));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("Apple Mail bridge returned invalid JSON"));
      }
    });
  });
}

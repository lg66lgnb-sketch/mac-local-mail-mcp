import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  FileTrustStore,
  decideMessageAccess,
  parseAuthenticationResults,
} from "../src/trust.js";

test("trusted authenticated sender is allowed", () => {
  const decision = decideMessageAccess({
    accountKind: "personal",
    sender: "Bank <notice@bank.example>",
    authentication: { spf: "pass", dkim: "pass", dmarc: "pass" },
    trustRules: [{ id: "1", scope: "address", value: "notice@bank.example", createdAt: "now" }],
  });

  assert.equal(decision.status, "allowed");
});

test("authentication failure forces review even for a trusted sender", () => {
  const decision = decideMessageAccess({
    accountKind: "personal",
    sender: "Bank <notice@bank.example>",
    authentication: { spf: "fail", dkim: "pass", dmarc: "fail" },
    trustRules: [{ id: "1", scope: "domain", value: "bank.example", createdAt: "now" }],
  });

  assert.equal(decision.status, "review");
  assert.equal(decision.reason, "authentication_anomaly");
  assert.deepEqual(decision.allowedActions, ["allow_once", "trust_address", "trust_domain"]);
});

test("authenticated campus-internal sender is allowed without a trust rule", () => {
  const decision = decideMessageAccess({
    accountKind: "campus",
    internalDomains: ["university.edu.cn"],
    sender: "Office <staff@dept.university.edu.cn>",
    authentication: { spf: "pass", dkim: "pass", dmarc: "pass" },
    trustRules: [],
  });

  assert.equal(decision.status, "allowed");
});

test("authentication results are parsed without treating header text as instructions", () => {
  const parsed = parseAuthenticationResults(
    "mx.example; spf=pass smtp.mailfrom=bank.example; dkim=pass header.d=bank.example; dmarc=pass action=none",
  );
  assert.deepEqual(parsed, { spf: "pass", dkim: "pass", dmarc: "pass" });
});

test("trust rules can be listed and revoked", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mail-mcp-trust-"));
  const path = join(directory, "trust.json");
  const store = new FileTrustStore(path);
  const rule = await store.add("domain", "Example.COM");

  assert.equal((await store.list())[0]?.value, "example.com");
  assert.equal(await store.remove(rule.id), true);
  assert.deepEqual(await store.list(), []);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), { rules: [] });
});

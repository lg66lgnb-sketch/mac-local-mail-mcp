import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("structured sender search is filtered by Apple Mail before metadata is read", () => {
  let selector: Record<string, unknown> | undefined;
  const account = {
    id: () => "account-1",
    name: () => "Example",
    mailboxes: () => [mailbox],
  };
  const mailbox = {
    account: () => account,
    name: () => "INBOX",
    mailboxes: () => [],
    unreadCount: () => 0,
    messages: {
      whose: (input: Record<string, unknown>) => {
        selector = input;
        return () => [];
      },
    },
  };
  const Mail = {
    accounts: () => [account],
    inbox: () => ({ mailboxes: () => [] }),
    sentMailbox: () => ({ mailboxes: () => [] }),
    draftsMailbox: () => ({ mailboxes: () => [] }),
    junkMailbox: () => ({ mailboxes: () => [] }),
    trashMailbox: () => ({ mailboxes: () => [] }),
    outbox: () => ({ mailboxes: () => [] }),
  };
  const source = readFileSync(new URL("../scripts/mail-bridge.js", import.meta.url), "utf8");
  const context = {
    ObjC: { import: () => undefined },
    Application: () => Mail,
    Date,
    JSON,
    Math,
    Number,
    Set,
    String,
  };

  vm.runInNewContext(`${source}\nglobalThis.testSearchMessages = searchMessages;`, context);
  (context as typeof context & { testSearchMessages: (input: unknown) => unknown }).testSearchMessages({
    sender: "notifications@example.com",
    dateFrom: "2026-08-01T00:00:00Z",
  });

  const mailSelector = selector as {
    dateReceived: { _greaterThanEquals: Date };
    sender: { _contains: string };
  };
  assert.equal(mailSelector.dateReceived._greaterThanEquals.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(mailSelector.sender._contains, "notifications@example.com");
});

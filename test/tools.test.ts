import assert from "node:assert/strict";
import test from "node:test";

import { TOOL_NAMES } from "../src/tools.js";

test("public MCP catalog has no direct sending or mutation tools", () => {
  assert.equal(TOOL_NAMES.some((name) => /^mail_(send|delete_message|move_message|modify_message|mark_)/i.test(name)), false);
  assert.deepEqual(
    TOOL_NAMES.filter((name) => name.includes("draft")),
    ["mail_create_draft", "mail_create_reply_draft", "mail_create_reply_all_draft", "mail_create_forward_draft"],
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { classifyAttachment, safeAttachmentName } from "../src/attachments.js";

test("executables, scripts, and archives require human takeover", () => {
  for (const name of ["installer.pkg", "run.command", "payload.js", "locked.zip"]) {
    assert.equal(classifyAttachment({ name, mimeType: "application/octet-stream" }).action, "human_takeover");
  }
});

test("encrypted or password-required attachments always require human takeover", () => {
  assert.equal(classifyAttachment({ name: "statement.pdf", mimeType: "application/pdf", encrypted: true }).action, "human_takeover");
  assert.equal(classifyAttachment({ name: "statement.pdf", mimeType: "application/pdf", passwordRequired: true }).action, "human_takeover");
});

test("ordinary documents can only be exported and never auto-opened", () => {
  assert.deepEqual(classifyAttachment({ name: "statement.pdf", mimeType: "application/pdf" }), { action: "export_only", reason: "safe_type" });
});

test("attachment filenames cannot escape the selected directory", () => {
  assert.equal(safeAttachmentName("../../secret.pdf"), "secret.pdf");
  assert.throws(() => safeAttachmentName(".."), /Invalid/);
});

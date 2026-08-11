import { basename } from "node:path";

interface AttachmentRiskInput {
  name: string;
  mimeType: string;
  encrypted?: boolean;
  passwordRequired?: boolean;
}

const HIGH_RISK_EXTENSIONS = new Set([
  ".app", ".bat", ".cmd", ".command", ".com", ".dmg", ".exe", ".hta", ".jar", ".js", ".jse",
  ".msi", ".pkg", ".ps1", ".scr", ".sh", ".vbs", ".vbe", ".zip", ".7z", ".rar", ".tar", ".gz",
]);

export function safeAttachmentName(name: string): string {
  const safe = basename(name.trim());
  if (!safe || safe === "." || safe === ".." || safe.includes("\0")) throw new Error("Invalid attachment filename");
  return safe;
}

export function classifyAttachment(input: AttachmentRiskInput): { action: "export_only" | "human_takeover"; reason: string } {
  if (input.encrypted) return { action: "human_takeover", reason: "encrypted_attachment" };
  if (input.passwordRequired) return { action: "human_takeover", reason: "password_required" };
  const name = safeAttachmentName(input.name).toLowerCase();
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  if (HIGH_RISK_EXTENSIONS.has(extension)) return { action: "human_takeover", reason: "high_risk_file_type" };
  if (/application\/(x-msdownload|x-executable|x-sh|java-archive)/i.test(input.mimeType)) {
    return { action: "human_takeover", reason: "high_risk_mime_type" };
  }
  return { action: "export_only", reason: "safe_type" };
}

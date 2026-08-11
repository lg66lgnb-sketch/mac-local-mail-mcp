ObjC.import("Foundation");

const Mail = Application("Mail");

function value(getter, fallback = null) {
  try {
    const result = getter();
    return result === undefined ? fallback : result;
  } catch (_) {
    return fallback;
  }
}

function iso(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function accountIdOf(mailbox) {
  return value(() => mailbox.account().id(), "");
}

function specialRoleMap() {
  const result = {};
  const specials = [
    ["inbox", () => Mail.inbox()],
    ["sent", () => Mail.sentMailbox()],
    ["drafts", () => Mail.draftsMailbox()],
    ["junk", () => Mail.junkMailbox()],
    ["trash", () => Mail.trashMailbox()],
    ["outbox", () => Mail.outbox()],
  ];
  specials.forEach(([role, getMailbox]) => {
    const root = value(getMailbox);
    if (!root) return;
    value(() => root.mailboxes(), []).forEach((mailbox) => {
      result[`${accountIdOf(mailbox)}\u0000${value(() => mailbox.name(), "")}`] = role;
    });
  });
  return result;
}

function walkMailboxes(account, roles) {
  const output = [];
  function visit(mailbox, parents) {
    const name = value(() => mailbox.name(), "");
    const path = [...parents, name];
    const accountId = account.id();
    output.push({
      accountId,
      accountName: account.name(),
      path,
      name,
      role: roles[`${accountId}\u0000${name}`] || "custom",
      unreadCount: value(() => mailbox.unreadCount(), 0),
      _mailbox: mailbox,
    });
    value(() => mailbox.mailboxes(), []).forEach((child) => visit(child, path));
  }
  value(() => account.mailboxes(), []).forEach((mailbox) => visit(mailbox, []));
  return output;
}

function allMailboxRecords(accountIds) {
  const allowed = new Set(accountIds || []);
  const roles = specialRoleMap();
  return Mail.accounts()
    .filter((account) => allowed.size === 0 || allowed.has(account.id()))
    .flatMap((account) => walkMailboxes(account, roles));
}

function recipientList(message, property) {
  return value(() => message[property](), []).map((recipient) => ({
    name: value(() => recipient.name(), ""),
    address: value(() => recipient.address(), ""),
  }));
}

function attachmentList(message) {
  return value(() => message.mailAttachments(), []).map((attachment) => ({
    id: value(() => attachment.id(), ""),
    name: value(() => attachment.name(), ""),
    mimeType: value(() => attachment.mimeType(), "application/octet-stream"),
    size: value(() => attachment.fileSize(), 0),
    downloaded: value(() => attachment.downloaded(), false),
  }));
}

function summary(message, mailboxRecord) {
  return {
    id: value(() => message.id(), 0),
    messageId: value(() => message.messageId(), ""),
    accountId: mailboxRecord.accountId,
    mailboxPath: mailboxRecord.path,
    mailboxRole: mailboxRecord.role,
    subject: value(() => message.subject(), ""),
    sender: value(() => message.sender(), ""),
    dateReceived: iso(value(() => message.dateReceived())),
    dateSent: iso(value(() => message.dateSent())),
    size: value(() => message.messageSize(), 0),
    read: value(() => message.readStatus(), false),
    replied: value(() => message.wasRepliedTo(), false),
    forwarded: value(() => message.wasForwarded(), false),
    attachmentCount: value(() => message.mailAttachments().length, 0),
  };
}

function findMessage(id) {
  const numericId = Number(id);
  for (const record of allMailboxRecords()) {
    const matches = value(() => record._mailbox.messages.whose({ id: numericId })(), []);
    if (matches.length) return { message: matches[0], mailboxRecord: record };
  }
  throw new Error(`Message not found: ${id}`);
}

function listAccounts() {
  return Mail.accounts().map((account) => ({
    id: account.id(),
    name: account.name(),
    fullName: value(() => account.fullName(), ""),
    emailAddresses: value(() => account.emailAddresses(), []),
    accountType: String(value(() => account.accountType(), "unknown")),
    enabled: value(() => account.enabled(), false),
  }));
}

function listMailboxes(input) {
  return allMailboxRecords(input.accountId ? [input.accountId] : []).map(({ _mailbox, ...record }) => record);
}

function searchMessages(input) {
  const query = String(input.query || "").toLocaleLowerCase();
  const from = input.dateFrom ? new Date(input.dateFrom) : new Date(Date.now() - 90 * 86400000);
  const to = input.dateTo ? new Date(input.dateTo) : null;
  const roles = new Set(input.mailboxRoles || []);
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 100);
  const results = [];
  searchLoop: for (const record of allMailboxRecords(input.accountIds)) {
    if (roles.size && !roles.has(record.role)) continue;
    const messages = value(() => record._mailbox.messages.whose({ dateReceived: { _greaterThanEquals: from } })(), []);
    for (const message of messages) {
      const item = summary(message, record);
      if (to && item.dateReceived && new Date(item.dateReceived) > to) continue;
      const haystack = `${item.subject}\n${item.sender}\n${item.messageId}`.toLocaleLowerCase();
      if (!query || haystack.includes(query)) {
        results.push(item);
        if (results.length >= limit && !query) break searchLoop;
      }
    }
  }
  return results
    .sort((a, b) => String(b.dateReceived || b.dateSent).localeCompare(String(a.dateReceived || a.dateSent)))
    .slice(0, limit);
}

function getMessageMetadata(input) {
  const found = findMessage(input.id);
  const message = found.message;
  return {
    ...summary(message, found.mailboxRecord),
    to: recipientList(message, "toRecipients"),
    cc: recipientList(message, "ccRecipients"),
    bcc: recipientList(message, "bccRecipients"),
    replyTo: value(() => message.replyTo(), ""),
    headers: value(() => message.allHeaders(), ""),
    attachments: attachmentList(message),
    security: { untrustedExternalContent: true },
  };
}

function getMessage(input) {
  const found = findMessage(input.id);
  return {
    ...getMessageMetadata(input),
    content: String(value(() => found.message.content(), "")),
    source: value(() => found.message.source(), ""),
  };
}

function getThread(input) {
  const found = findMessage(input.id);
  const coreSubject = value(() => found.message.subject(), "").replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "").trim();
  const subject = coreSubject.toLocaleLowerCase();
  if (!subject) return [summary(found.message, found.mailboxRecord)];
  const candidates = [];
  for (const record of allMailboxRecords([found.mailboxRecord.accountId])) {
    for (const message of value(() => record._mailbox.messages.whose({ subject: { _contains: coreSubject } })(), [])) {
      const candidateSubject = value(() => message.subject(), "").replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "").trim().toLocaleLowerCase();
      if (candidateSubject === subject) candidates.push(summary(message, record));
    }
  }
  return candidates.sort((a, b) => String(a.dateReceived).localeCompare(String(b.dateReceived))).slice(-Math.min(input.limit || 50, 100));
}

function listAttachments(input) {
  return attachmentList(findMessage(input.id).message);
}

function exportAttachment(input) {
  const attachment = value(() => findMessage(input.id).message.mailAttachments(), [])
    .find((item) => value(() => item.id(), "") === input.attachmentId);
  if (!attachment) throw new Error("Attachment not found");
  attachment.save({ in: Path(input.outputPath) });
  return { exported: true, path: input.outputPath, opened: false };
}

function addRecipients(draft, property, addresses) {
  const recipientClass = property === "toRecipients" ? Mail.ToRecipient : property === "ccRecipients" ? Mail.CcRecipient : Mail.BccRecipient;
  (addresses || []).forEach((address) => draft[property].push(recipientClass({ address })));
}

function addOutgoingAttachments(draft, paths) {
  (paths || []).forEach((path) => draft.content.attachments.push(Mail.Attachment({ fileName: Path(path) })));
}

function saveDraft(draft, input, preserveGeneratedContent) {
  draft.sender = input.from;
  if (input.body !== undefined) {
    const generated = preserveGeneratedContent ? String(value(() => draft.content(), "")) : "";
    draft.content = generated ? `${input.body}\n\n${generated}` : input.body;
  }
  addOutgoingAttachments(draft, input.attachment_paths);
  draft.save();
  return { draftSaved: true, outgoingId: value(() => draft.id(), null), subject: value(() => draft.subject(), ""), sender: value(() => draft.sender(), ""), safety: "saved_to_apple_mail_drafts_never_sent" };
}

function createDraft(input) {
  const draft = Mail.OutgoingMessage({ subject: input.subject, content: input.body, sender: input.from, visible: false });
  Mail.outgoingMessages.push(draft);
  addRecipients(draft, "toRecipients", input.to);
  addRecipients(draft, "ccRecipients", input.cc);
  addRecipients(draft, "bccRecipients", input.bcc);
  return saveDraft(draft, { ...input, body: undefined }, false);
}

function createReplyDraft(input) {
  return saveDraft(Mail.reply(findMessage(input.message_id).message, { openingWindow: false, replyToAll: false }), input, true);
}

function createReplyAllDraft(input) {
  return saveDraft(Mail.reply(findMessage(input.message_id).message, { openingWindow: false, replyToAll: true }), input, true);
}

function createForwardDraft(input) {
  const draft = Mail.forward(findMessage(input.message_id).message, { openingWindow: false });
  addRecipients(draft, "toRecipients", input.to);
  addRecipients(draft, "ccRecipients", input.cc);
  return saveDraft(draft, input, true);
}

const ACTIONS = { listAccounts, listMailboxes, searchMessages, getMessageMetadata, getMessage, getThread, listAttachments, exportAttachment, createDraft, createReplyDraft, createReplyAllDraft, createForwardDraft };

function run(argv) {
  const action = argv[0];
  const input = JSON.parse(argv[1] || "{}");
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) throw new Error(`Unsupported bridge action: ${action}`);
  return JSON.stringify(ACTIONS[action](input));
}

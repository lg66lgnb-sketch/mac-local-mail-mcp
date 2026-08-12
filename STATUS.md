# Project Status

## Current Release

- Version: `0.1.0`
- License: MIT
- Repository: <https://github.com/lg66lgnb-sketch/mac-local-mail-mcp>
- State: minimum runnable implementation complete

## Implemented

- Local stdio MCP server for Apple Mail
- Account and mailbox discovery across enabled accounts
- Locale-independent special mailbox roles
- Metadata search and guarded body/source reads
- Server-side sender, subject, and Message-ID search filters
- Subject-based conversation lookup
- Attachment metadata and explicit safe export
- One-time, address, and domain sender authorization
- Revocable trust rules and campus/personal account policy
- New, reply, reply-all, and forward draft creation
- Reusable user-level `$mail-agent` skill
- Codex, Claude Desktop, and Cursor configuration examples
- No send, delete, move, read-state, or existing-draft mutation tools

## Verification

The current automated suite contains 17 tests covering the public tool boundary, server-side metadata filtering, sender trust and authentication anomalies, metadata-before-body access, attachment risk handling, path traversal prevention, and bridge operation allowlisting.

Last release checks:

- `npm test`: 17 passed, 0 failed
- `npm run check`: passed
- `npm run build`: passed
- `npm audit --audit-level=high`: 0 vulnerabilities

On the development mailbox, an exact sender search over one month of the Google inbox decreased from about 23 seconds with residual text matching to 1.39 seconds with the server-side sender filter.

Live acceptance on the development Mac successfully located recent Bank of China credit-card statements and created an Apple Mail reply draft for a message that appeared to need a response. The draft appeared in the correct account. No email was sent.

## Known Limitations

- Conversation lookup uses normalized subject matching rather than a native Mail conversation ID.
- Broad general-text searches over large mailboxes may still take over a minute; use structured metadata filters and narrow by account, date, and mailbox role where possible.
- Metadata search does not scan full bodies before sender review.
- Reply draft creation has been live-verified; the other draft types are covered by implementation and protocol checks but have not all been exercised with private live mail.
- Attachment export has not been broadly live-tested against private mailbox data.

## macOS User Action Still Required

Each user must approve Automation access for their MCP client or Node process to control Apple Mail. This permission cannot be granted by the installer.

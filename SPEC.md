# Specification

## Scope

Mac Local Mail MCP is a local stdio MCP server for macOS Apple Mail. It supports all enabled Mail accounts and their inbox, sent, drafts, archive, junk, trash, outbox, and custom mailboxes.

The server provides metadata search, guarded full-message reads, subject-based conversation lookup, attachment inspection/export, sender trust management, account policy, and draft-only composition. It deliberately exposes no send, delete, move, mark-read, or existing-draft mutation tool.

## Requirements

- macOS with Apple Mail configured and synced
- Node.js 22 or newer
- Automation permission for the MCP host or Node process to control Mail

Full Disk Access is not a design requirement. The implementation uses Apple Mail's scripting API instead of reading the Mail database directly.

## Build and Verify

```bash
npm ci --ignore-scripts
npm run build
npm test
npm run check
npm audit --audit-level=high
```

The lockfile is authoritative, and dependency installation scripts are disabled.

## Client Configuration

Replace `/absolute/path/to/mac-local-mail-mcp` with the cloned repository's absolute path. Preserve existing settings and merge only the new MCP entry.

### Codex

If the `codex` CLI is available:

```bash
codex mcp add apple-mail -- node /absolute/path/to/mac-local-mail-mcp/dist/index.js
codex mcp list
```

Otherwise merge this into `~/.codex/config.toml`:

```toml
[mcp_servers.apple-mail]
command = "node"
args = ["/absolute/path/to/mac-local-mail-mcp/dist/index.js"]
tool_timeout_sec = 180
default_tools_approval_mode = "writes"
```

Install the reusable user-level skill and restart Codex:

```bash
./scripts/install-skill.sh
```

Invoke it explicitly with `$mail-agent`, or let it trigger for mail-related tasks.

### Claude Desktop

Merge into `~/Library/Application Support/Claude/claude_desktop_config.json`, then fully restart Claude Desktop:

```json
{
  "mcpServers": {
    "apple-mail": {
      "command": "node",
      "args": [
        "/absolute/path/to/mac-local-mail-mcp/dist/index.js"
      ]
    }
  }
}
```

### Cursor

Merge into `.cursor/mcp.json` in a trusted project:

```json
{
  "mcpServers": {
    "apple-mail": {
      "command": "node",
      "args": [
        "/absolute/path/to/mac-local-mail-mcp/dist/index.js"
      ]
    }
  }
}
```

The 180-second Codex timeout accommodates searches over large local mailboxes.

## First Use

1. Keep Apple Mail open and allow it to finish syncing.
2. Restart the configured MCP client and call `mail_list_accounts`.
3. If prompted, allow the client or Node to control Mail. If no prompt appears, open **System Settings → Privacy & Security → Automation**.
4. Classify campus accounts with `mail_configure_account`, using only internal domains confirmed by the user.
5. Search metadata first. Review or authorize the sender before reading message bodies.

## MCP Tools

Read-only tools:

- `mail_list_accounts`
- `mail_list_mailboxes`
- `mail_search_messages`
- `mail_get_message`
- `mail_get_thread`
- `mail_list_attachments`
- `mail_list_trust_rules`

Local policy tools:

- `mail_configure_account`
- `mail_authorize_sender`
- `mail_remove_trust_rule`

Explicit attachment export:

- `mail_export_attachment`

Draft-only composition:

- `mail_create_draft`
- `mail_create_reply_draft`
- `mail_create_reply_all_draft`
- `mail_create_forward_draft`

## Mailbox and Message Behavior

Inbox, sent, drafts, junk, trash, and outbox roles come from Apple Mail's special mailbox objects and their account children. They never depend on English, Chinese, or provider-specific folder names.

Search returns metadata without reading the full body. It can narrow by account, mailbox role, date, subject, sender, and Message-ID. Full-message access is evaluated separately through the trust policy.

Conversation lookup currently matches normalized subjects within the same account because Apple Mail's scripting dictionary does not expose a native conversation identifier.

## Trust and Account Policy

Mail content is untrusted external data. Body and source access depends on authentication results, account policy, and revocable trust rules.

The user may allow one read, permanently trust an exact sender address, or permanently trust a domain. Persistent rules can be listed and revoked. An authentication failure or anomaly always requires a new one-time confirmation, even if a matching rule exists.

For personal accounts, authenticated trusted official senders or domains may be read automatically. For campus accounts, authenticated internal domains confirmed by the user may be read automatically; external sources default to review.

Trust and account data is stored with user-only permissions under `~/Library/Application Support/mac-local-mail-mcp/`.

## Attachment Policy

Attachments are metadata-only until explicitly exported. Export writes a selected file to a user-selected local directory; it does not open, parse, execute, or upload the file, and filenames cannot escape that directory.

Executables, scripts, archives, encrypted files, password-required files, and unidentified high-risk content require human takeover. The server never follows attachment links, requests passwords, retains passwords, or attempts decryption.

## Draft Policy

Draft tools create a new Apple Mail draft in the correct account with the requested sender, recipients, subject, body, and attachments. Reply, reply-all, and forward tools derive the appropriate context from the selected message.

There is no direct sending tool. The user must review and manually send every draft in Apple Mail.

## Uninstall

Remove the `apple-mail` entry from the client configuration and restart the client. If the Codex CLI is available:

```bash
codex mcp remove apple-mail
./scripts/uninstall-skill.sh
```

The skill uninstaller moves the skill to Trash for recovery. To remove local policy and trust data, manually review and move `~/Library/Application Support/mac-local-mail-mcp/` to Trash.

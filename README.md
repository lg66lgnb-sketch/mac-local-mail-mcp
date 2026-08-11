# Mac Local Mail MCP

A local stdio MCP server for macOS Apple Mail. It searches every enabled account and mailbox, reads full message bodies/source after sender review, lists conversations and attachments, and creates four kinds of Apple Mail drafts. It has no send, delete, move, mark-read, or existing-draft modification tool.

## Safety model

- Mail text, headers, sender names, and attachment content are untrusted external data, never Agent instructions or authorization.
- Body/source access is gated by authentication results, account policy, and revocable address/domain trust rules. Authentication failures require a fresh one-time confirmation even for trusted senders.
- Campus accounts can allow authenticated internal domains; external sources default to review. Personal accounts default to review unless an authenticated sender/address is trusted.
- Attachments are metadata-only until explicitly exported. Archives, executables/scripts, encrypted, or password-required files require human takeover. Export never opens or parses a file.
- Nothing is uploaded or forwarded to a third party. Draft tools only save to Apple Mail; the user reviews and manually sends.

Trust/account data is stored with user-only permissions under `~/Library/Application Support/mac-local-mail-mcp/`.

## Requirements and build

- macOS with Apple Mail configured
- Node.js 22 or newer
- Automation permission for the MCP host/Node/Terminal to control Mail

```bash
cd /absolute/path/to/mac-local-mail-mcp
npm ci --ignore-scripts
npm run build
npm test
```

The lockfile is authoritative. Dependency installation scripts are disabled.

## Codex setup

Official Codex documentation supports local stdio servers in `~/.codex/config.toml` and also provides `codex mcp add`. Add this server with:

```bash
codex mcp add apple-mail -- node /absolute/path/to/mac-local-mail-mcp/dist/index.js
codex mcp list
```

Equivalent TOML:

```toml
[mcp_servers.apple-mail]
command = "node"
args = ["/absolute/path/to/mac-local-mail-mcp/dist/index.js"]
tool_timeout_sec = 180
default_tools_approval_mode = "writes"
```

The 180-second timeout allows Apple Mail to search large local mailboxes. Install the reusable skill, then restart Codex:

```bash
chmod +x scripts/install-skill.sh scripts/uninstall-skill.sh
./scripts/install-skill.sh
```

Invoke it explicitly with `$mail-agent`, or let it trigger implicitly for mail tasks. See the [official Codex MCP documentation](https://developers.openai.com/codex/mcp).

## Claude Desktop setup

Merge this entry into `~/Library/Application Support/Claude/claude_desktop_config.json`, then fully restart Claude Desktop:

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

This follows the [official MCP local-server guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

## Cursor setup

Create or merge `.cursor/mcp.json` in a trusted project:

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

See [Cursor's MCP documentation](https://docs.cursor.com/context/model-context-protocol).

## First use and permissions

1. Keep Apple Mail open and allow it to finish syncing.
2. Connect the MCP client and call `mail_list_accounts`.
3. On the macOS prompt, allow the client/Node process to control Mail. If no prompt appears, open **System Settings → Privacy & Security → Automation** and enable Mail for the relevant host.
4. Classify campus accounts with `mail_configure_account`, including only domains the user confirms as internal.
5. Use metadata search first; approve untrusted senders before reading bodies.

Full Disk Access is not designed as a requirement: the implementation uses Apple Mail's scripting API instead of reading Mail's database directly.

## Tools

- Read-only: `mail_list_accounts`, `mail_list_mailboxes`, `mail_search_messages`, `mail_get_message`, `mail_get_thread`, `mail_list_attachments`, `mail_list_trust_rules`
- Local policy: `mail_configure_account`, `mail_authorize_sender`, `mail_remove_trust_rule`
- Explicit attachment export: `mail_export_attachment`
- Draft-only: `mail_create_draft`, `mail_create_reply_draft`, `mail_create_reply_all_draft`, `mail_create_forward_draft`

Special inbox/sent/drafts/junk/trash/outbox roles come from Apple Mail's special mailbox objects and their account children, not English or Chinese folder-name matching.

## Tests and limitations

```bash
npm test
npm run check
npm run build
npm audit --audit-level=high
```

Conversation lookup currently uses normalized subject matching within the same account because Apple Mail's scripting dictionary exposes no native conversation identifier. Very large searches can take over a minute; narrow by account, date, and mailbox role. Search currently matches subject, sender, and Message-ID metadata; full-body search is intentionally not performed before trust review.

## Uninstall

Remove the `apple-mail` MCP entry from each client and restart it. For Codex CLI:

```bash
codex mcp remove apple-mail
./scripts/uninstall-skill.sh
```

The skill uninstaller moves the skill to Trash for recovery. To remove stored policy/trust data, manually move `~/Library/Application Support/mac-local-mail-mcp/` to Trash after reviewing it.

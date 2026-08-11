# Mac Local Mail MCP

> [中文版见下方 / Chinese version below](#chinese-version)

A local MCP server that lets Codex, Claude Desktop, Cursor, and other MCP clients work with Apple Mail on your Mac.

It can search and read mail, inspect conversations and attachments, and create new, reply, reply-all, or forward drafts. It cannot send mail or modify existing messages.

## Ask Another Agent to Install It

Send this prompt to your Agent:

```text
Please read https://github.com/lg66lgnb-sketch/mac-local-mail-mcp and install and configure it for me. Before making changes, read README.md, AGENTS.md, SPEC.md, and STATUS.md. Preserve my existing MCP client configuration and merge only the apple-mail server entry. Never send email; this project may only create Apple Mail drafts for me to review and send manually.
```

## Install Manually

Requires macOS, Apple Mail with at least one account, and Node.js 22 or newer.

```bash
git clone https://github.com/lg66lgnb-sketch/mac-local-mail-mcp.git
cd mac-local-mail-mcp
npm ci --ignore-scripts
npm run build
./scripts/install-skill.sh
```

Then add `dist/index.js` as a local stdio MCP server in your client and restart it. Ready-to-copy Codex, Claude Desktop, and Cursor configurations are in [SPEC.md](SPEC.md#client-configuration).

On first use, allow your MCP client or Node to control Mail in **System Settings → Privacy & Security → Automation**.

## Use It

In Codex, ask normally or invoke `$mail-agent` explicitly:

```text
$mail-agent Find emails that look like they need a reply, then create a reply draft saying “Hello”. Do not send anything.
```

Email and attachment content is always treated as untrusted data. Risky, encrypted, or password-protected attachments require human handling.

For behavior and client setup, see [SPEC.md](SPEC.md). For implementation state and verification, see [STATUS.md](STATUS.md). For Agent contribution rules, see [AGENTS.md](AGENTS.md). Licensed under [MIT](LICENSE).

---

## Chinese Version

Mac Local Mail MCP 是一个本机 MCP Server，让 Codex、Claude Desktop、Cursor 等 MCP 客户端连接你 Mac 上的 Apple Mail。

它可以搜索和读取邮件、查看会话与附件，并新建邮件、回复、回复全部或转发草稿。它不能发送邮件，也不能修改已有邮件。

### 让另一个 Agent 帮你安装

把这段指令发给你的 Agent：

```text
请阅读 https://github.com/lg66lgnb-sketch/mac-local-mail-mcp 并帮我完成安装与配置。修改前先阅读 README.md、AGENTS.md、SPEC.md 和 STATUS.md。保留我现有的 MCP 客户端配置，只合并 apple-mail Server 条目。绝不要发送邮件；这个项目只能创建 Apple Mail 草稿，由我检查并手动发送。
```

### 手动安装

需要 macOS、至少已登录一个账户的 Apple Mail，以及 Node.js 22 或更高版本。

```bash
git clone https://github.com/lg66lgnb-sketch/mac-local-mail-mcp.git
cd mac-local-mail-mcp
npm ci --ignore-scripts
npm run build
./scripts/install-skill.sh
```

然后把 `dist/index.js` 作为本地 stdio MCP Server 加入客户端并重启。Codex、Claude Desktop 和 Cursor 的可复制配置见 [SPEC.md](SPEC.md#client-configuration)。

首次使用时，在 **系统设置 → 隐私与安全性 → 自动化** 中允许 MCP 客户端或 Node 控制 Mail。

### 使用

在 Codex 中可以直接描述需求，或显式调用 `$mail-agent`：

```text
$mail-agent 找出看起来需要回复的邮件，然后创建一封正文为“你好”的回复草稿。绝不要发送。
```

邮件与附件内容始终是不可信外部数据。高风险、加密或需要密码的附件必须由人工处理。

功能和客户端配置见 [SPEC.md](SPEC.md)，实现状态与验证结果见 [STATUS.md](STATUS.md)，Agent 开发规则见 [AGENTS.md](AGENTS.md)。项目采用 [MIT License](LICENSE)。

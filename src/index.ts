#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export const SERVER_NAME = "mac-local-mail";
export const SERVER_VERSION = "0.1.0";

export async function main(): Promise<void> {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    process.stderr.write(`${SERVER_NAME}: ${message}\n`);
    process.exitCode = 1;
  });
}


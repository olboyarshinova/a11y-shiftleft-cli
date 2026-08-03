import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import type { Command } from "commander";
import { createProgram } from "../../dist/cli.js";

type CommandLookup = {
  command: Command;
  path: string;
};

function buildCommandLookup(program: Command): Map<string, CommandLookup> {
  const lookup = new Map<string, CommandLookup>();

  const register = (command: Command, path: string) => {
    lookup.set(path, { command, path });
    for (const alias of command.aliases()) {
      const aliasPath = path.split(" ").slice(0, -1).concat(alias).join(" ");
      lookup.set(aliasPath, { command, path: aliasPath });
    }

    for (const child of command.commands) {
      register(child, `${path} ${child.name()}`);
    }
  };

  for (const command of program.commands) {
    register(command, command.name());
  }

  return lookup;
}

function tokenize(command: string): string[] {
  return command.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
}

function extractDocumentedCliInvocations(readme: string): string[] {
  const snippets: string[] = [];
  for (const match of readme.matchAll(/```[a-z]*\n([\s\S]*?)```/g)) {
    snippets.push(match[1] ?? "");
  }
  for (const match of readme.matchAll(/`([^`\n]*(?:a11y-shiftleft-cli|a11y-shiftleft|node bin\/cli\.js)[^`\n]*)`/g)) {
    snippets.push(match[1] ?? "");
  }

  const normalized = snippets.join("\n").replace(/\\\n\s*/g, " ");
  const invocations: string[] = [];
  const pattern = /(?:npx[ \t]+)?(?:a11y-shiftleft-cli|a11y-shiftleft|node[ \t]+bin\/cli\.js)[ \t]+([^\n`]+)/g;

  for (const match of normalized.matchAll(pattern)) {
    const invocation = match[1]?.trim();
    if (invocation) {
      invocations.push(invocation);
    }
  }

  return invocations;
}

function resolveDocumentedCommand(tokens: string[], lookup: Map<string, CommandLookup>): CommandLookup | undefined {
  const first = tokens[0];
  const second = tokens[1];

  if (!first) {
    return undefined;
  }

  if (second && lookup.has(`${first} ${second}`)) {
    return lookup.get(`${first} ${second}`);
  }

  return lookup.get(first);
}

test("README CLI examples use registered commands and options", async () => {
  const readme = await fs.readFile("README.md", "utf8");
  const lookup = buildCommandLookup(createProgram());
  const invocations = extractDocumentedCliInvocations(readme);

  assert.ok(invocations.length > 10, "expected README to include copy-paste CLI examples");

  for (const invocation of invocations) {
    const tokens = tokenize(invocation);
    const documentedCommand = resolveDocumentedCommand(tokens, lookup);

    assert.ok(
      documentedCommand,
      `README uses an unknown CLI command in: ${invocation}`
    );

    const supportedFlags = new Set(documentedCommand.command.options.map((option) => option.long));
    const documentedFlags = tokens
      .filter((token) => token.startsWith("--") && token !== "--")
      .map((token) => token.split("=")[0]);

    for (const flag of documentedFlags) {
      assert.ok(
        supportedFlags.has(flag),
        `README uses unsupported option ${flag} for ${documentedCommand.path} in: ${invocation}`
      );
    }
  }
});

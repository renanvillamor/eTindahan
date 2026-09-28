#!/usr/bin/env node
// UserPromptSubmit hook: injects the knowledge base (docs/APP_NOTES.md)
// section index into Claude's context on every prompt, so the agent is
// reminded to consult the relevant sections before analyzing or answering.
//
// The index is generated from the file's headings at run time, so it never
// drifts from the document itself. Only headings + line numbers are injected
// (not the whole file) to keep per-prompt context cost small; the agent reads
// the sections it needs with the Read tool using the line offsets.

const fs = require("fs");
const path = require("path");

const projectDir = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, "..", "..");
const kbRelPath = "docs/APP_NOTES.md";
const kbPath = path.join(projectDir, kbRelPath);

let text;
try {
  text = fs.readFileSync(kbPath, "utf8");
} catch {
  // Never block the prompt if the knowledge base is missing.
  process.exit(0);
}

const lines = text.split(/\r?\n/);
const index = [];
let inFence = false;
lines.forEach((line, i) => {
  if (/^\s*```/.test(line)) inFence = !inFence;
  if (inFence) return;
  const m = /^(#{2,3})\s+(.*)$/.exec(line);
  if (m) index.push(`${m[1].length === 3 ? "    " : "  "}- L${i + 1}: ${m[2].trim()}`);
});

const out = [
  `<knowledge-base path="${kbRelPath}" lines="${lines.length}">`,
  "Project knowledge base / source of truth for business logic and processes.",
  "Before analyzing or answering anything that touches inventory, pricing, sales,",
  "deliveries, payables, expenses, reports, dates/timezones, caching or sync:",
  "Read the relevant section(s) below (Read with offset = line number) and treat",
  "them as authoritative over inferences from individual files. If your change",
  "alters anything documented there, update the doc in the same change.",
  "Sections:",
  ...index,
  "</knowledge-base>",
];
process.stdout.write(out.join("\n") + "\n");

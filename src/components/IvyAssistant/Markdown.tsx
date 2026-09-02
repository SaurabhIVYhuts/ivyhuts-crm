"use client";

// Dependency-free markdown renderer for assistant replies. The CRM ships no
// markdown library (deliberately lean deps — see package.json), and the
// assistant only ever emits a small, predictable subset, so this covers it
// directly instead of pulling in react-markdown + remark-gfm:
//
//   headings (#..###), paragraphs, blank-line separation
//   unordered lists (-, *) and ordered lists (1.)
//   GFM pipe tables (with a |---|---| separator row)
//   blockquotes (>), horizontal rules (---), fenced code blocks (```)
//   inline: **bold**, *italic* / _italic_, `code`, [text](url)
//   auto-linking of /leads/{id} -> the CRM lead route, and bare http(s) URLs
//
// Tolerant of half-formed markdown arriving mid-stream: an unclosed ** or a
// partial table row renders as text rather than throwing. All React keys are
// derived from structural indices/offsets — no mutable counters.

import Link from "next/link";
import { Fragment, type ReactNode } from "react";

const LEAD_PATH_RE = /\/leads\/([a-zA-Z0-9_-]+)/g;
const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?]/g;
const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)]+\))/g;

function renderLink(href: string, children: ReactNode[], k: string): ReactNode {
  if (href.startsWith("/")) {
    return (
      <Link key={k} href={href} className="text-accent underline underline-offset-2 hover:text-accent-strong">
        {children}
      </Link>
    );
  }
  return (
    <a
      key={k}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:text-accent-strong"
    >
      {children}
    </a>
  );
}

function linkifyUrls(chunk: string, prefix: string): ReactNode[] {
  if (!chunk) return [];
  const out: ReactNode[] = [];
  let cursor = 0;
  for (const um of chunk.matchAll(URL_RE)) {
    const idx = um.index ?? 0;
    if (idx > cursor) out.push(chunk.slice(cursor, idx));
    out.push(renderLink(um[0], [um[0]], `${prefix}u${idx}`));
    cursor = idx + um[0].length;
  }
  if (cursor < chunk.length) out.push(chunk.slice(cursor));
  return out;
}

// Plain text run: auto-link /leads/{id}, then bare URLs.
function renderText(chunk: string, prefix: string): ReactNode[] {
  if (!chunk) return [];
  const out: ReactNode[] = [];
  let cursor = 0;
  for (const lm of chunk.matchAll(LEAD_PATH_RE)) {
    const idx = lm.index ?? 0;
    if (idx > cursor) out.push(...linkifyUrls(chunk.slice(cursor, idx), `${prefix}${idx}a`));
    out.push(
      <Link
        key={`${prefix}ld${idx}`}
        href={`/dashboard/leads/${lm[1]}`}
        className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
      >
        /leads/{lm[1]}
      </Link>
    );
    cursor = idx + lm[0].length;
  }
  if (cursor < chunk.length) out.push(...linkifyUrls(chunk.slice(cursor), `${prefix}${cursor}b`));
  return out;
}

function renderInline(input: string, prefix = "il"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const m of input.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(...renderText(input.slice(last, idx), `${prefix}${last}t`));
    const tok = m[0];
    const k = `${prefix}${idx}`;
    if (tok.startsWith("`")) {
      nodes.push(
        <code key={k} className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em] text-ink">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      nodes.push(
        <strong key={k} className="font-semibold text-ink">
          {renderInline(tok.slice(2, -2), `${k}s`)}
        </strong>
      );
    } else if (tok.startsWith("[")) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      nodes.push(lm ? renderLink(lm[2], renderInline(lm[1], `${k}l`), k) : tok);
    } else {
      nodes.push(
        <em key={k} className="italic">
          {renderInline(tok.slice(1, -1), `${k}e`)}
        </em>
      );
    }
    last = idx + tok.length;
  }
  if (last < input.length) nodes.push(...renderText(input.slice(last), `${prefix}${last}z`));
  return nodes;
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

function renderTable(rows: string[][], k: string): ReactNode {
  const [head, ...body] = rows;
  return (
    <div key={k} className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-line">
            {head.map((cell, ci) => (
              <th key={ci} className="px-2 py-1.5 font-semibold text-subtle">
                {renderInline(cell, `${k}h${ci}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className="border-b border-line-soft last:border-0">
              {head.map((_, ci) => (
                <td key={ci} className="px-2 py-1.5 align-top text-ink">
                  {renderInline(r[ci] ?? "", `${k}r${ri}c${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const k = `blk${blocks.length}`;
    blocks.push(
      <p key={k} className="my-1.5 whitespace-pre-wrap leading-relaxed first:mt-0 last:mb-0">
        {renderInline(paragraph.join("\n"), k)}
      </p>
    );
    paragraph = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const bk = `blk${blocks.length}`;

    if (/^```/.test(line.trim())) {
      flushParagraph();
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre key={bk} className="my-2 overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs text-ink">
          <code>{buf.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      i += 1;
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushParagraph();
      blocks.push(<hr key={bk} className="my-3 border-line" />);
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const cls =
        level <= 1
          ? "mt-2 mb-1 text-base font-semibold text-ink"
          : level === 2
            ? "mt-2 mb-1 text-sm font-semibold text-ink"
            : "mt-1.5 mb-1 text-xs font-semibold uppercase tracking-wide text-subtle";
      blocks.push(
        <p key={bk} className={cls}>
          {renderInline(heading[2], bk)}
        </p>
      );
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      const rows: string[][] = [splitRow(line)];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push(renderTable(rows, `blk${blocks.length}`));
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote key={`blk${blocks.length}`} className="my-2 border-l-2 border-line pl-3 text-subtle">
          {renderInline(buf.join("\n"), `blk${blocks.length}`)}
        </blockquote>
      );
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      flushParagraph();
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""));
        i += 1;
      }
      const listClass = `my-1.5 ${ordered ? "list-decimal" : "list-disc"} space-y-0.5 pl-5 leading-relaxed`;
      const lk = `blk${blocks.length}`;
      blocks.push(
        ordered ? (
          <ol key={lk} className={listClass}>
            {items.map((it, idx) => (
              <li key={idx}>{renderInline(it, `${lk}i${idx}`)}</li>
            ))}
          </ol>
        ) : (
          <ul key={lk} className={listClass}>
            {items.map((it, idx) => (
              <li key={idx}>{renderInline(it, `${lk}i${idx}`)}</li>
            ))}
          </ul>
        )
      );
      continue;
    }

    paragraph.push(line);
    i += 1;
  }
  flushParagraph();

  return <Fragment>{blocks}</Fragment>;
}

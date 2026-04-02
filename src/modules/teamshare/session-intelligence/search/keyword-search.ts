import * as fs from "fs";
import * as path from "path";
import type { SessionRegistryEntry } from "../types";
import { TEAMSHARE_DIR, SUMMARIES_DIR } from "../types";
import { IndexBuilder } from "./index-builder";

// ─── Keyword Search (Layer 2) ──────────────────────────────────────
// Uses inverted index for fast lookup + grep across summaries.
// Instant, zero cost.

export interface KeywordSearchResult {
  sessionId: string;
  score: number;
  matchedKeywords: string[];
  snippet: string;
}

export function keywordSearch(
  query: string,
  candidates: Map<string, SessionRegistryEntry>,
  indexBuilder: IndexBuilder,
  projectRoot: string
): KeywordSearchResult[] {
  const queryWords = tokenize(query);

  // Phase 1: Index lookup - fast O(1) per keyword
  const indexScores = indexBuilder.lookupKeywords(queryWords);

  // Phase 2: Grep summaries for candidates
  const results: KeywordSearchResult[] = [];

  for (const [sessionId, entry] of candidates) {
    const indexScore = indexScores.get(sessionId) ?? 0;
    const grepResult = grepSummary(sessionId, query, projectRoot);

    const totalScore = indexScore * 2 + grepResult.score;

    if (totalScore > 0) {
      const matchedKeywords = queryWords.filter(
        (w) => indexBuilder.lookupKeyword(w).includes(sessionId)
      );

      results.push({
        sessionId,
        score: totalScore,
        matchedKeywords,
        snippet: grepResult.snippet || entry.title,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

interface GrepResult {
  score: number;
  snippet: string;
}

function grepSummary(sessionId: string, query: string, projectRoot: string): GrepResult {
  const summaryPath = path.join(
    projectRoot, TEAMSHARE_DIR, SUMMARIES_DIR, `${sessionId}.json`
  );

  try {
    const raw = fs.readFileSync(summaryPath, "utf-8");
    const content = raw.toLowerCase();
    const queryLower = query.toLowerCase();
    const queryWords = tokenize(query);

    let score = 0;
    let snippet = "";

    // Exact phrase match (highest value)
    if (content.includes(queryLower)) {
      score += 5;
      snippet = extractSnippet(raw, queryLower);
    }

    // Individual word matches
    for (const word of queryWords) {
      if (content.includes(word)) {
        score += 1;
        if (!snippet) {
          snippet = extractSnippet(raw, word);
        }
      }
    }

    return { score, snippet };
  } catch {
    return { score: 0, snippet: "" };
  }
}

function extractSnippet(content: string, match: string): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(match.toLowerCase());
  if (idx === -1) {
    return "";
  }

  const start = Math.max(0, idx - 50);
  const end = Math.min(content.length, idx + match.length + 100);
  let snippet = content.slice(start, end).replace(/\n/g, " ").trim();

  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < content.length) {
    snippet = snippet + "...";
  }

  return snippet;
}

/**
 * Search utilities with accent-insensitive fuzzy matching.
 */

import { normalizeAccents } from "./strings";
import type { Client } from "@/lib/types";

/** Normalize a search term: trim, lowercase, strip accents, collapse whitespace */
export function normalizeSearchTerm(term: string): string {
  if (!term) return "";
  return normalizeAccents(term.toLowerCase().trim()).replace(/\s+/g, " ");
}

/** Fuzzy string matching with similarity score */
export function fuzzyMatch(
  text: string,
  query: string,
  threshold: number = 0.3
): { match: boolean; score: number } {
  if (!text || !query) return { match: false, score: 0 };

  const normalizedText = normalizeSearchTerm(text);
  const normalizedQuery = normalizeSearchTerm(query);

  if (!normalizedQuery) return { match: false, score: 0 };

  // Exact match
  if (normalizedText === normalizedQuery) return { match: true, score: 1 };

  // Contains
  if (normalizedText.includes(normalizedQuery)) {
    const score = normalizedQuery.length / normalizedText.length;
    return { match: true, score: Math.max(0.5, score) };
  }

  // Prefix match
  if (normalizedText.startsWith(normalizedQuery)) {
    return { match: true, score: 0.8 };
  }

  // Character-by-character fuzzy match
  let queryIdx = 0;
  let matched = 0;
  for (let i = 0; i < normalizedText.length && queryIdx < normalizedQuery.length; i++) {
    if (normalizedText[i] === normalizedQuery[queryIdx]) {
      matched++;
      queryIdx++;
    }
  }

  const score = queryIdx === normalizedQuery.length
    ? matched / Math.max(normalizedText.length, normalizedQuery.length)
    : 0;

  return { match: score >= threshold, score };
}

/** Default client search fields */
const DEFAULT_SEARCH_FIELDS: Array<keyof Client> = [
  "raisonSociale", "ref", "siren", "dirigeant", "ville", "comptable",
];

/** Search clients across multiple fields with relevance scoring */
export function searchClients(
  clients: Client[],
  query: string,
  fields?: Array<keyof Client>
): Client[] {
  const normalizedQuery = normalizeSearchTerm(query);
  if (!normalizedQuery) return clients;

  const searchFields = fields ?? DEFAULT_SEARCH_FIELDS;

  const scored = clients
    .map(client => {
      let bestScore = 0;

      for (const field of searchFields) {
        const val = client[field];
        if (val === null || val === undefined) continue;
        const text = String(val);
        const normalizedText = normalizeSearchTerm(text);

        // Exact field match
        if (normalizedText === normalizedQuery) {
          bestScore = Math.max(bestScore, 1);
          break;
        }
        // Starts with
        if (normalizedText.startsWith(normalizedQuery)) {
          bestScore = Math.max(bestScore, 0.9);
          continue;
        }
        // Contains
        if (normalizedText.includes(normalizedQuery)) {
          bestScore = Math.max(bestScore, 0.7);
          continue;
        }
        // Fuzzy
        const { match, score } = fuzzyMatch(text, query);
        if (match) {
          bestScore = Math.max(bestScore, score * 0.6);
        }
      }

      return { client, score: bestScore };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ client }) => client);
}

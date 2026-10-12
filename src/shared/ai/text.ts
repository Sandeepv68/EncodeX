/**
 * @fileoverview Small deterministic text utilities shared by the R4 media
 * features (chapters, transcript search, summary). Word-frequency work is pure
 * code so a summary or chapter title is reproducible from the same transcript
 * (roadmap §7.3) and never requires a model call.
 */

/**
 * Common English stop words filtered from keyword extraction. Kept deliberately
 * small and lowercase; keyword quality degrades gracefully if a language is not
 * English.
 * @const {Set<string>}
 */
export const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'but',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'doing',
  'for',
  'from',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'him',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'me',
  'more',
  'most',
  'my',
  'no',
  'not',
  'of',
  'on',
  'or',
  'our',
  'out',
  'over',
  'she',
  'should',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'to',
  'too',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
]);

/**
 * Splits text into lowercase word tokens (`\p{L}\p{N}` runs).
 * @param {string} text - Source text.
 * @returns {string[]} Lowercase tokens.
 */
export function tokenize(text: string): string[] {
  return String(text ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);
}

/**
 * Tokenizes and drops stop words and single characters.
 * @param {string} text - Source text.
 * @returns {string[]} Content tokens.
 */
export function contentTokens(text: string): string[] {
  return tokenize(text).filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Scores each content word by frequency across a set of texts.
 * @param {string[]} texts - The corpus.
 * @returns {Map<string, number>} Word → occurrence count.
 */
export function wordFrequencies(texts: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const token of contentTokens(text)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Extracts the most salient keywords from one piece of text, ranked by the
 * corpus frequency then by first appearance (stable, deterministic).
 * @param {string} text - The text to summarize.
 * @param {Map<string, number>} frequencies - Corpus word frequencies.
 * @param {number} [limit] - Maximum keywords to return.
 * @returns {string[]} Ranked keywords.
 */
export function keywordsFor(text: string, frequencies: Map<string, number>, limit = 5): string[] {
  const firstSeen = new Map<string, number>();
  const tokens = contentTokens(text);
  tokens.forEach((token, index) => {
    if (!firstSeen.has(token)) firstSeen.set(token, index);
  });
  return [...new Set(tokens)]
    .sort((a, b) => {
      const freq = (frequencies.get(b) ?? 0) - (frequencies.get(a) ?? 0);
      if (freq !== 0) return freq;
      return (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0);
    })
    .slice(0, limit);
}

/**
 * Title-cases a keyword phrase for use as a chapter heading.
 * @param {string[]} keywords - Ranked keywords.
 * @returns {string} A human-readable title, or an empty string when there are none.
 */
export function titleCase(keywords: string[]): string {
  return keywords.map((word) => (word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))).join(' ');
}

/**
 * Splits a block of text into sentences on terminal punctuation.
 * @param {string} text - Source text.
 * @returns {string[]} Non-empty sentences.
 */
export function splitSentences(text: string): string[] {
  return String(text ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * @fileoverview Deterministic extractive summarization (roadmap 2.0, F15).
 * Ranks sentences by aggregate content-word frequency and returns the top ones
 * in their original order, plus salient topics. Pure code — an assistant gets a
 * stable summary of the same transcript without a model call (roadmap §7.3).
 */

import { contentTokens, splitSentences, wordFrequencies } from './text';
import { transcriptWordCount } from './transcript';
import type { Transcript } from './transcript';

/**
 * An extractive summary of a transcript.
 * @interface TranscriptSummary
 * @property {string[]} summary - Selected sentences, in original order.
 * @property {string[]} topics - Most salient keywords.
 * @property {number} wordCount - Total words in the source transcript.
 * @property {number} durationSeconds - Source duration.
 * @property {number} sentenceCount - Number of candidate sentences considered.
 */
export interface TranscriptSummary {
  summary: string[];
  topics: string[];
  wordCount: number;
  durationSeconds: number;
  sentenceCount: number;
}

/**
 * Tuning for {@link summarizeTranscript}.
 * @interface SummaryOptions
 * @property {number} [maxSentences] - Summary length in sentences (default 5).
 * @property {number} [maxTopics] - Number of topics to report (default 8).
 */
export interface SummaryOptions {
  maxSentences?: number;
  maxTopics?: number;
}

/**
 * Builds an extractive summary from a transcript.
 * @param {Transcript} transcript - The transcript.
 * @param {SummaryOptions} [options] - Tuning options.
 * @returns {TranscriptSummary} The summary, topics, and source stats.
 */
export function summarizeTranscript(transcript: Transcript, options: SummaryOptions = {}): TranscriptSummary {
  const maxSentences = Math.max(1, options.maxSentences ?? 5);
  const maxTopics = Math.max(1, options.maxTopics ?? 8);
  const sentences = (transcript.segments ?? []).flatMap((segment) => {
    const parts = splitSentences(segment.text);
    return parts.length > 0 ? parts : [segment.text];
  });
  const frequencies = wordFrequencies(sentences);
  const scored = sentences.map((sentence, index) => {
    const tokens = contentTokens(sentence);
    const raw = tokens.reduce((sum, token) => sum + (frequencies.get(token) ?? 0), 0);
    return { sentence, index, score: raw / Math.sqrt(Math.max(1, tokens.length)) };
  });
  const summary = scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.sentence);
  const topics = [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxTopics)
    .map(([word]) => word);
  return {
    summary: summary.length > 0 ? summary : sentences.slice(0, 1),
    topics,
    wordCount: transcriptWordCount(transcript),
    durationSeconds: transcript.durationSeconds,
    sentenceCount: sentences.length,
  };
}

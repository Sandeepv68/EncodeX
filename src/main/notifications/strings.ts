import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { DEFAULT_LANGUAGE } from '../../shared/constants';
import type { NotificationStringVars } from './strings.types';

let cache: { locale: string; map: Record<string, unknown> } | null = null;

function readLocaleFile(locale: string): Record<string, unknown> | null {
  try {
    const candidates = [
      path.join(process.resourcesPath || '', 'app.asar', 'dist', 'renderer', 'i18n', 'locales', `${locale}.json`),
      path.join(process.resourcesPath || '', 'dist', 'renderer', 'i18n', 'locales', `${locale}.json`),
      path.join(app.getAppPath(), 'dist', 'renderer', 'i18n', 'locales', `${locale}.json`),
      path.join(app.getAppPath(), 'src', 'renderer', 'i18n', 'locales', `${locale}.json`),
      path.join(__dirname, '..', '..', 'renderer', 'i18n', 'locales', `${locale}.json`),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function getLocale(): string {
  try {
    const l = app.getLocale?.() || DEFAULT_LANGUAGE;
    return l || DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function loadMap(locale: string): Record<string, unknown> {
  if (cache?.locale === locale) return cache.map;
  const map = readLocaleFile(locale) || readLocaleFile(DEFAULT_LANGUAGE) || {};
  cache = { locale, map };
  return map;
}

function get(obj: unknown, keyPath: string): unknown {
  return keyPath.split('.').reduce((acc: any, k) => (acc && acc[k] != null ? acc[k] : undefined), obj as any);
}

function interpolate(str: string, vars?: NotificationStringVars): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

const fallbacks: Record<string, string> = {
  'notifications.jobCompletedTitle': 'Conversion complete',
  'notifications.jobCompletedBody': '{{fileName}} finished successfully.',
  'notifications.jobFailedTitle': 'Conversion failed',
  'notifications.jobFailedBody': '{{fileName}} failed.',
  'notifications.queueCompletedTitle': 'Queue complete',
  'notifications.queueCompletedBody': '{{succeeded}} succeeded, {{failed}} failed.',
  'notifications.muxJobCompletedTitle': 'Remux/demux complete',
  'notifications.muxJobCompletedBody': '{{fileName}} finished successfully.',
  'notifications.muxJobFailedTitle': 'Remux/demux failed',
  'notifications.muxJobFailedBody': '{{fileName}} failed.',
  'notifications.muxQueueCompletedTitle': 'Remux/demux queue complete',
  'notifications.muxQueueCompletedBody': '{{succeeded}} succeeded, {{failed}} failed.',
};

export function tNotification(key: string, vars?: NotificationStringVars): string {
  try {
    const locale = getLocale();
    const map = loadMap(locale);
    const raw = get(map, key);
    if (typeof raw === 'string') return interpolate(raw, vars);
    const en = locale === DEFAULT_LANGUAGE ? map : loadMap(DEFAULT_LANGUAGE);
    const rawEn = get(en, key);
    if (typeof rawEn === 'string') return interpolate(rawEn, vars);
  } catch {
    // ignore
  }
  return interpolate(fallbacks[key] || key, vars);
}

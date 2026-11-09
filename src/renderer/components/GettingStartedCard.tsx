/**
 * @fileoverview First-run "Getting Started" card for the Dashboard.
 *
 * Implements Checkpoint 11 of `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md`: a
 * lightweight, non-gating onboarding surface shown on the first launch. The
 * user picks a goal (convert / compress / extract / trim) and is dropped
 * straight into that tool's flow. Nothing is blocked — the card is dismissible
 * and disappears permanently once a goal is chosen or it is skipped.
 *
 * Behavior:
 *  - Visibility is tracked via a plain localStorage flag
 *    (`encodex-onboarding-completed`). Absent => never shown before => show.
 *  - On first render it records the `onboarding_started` analytics event.
 *  - Selecting a goal records `onboarding_goal_selected`, sets the flag, and
 *    navigates to the matching tool route.
 *  - The dismiss (X) button sets the flag and hides the card without recording
 *    a goal, so "solved it myself" users are never pushed again.
 *  - Two setup actions join the goals in the same row: "Enable MCP server"
 *    turns on the embedded MCP server (off by default — this is the explicit
 *    opt-in) and "Connect your AI providers" jumps to the Settings page with
 *    the AI-provider editor open. Neither resolves the onboarding flag, so the
 *    user can still pick a goal afterwards.
 *  - Every action on the card is the same button, in a single row that grows
 *    with the card. The row scrolls horizontally rather than wrapping when the
 *    window is too narrow to fit the whole set.
 *
 * All copy uses i18n keys under `gettingStarted.*`, which fall back to en-US
 * until translated in the other 55 locale files.
 */

import { useEffect, useState, useCallback } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import {
  GettingStartedRoot,
  GettingStartedHeader,
  GettingStartedHint,
  GettingStartedTitle,
  GettingStartedBody,
  ActionRow,
  ActionButton,
  DismissButton,
} from '../styles/GettingStartedCard.styles';
import { useSettingsStore } from '../stores/settingsStore';
import { useToastStore } from '../stores/toastStore';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import type { GoalSpec } from './types';
import type { SettingsLocationState } from '../types';
import pkg from '../../../package.json';

/**
 * localStorage key marking that the onboarding card has been seen/resolved.
 * Absent means "first launch". Shared with no other module.
 * @const {string}
 */
const ONBOARDING_STORAGE_KEY = 'encodex-onboarding-completed';

/** App version used to stamp analytics events. @const {string} */
const APP_VERSION = pkg.version;

/** The goals offered on the card. @const {GoalSpec[]} */
const GOALS: GoalSpec[] = [
  { goal: 'copilot', to: '/copilot', i18nKey: 'copilot' },
  { goal: 'convert', to: '/convert', i18nKey: 'convert' },
  { goal: 'compress', to: '/image-compress', i18nKey: 'compress' },
  { goal: 'extract', to: '/audio-extract', i18nKey: 'extract' },
  { goal: 'trim', to: '/video-cut', i18nKey: 'trim' },
  { goal: 'remux', to: '/remux', i18nKey: 'remux' },
];

/**
 * Renders the first-run getting-started card, or nothing when it has already
 * been completed or skipped.
 *
 * @returns {ReactElement | null} The card, or null when not first run.
 */
export default function GettingStartedCard(): ReactElement | null {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const setMcpEnabled = useSettingsStore((s) => s.setMcpEnabled);

  /** Whether the card is resolved (hide render). @type {boolean} */
  const [completed, setCompleted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  /**
   * Marks the card resolved in localStorage and hides it.
   * @returns {void}
   */
  const resolve = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      /* storage unavailable — keep card hidden for this session only */
    }
    setCompleted(true);
  }, []);

  /**
   * Records `onboarding_started` the first time the card actually appears.
   * @returns {void}
   */
  useEffect(() => {
    if (!completed) {
      recordAnalyticsEvent(createAnalyticsEvent('onboarding_started', { version: APP_VERSION }));
    }
  }, [completed]);

  if (completed) return null;

  /**
   * Handles a goal selection: records the event, persists completion, and
   * navigates into the matching tool.
   * @param {GoalSpec} spec - The chosen goal.
   * @returns {void}
   */
  function handleGoal(spec: GoalSpec): void {
    recordAnalyticsEvent(createAnalyticsEvent('onboarding_goal_selected', { goal: spec.goal }));
    resolve();
    navigate(spec.to);
  }

  /**
   * Records the `onboarding_dismissed` event and hides the card without picking
   * a goal, so users who solve it themselves are never pushed again.
   * @returns {void}
   */
  function handleDismiss(): void {
    recordAnalyticsEvent(createAnalyticsEvent('onboarding_dismissed', { version: APP_VERSION }));
    resolve();
  }

  /**
   * Turns on the embedded MCP server from the onboarding card. The server is
   * disabled by default, so this is the explicit opt-in action; the store
   * persists the flag and the main process starts the loopback server.
   * @returns {void}
   */
  function handleEnableMcp(): void {
    setMcpEnabled(true);
    useToastStore.getState().success(t('gettingStarted.mcpEnabled'));
    recordAnalyticsEvent(createAnalyticsEvent('onboarding_mcp_enabled', {}));
  }

  /**
   * Sends the user to the Settings page with the AI-provider editor opened, so
   * they can pick a provider and paste their API key. The card stays visible:
   * the provider may not be connected yet, so onboarding is not resolved here.
   * @returns {void}
   */
  function handleConnectAiProviders(): void {
    recordAnalyticsEvent(createAnalyticsEvent('onboarding_ai_providers_opened', {}));
    navigate('/settings', { state: { openAiProvider: true } satisfies SettingsLocationState });
  }

  return (
    <GettingStartedRoot data-testid="getting-started-card">
      <GettingStartedHeader>
        <div>
          <GettingStartedHint component="span">{t('gettingStarted.hint')}</GettingStartedHint>
          <GettingStartedTitle variant="h6" component="h2">
            {t('gettingStarted.title')}
          </GettingStartedTitle>
          <GettingStartedBody variant="body2">{t('gettingStarted.body')}</GettingStartedBody>
        </div>
        <DismissButton size="small" aria-label={t('gettingStarted.dismiss')} onClick={handleDismiss} data-testid="getting-started-dismiss">
          <FontAwesomeIcon icon={faXmark} />
        </DismissButton>
      </GettingStartedHeader>
      <ActionRow>
        {GOALS.map((spec) => (
          <ActionButton
            key={spec.goal}
            size="small"
            variant="outlined"
            onClick={() => handleGoal(spec)}
            data-testid={`getting-started-goal-${spec.goal}`}
          >
            {t(`gettingStarted.goals.${spec.i18nKey}`)}
          </ActionButton>
        ))}
        <ActionButton size="small" variant="outlined" onClick={handleEnableMcp} data-testid="getting-started-enable-mcp">
          {t('gettingStarted.enableMcp')}
        </ActionButton>
        <ActionButton size="small" variant="outlined" onClick={handleConnectAiProviders} data-testid="getting-started-connect-ai-providers">
          {t('gettingStarted.connectAiProviders')}
        </ActionButton>
      </ActionRow>
    </GettingStartedRoot>
  );
}

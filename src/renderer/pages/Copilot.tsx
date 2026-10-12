/**
 * @fileoverview Copilot page (roadmap 7.4, R6; AI connector plan §7.2).
 *
 * A renderer surface for the EncodeX planner: the user describes a goal, picks
 * files and/or a folder, optionally forces an operation, and the main process
 * scans and probes the media, routes the goal to one operation, and returns the
 * plan — ready-to-enqueue options for queue-backed operations, read-only
 * findings for `analyze`. This page renders the plan as a proposal and lets the
 * user push the actions into the existing Batch Queue; it never starts a
 * conversion itself, so there is no second approval system.
 *
 * The page is deliberately inert on mount: it calls the preload bridge only in
 * event handlers, so every hostile/renderer suite can mount it safely. AI
 * provider configuration lives on the Settings page; this page only links
 * there. Bridge calls are wrapped in {@link bridgePromise} +
 * {@link withBridgeTimeout} so a missing, throwing, or hung bridge degrades to
 * an inline error instead of crashing the tree.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { faFolderOpen, faListCheck, faRobot, faWandMagicSparkles, faGear, faFileImport } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PageContainer from '../components/PageContainer';
import { pageIcons } from '../pageIcons';
import { bridgePromise, withBridgeTimeout } from '../utils/bridge-call';
import { useToastStore } from '../stores/toastStore';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import type { CopilotOperationChoice, CopilotPlan } from '../../shared/copilot';
import { COPILOT_QUEUE_OPERATIONS, COPILOT_INTELLIGENCE_OPERATIONS } from '../../shared/copilot';
import { formatError } from '../../shared/errors';

/** How long the plan request may take before the page shows a failure. */
const PLAN_TIMEOUT_MS = 60_000;
/** How long a file/folder dialog may take before the page gives up. */
const FOLDER_TIMEOUT_MS = 30_000;

/** The selectable operations, in menu order (auto first, then queue, then read-only). */
const OPERATION_CHOICES: CopilotOperationChoice[] = ['auto', ...COPILOT_QUEUE_OPERATIONS, ...COPILOT_INTELLIGENCE_OPERATIONS];

/**
 * Renders the Copilot page (`/copilot`).
 * @returns {JSX.Element} The page content.
 */
export default function Copilot() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  /** The user's natural-language goal. */
  const [goal, setGoal] = useState('');
  /** Media files picked by the user (files and/or a folder). */
  const [inputs, setInputs] = useState<string[]>([]);
  /** The forced operation, or 'auto' to let the planner decide. */
  const [operation, setOperation] = useState<CopilotOperationChoice>('auto');
  /** The latest plan, once one has been produced. */
  const [plan, setPlan] = useState<CopilotPlan | null>(null);
  /** True while a plan is being built or jobs are being enqueued. */
  const [busy, setBusy] = useState(false);
  /** Inline error message, or null when healthy. */
  const [error, setError] = useState<string | null>(null);
  /** Informational notice, or null. */
  const [notice, setNotice] = useState<string | null>(null);
  /** Passage to look for when searching a transcript. */
  const [query, setQuery] = useState('');
  /** Target language when translating subtitles. */
  const [targetLanguage, setTargetLanguage] = useState('');

  /**
   * Opens the folder dialog (recursively) and replaces the current inputs.
   * @returns {Promise<void>} Resolves after the selection is stored.
   */
  const chooseFolder = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    const files = await withBridgeTimeout(
      bridgePromise(() => window.electronAPI.selectFolderFiles()),
      FOLDER_TIMEOUT_MS,
      null,
    );
    if (files && Array.isArray(files) && files.length > 0) {
      setInputs(files);
      setPlan(null);
    } else if (Array.isArray(files)) {
      setNotice(t('copilot.folderEmpty'));
    }
  };

  /**
   * Opens the multi-file dialog and appends the chosen files to the inputs.
   * @returns {Promise<void>} Resolves after the selection is merged.
   */
  const chooseFiles = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    const files = await withBridgeTimeout(
      bridgePromise(() => window.electronAPI.selectFiles()),
      FOLDER_TIMEOUT_MS,
      null,
    );
    if (files && Array.isArray(files) && files.length > 0) {
      setInputs((current) => [...new Set([...current, ...files])]);
      setPlan(null);
    } else if (Array.isArray(files) && files.length === 0) {
      setNotice(t('copilot.filesEmpty'));
    }
  };

  /**
   * Asks main to plan the goal against the chosen inputs. Any bridge failure or
   * malformed payload surfaces as an inline error; a valid plan replaces the
   * previous one.
   * @returns {Promise<void>} Resolves once the plan (or the error) is stored.
   */
  const buildPlan = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      setError(t('copilot.errorNoGoal'));
      return;
    }
    if (inputs.length === 0) {
      setError(t('copilot.errorNoInputs'));
      return;
    }
    setBusy(true);
    try {
      const result = await withBridgeTimeout(
        bridgePromise(() =>
          window.electronAPI.copilotPlan({
            goal: trimmedGoal,
            inputs,
            recursive: true,
            maxFiles: 50,
            ...(operation !== 'auto' ? { operation } : {}),
            ...(operation === 'search_transcript' && query.trim() ? { query: query.trim() } : {}),
            ...(operation === 'translate' && targetLanguage.trim() ? { targetLanguage: targetLanguage.trim() } : {}),
          }),
        ),
        PLAN_TIMEOUT_MS,
        null,
      );
      if (result && Array.isArray(result.actions) && Array.isArray(result.skips)) {
        setPlan(result);
      } else {
        setError(t('copilot.errorFallback'));
      }
    } catch (err) {
      setError(formatError(err).message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Enqueues every planned action into the Batch Queue through the existing
   * bridge, then navigates there when the whole plan was accepted.
   * @returns {Promise<void>} Resolves after the enqueues settle.
   */
  const addToQueue = async (): Promise<void> => {
    if (!plan) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    let added = 0;
    for (const action of plan.actions) {
      try {
        await bridgePromise(() =>
          window.electronAPI.queueAdd(action.input, action.output ?? '', action.options, TRANSCODER_TYPES[0], false),
        );
        added += 1;
      } catch {
        // The queue reports its own failures per job; count and continue.
      }
    }
    setBusy(false);
    if (added > 0) {
      useToastStore.getState().success(t('copilot.addedToQueue', { count: added }));
    }
    if (added === plan.actions.length && plan.actions.length > 0) {
      navigate('/batch');
    } else if (added > 0) {
      setError(t('copilot.partiallyAdded'));
    } else {
      setError(t('copilot.errorEnqueue'));
    }
  };

  /**
   * Opens the Settings page where AI providers are configured.
   * @returns {void} Nothing is returned.
   */
  const openSettings = (): void => {
    navigate('/settings');
  };

  return (
    <PageContainer title={t('copilot.title')} icon={pageIcons['/copilot']}>
      <Typography variant="body2" color="text.secondary" data-testid="copilot-subtitle">
        {t('copilot.subtitle')}
      </Typography>
      <Stack spacing={2} sx={{ mt: 2 }}>
        <TextField
          label={t('copilot.goalLabel')}
          placeholder={t('copilot.goalPlaceholder')}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          fullWidth
          data-testid="copilot-goal"
        />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap' }}
        >
          <Button
            variant="outlined"
            startIcon={<FontAwesomeIcon icon={faFolderOpen} />}
            onClick={chooseFolder}
            data-testid="copilot-choose-folder"
          >
            {t('copilot.chooseFolder')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FontAwesomeIcon icon={faFileImport} />}
            onClick={chooseFiles}
            data-testid="copilot-choose-files"
          >
            {t('copilot.chooseFiles')}
          </Button>
          <TextField
            select
            size="small"
            label={t('copilot.operationLabel')}
            value={operation}
            onChange={(event) => setOperation(event.target.value as CopilotOperationChoice)}
            sx={{ minWidth: 200 }}
            data-testid="copilot-operation"
          >
            {OPERATION_CHOICES.map((choice) => (
              <MenuItem key={choice} value={choice}>
                {t(`copilot.op.${choice}`)}
              </MenuItem>
            ))}
          </TextField>
          {operation === 'search_transcript' && (
            <TextField
              size="small"
              label={t('copilot.queryLabel')}
              placeholder={t('copilot.queryPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              sx={{ minWidth: 220 }}
              data-testid="copilot-query"
            />
          )}
          {operation === 'translate' && (
            <TextField
              size="small"
              label={t('copilot.targetLanguageLabel')}
              placeholder={t('copilot.targetLanguagePlaceholder')}
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
              sx={{ minWidth: 180 }}
              data-testid="copilot-target-language"
            />
          )}
          <Chip
            icon={<FontAwesomeIcon icon={faRobot} />}
            label={inputs.length > 0 ? t('copilot.selectedCount', { count: inputs.length }) : t('copilot.selectedNone')}
            variant="outlined"
            data-testid="copilot-selected-count"
          />
          <Button
            variant="contained"
            startIcon={<FontAwesomeIcon icon={faWandMagicSparkles} />}
            onClick={buildPlan}
            disabled={busy || goal.trim() === '' || inputs.length === 0}
            data-testid="copilot-plan"
          >
            {busy ? t('copilot.planning') : t('copilot.plan')}
          </Button>
        </Stack>

        <Box>
          <Button size="small" startIcon={<FontAwesomeIcon icon={faGear} />} onClick={openSettings} data-testid="copilot-ai-settings">
            {t('copilot.ai.configure')}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {t('copilot.ai.locationNote')}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" data-testid="copilot-error">
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="info" data-testid="copilot-notice">
            {notice}
          </Alert>
        )}

        {plan && (
          <Box data-testid="copilot-plan-summary">
            <Divider sx={{ my: 1 }} />
            {plan.operation && (
              <Chip size="small" label={t('copilot.routedAs', { operation: t(`copilot.op.${plan.operation}`) })} sx={{ mb: 1 }} />
            )}
            <Typography variant="h6" component="h2">
              {t('copilot.actionsTitle')}
            </Typography>
            {plan.actions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('copilot.noActions')}
              </Typography>
            ) : (
              <List dense>
                {plan.actions.map((action) => (
                  <ListItem key={action.id} divider data-testid={`copilot-action-${action.id}`}>
                    <ListItemIcon>
                      <FontAwesomeIcon icon={faRobot} />
                    </ListItemIcon>
                    <ListItemText
                      primary={action.input}
                      secondary={
                        <>
                          <Typography component="span" variant="body2" color="text.secondary">
                            {t('copilot.savings', { pct: Math.round(action.estimatedSavings * 100) })}
                          </Typography>
                          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                            {t('copilot.output', { output: action.output ?? '' })}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}

            {plan.results.length > 0 && (
              <>
                <Typography variant="h6" component="h2">
                  {t('copilot.resultsTitle')}
                </Typography>
                <List dense>
                  {plan.results.map((result, index) => (
                    <ListItem key={`${result.input}-${index}`} data-testid="copilot-result">
                      <ListItemText primary={result.input} secondary={result.summary ?? result.title ?? ''} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {plan.skips.length > 0 && (
              <>
                <Typography variant="h6" component="h2">
                  {t('copilot.skipsTitle')}
                </Typography>
                <List dense>
                  {plan.skips.map((skip) => (
                    <ListItem key={skip.input} data-testid="copilot-skip">
                      <ListItemText primary={skip.input} secondary={skip.reason} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {plan.rationale.length > 0 && (
              <>
                <Typography variant="h6" component="h2">
                  {t('copilot.rationaleTitle')}
                </Typography>
                <List dense>
                  {plan.rationale.map((line) => (
                    <ListItem key={line} disableGutters>
                      <ListItemIcon>
                        <FontAwesomeIcon icon={faWandMagicSparkles} />
                      </ListItemIcon>
                      <ListItemText primary={line} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            <Button
              variant="contained"
              startIcon={<FontAwesomeIcon icon={faListCheck} />}
              onClick={addToQueue}
              disabled={busy || plan.actions.length === 0}
              data-testid="copilot-add-to-queue"
            >
              {t('copilot.addToQueue', { count: plan.actions.length })}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {t('copilot.applyNote')}
            </Typography>
          </Box>
        )}
      </Stack>
    </PageContainer>
  );
}

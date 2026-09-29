/**
 * @fileoverview Video Filters section for the Convert page.
 *
 * Lets the user compose an ordered list of FFmpeg video-filter expressions from
 * the shared preset catalog (with per-parameter inputs) and/or a free-form
 * custom chain. Each entry is validated with the shared `validateVideoFilters`
 * helper before it can be added; entries can be reordered, removed, or cleared.
 *
 * The section is disabled in lossless copy mode: filters require re-encoding, so
 * the parent page gates it and shows a "turn off lossless copy" affordance.
 *
 * State is lifted to the caller (the conversion store) via `filterEntries` /
 * `onChange`; the component only holds transient preset/param/custom-input state.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Chip, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { faArrowDown, faArrowUp, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  FILTER_PRESETS,
  presetById,
  buildPresetFilter,
  buildFilterChain,
  normalizeFilterChain,
  validateVideoFilters,
  type VideoFilterParam,
} from '../../shared/video-filters';
import { FieldBox, FieldLabel } from '../styles/form.styles';

/** Shape of the transient parameter values for the pending preset. */
type PendingValues = Record<string, string>;

/**
 * Renders the input for a single filter parameter based on its type.
 * @private
 * @param {Object} props - Component props.
 * @param {VideoFilterParam} props.param - The parameter definition.
 * @param {PendingValues} props.values - Current pending values.
 * @param {(values: PendingValues) => void} props.onValues - Value change handler.
 * @param {boolean} props.disabled - Whether the field is disabled.
 */
function ParamInput({
  param,
  values,
  onValues,
  disabled,
}: {
  param: VideoFilterParam;
  values: PendingValues;
  onValues: (values: PendingValues) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const value = values[param.key] ?? String(param.default ?? '');
  const label = t(param.labelKey);
  if (param.type === 'select') {
    return (
      <TextField
        select
        fullWidth
        size="small"
        data-testid={`filter-param-${param.key}`}
        slotProps={{ htmlInput: { 'aria-label': label } }}
        value={value}
        disabled={disabled}
        onChange={(e) => onValues({ ...values, [param.key]: e.target.value })}
      >
        {(param.options ?? []).map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {t(option.labelKey)}
          </MenuItem>
        ))}
      </TextField>
    );
  }
  if (param.type === 'number') {
    return (
      <TextField
        fullWidth
        size="small"
        type="number"
        data-testid={`filter-param-${param.key}`}
        slotProps={{ htmlInput: { 'aria-label': label, min: param.min, max: param.max, step: param.step ?? 0.01 } }}
        value={value}
        disabled={disabled}
        onChange={(e) => onValues({ ...values, [param.key]: e.target.value })}
      />
    );
  }
  return (
    <TextField
      fullWidth
      size="small"
      data-testid={`filter-param-${param.key}`}
      slotProps={{ htmlInput: { 'aria-label': label } }}
      value={value}
      disabled={disabled}
      onChange={(e) => onValues({ ...values, [param.key]: e.target.value })}
    />
  );
}

/**
 * Renders the Video Filters section: preset picker with parameter inputs, a
 * free-form custom chain field, and an ordered entry list with reorder/remove.
 * @param {Object} props - Component props.
 * @param {string[]} props.filterEntries - Current ordered filter expressions.
 * @param {(entries: string[]) => void} props.onChange - Callback replacing the whole list.
 * @param {boolean} props.disabled - Disabled in lossless copy mode.
 */
export function VideoFiltersSection({
  filterEntries,
  onChange,
  disabled,
}: {
  filterEntries: string[];
  onChange: (entries: string[]) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [presetId, setPresetId] = useState('');
  const [pendingValues, setPendingValues] = useState<PendingValues>({});
  const [customText, setCustomText] = useState('');

  const pendingDef = presetId ? presetById(presetId) : undefined;

  const addPreset = () => {
    if (!pendingDef) return;
    const expr = buildPresetFilter(pendingDef, pendingValues);
    if (validateVideoFilters([expr]).length === 0) {
      onChange([...filterEntries, expr]);
    }
    setPresetId('');
    setPendingValues({});
  };

  const addCustom = () => {
    const valid = normalizeFilterChain(customText).filter((entry) => validateVideoFilters([entry]).length === 0);
    if (valid.length > 0) {
      onChange([...filterEntries, ...valid]);
    }
    setCustomText('');
  };

  const customEntries = normalizeFilterChain(customText);
  const customErrors = customEntries.flatMap((entry) => validateVideoFilters([entry]));

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= filterEntries.length) return;
    const next = [...filterEntries];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const previewChain = buildFilterChain({ videoFilters: filterEntries });

  return (
    <Box data-testid="video-filters-section">
      <FieldLabel>{t('convert.filtersHint')}</FieldLabel>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          select
          size="small"
          data-testid="filters-preset-select"
          disabled={disabled}
          slotProps={{
            select: { displayEmpty: true },
            htmlInput: { 'aria-label': t('convert.addPreset') },
          }}
          value={presetId}
          onChange={(e) => {
            setPresetId(e.target.value);
            setPendingValues({});
          }}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">{t('convert.addPreset')}</MenuItem>
          {FILTER_PRESETS.map((preset) => (
            <MenuItem key={preset.id} value={preset.id}>
              {t(preset.labelKey)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          data-testid="filters-custom-input"
          disabled={disabled}
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder={t('convert.customChainPlaceholder')}
          sx={{ minWidth: 320, flexGrow: 1 }}
        />
        <Button
          variant="contained"
          size="small"
          data-testid="filters-add-custom"
          disabled={disabled || customEntries.length === 0 || customErrors.length > 0}
          onClick={addCustom}
        >
          {t('convert.addCustom')}
        </Button>
      </Stack>

      <Typography variant="caption" color="error" data-testid="filters-custom-error">
        {customErrors.length > 0 ? t('convert.filtersInvalid', { error: customErrors[0] }) : ''}
      </Typography>

      {pendingDef && (
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Typography variant="subtitle2">{t(pendingDef.labelKey)}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap' }}>
            {pendingDef.params.map((param) => (
              <Box key={param.key} sx={{ minWidth: 140 }}>
                <FieldLabel>{t(param.labelKey)}</FieldLabel>
                <ParamInput param={param} values={pendingValues} onValues={setPendingValues} disabled={disabled} />
              </Box>
            ))}
          </Stack>
          <Box>
            <Button variant="outlined" size="small" data-testid="filters-add-preset" disabled={disabled} onClick={addPreset}>
              {t('convert.addFilter')}
            </Button>
          </Box>
        </Stack>
      )}

      <Box sx={{ mt: 1 }}>
        {filterEntries.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            {t('convert.noFilters')}
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {filterEntries.map((entry, index) => (
              <Stack key={`${index}-${entry}`} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip label={entry} size="small" data-testid={`filters-entry-${index}`} />
                <IconButton
                  size="small"
                  aria-label={t('convert.moveUp')}
                  data-testid={`filters-move-up-${index}`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <FontAwesomeIcon icon={faArrowUp} />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={t('convert.moveDown')}
                  data-testid={`filters-move-down-${index}`}
                  disabled={index === filterEntries.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <FontAwesomeIcon icon={faArrowDown} />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={t('convert.removeFilter')}
                  data-testid={`filters-remove-${index}`}
                  onClick={() => onChange(filterEntries.filter((_, i) => i !== index))}
                >
                  <FontAwesomeIcon icon={faTrashCan} />
                </IconButton>
              </Stack>
            ))}
            <Box>
              <Button size="small" data-testid="filters-clear-all" onClick={() => onChange([])}>
                {t('convert.clearAll')}
              </Button>
            </Box>
          </Stack>
        )}
      </Box>

      {previewChain && (
        <FieldBox>
          <Typography variant="caption" color="text.secondary" data-testid="filters-preview">
            {t('convert.chainPreview', { chain: previewChain })}
          </Typography>
        </FieldBox>
      )}
    </Box>
  );
}

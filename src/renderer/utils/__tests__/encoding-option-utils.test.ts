import { describe, it, expect } from 'vitest';
import { ENCODER_TYPES } from '../../../shared/hwaccel-settings';
import { PIXEL_FORMATS } from '../../../shared/media-options';
import { encoderTypeLabel, pixelFormatOptions, pixelGroupIcons } from '../encoding-option-utils';

describe('encoderTypeLabel', () => {
  it('maps every encoder type to a settings.* translation key', () => {
    for (const type of ENCODER_TYPES) {
      expect(encoderTypeLabel[type]).toMatch(/^settings\./);
    }
  });
});

describe('pixelFormatOptions', () => {
  it('mirrors PIXEL_FORMATS with a label equal to the value', () => {
    expect(pixelFormatOptions).toHaveLength(PIXEL_FORMATS.length);
    expect(pixelFormatOptions[0]).toEqual({ ...PIXEL_FORMATS[0], label: PIXEL_FORMATS[0].value });
  });
});

describe('pixelGroupIcons', () => {
  it('has an icon for every pixel-format group', () => {
    const groups = new Set(PIXEL_FORMATS.map((f) => f.group));
    for (const group of groups) {
      expect(pixelGroupIcons[group]).toBeDefined();
    }
  });
});

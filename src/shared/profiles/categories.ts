import type { ProfileCategory } from '../types';

export interface CategoryMeta {
  label: string;
  icon: string;
  order: number;
}

export const PROFILE_CATEGORIES: Record<ProfileCategory, CategoryMeta> = {
  'web-social': { label: 'Web & Social', icon: 'fa-globe', order: 0 },
  devices: { label: 'Devices', icon: 'fa-mobile-screen', order: 1 },
  video: { label: 'Video', icon: 'fa-film', order: 2 },
  professional: { label: 'Professional', icon: 'fa-clapperboard', order: 3 },
  streaming: { label: 'Streaming', icon: 'fa-satellite-dish', order: 4 },
  audio: { label: 'Audio', icon: 'fa-music', order: 5 },
  images: { label: 'Images', icon: 'fa-image', order: 6 },
  advanced: { label: 'Advanced', icon: 'fa-code', order: 7 },
};

export const CATEGORY_ORDER: ProfileCategory[] = (Object.entries(PROFILE_CATEGORIES) as [ProfileCategory, CategoryMeta][])
  .sort((a, b) => a[1].order - b[1].order)
  .map(([key]) => key);

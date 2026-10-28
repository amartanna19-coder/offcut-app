import { supabase } from './supabase';

export const CATEGORIES = ['Timber', 'Tiles', 'Plumbing', 'Electrical', 'Fixings', 'Paint', 'Other'];

export const CONDITIONS = ['New', 'Used, clean', 'Used, fair'];

export const AREAS = ['Ruislip', 'Ruislip Manor', 'Eastcote', 'West Ruislip', 'Northwood'];

export const ROLES = ['Tradesperson', 'DIY / self-builder', 'Community group'];

export const REPORT_REASONS = [
  'Unsafe or hazardous',
  'Not building material',
  'Misleading',
  'Spam or scam',
  'Other',
];

export const SORTS = [
  { key: 'newest', label: 'Newest', column: 'created_at', ascending: false },
  { key: 'price', label: 'Price: low to high', column: 'price', ascending: true },
];

export const EMOJI = {
  Timber: '🪵',
  Tiles: '🧱',
  Plumbing: '🚰',
  Electrical: '🔌',
  Fixings: '🔩',
  Paint: '🎨',
  Other: '📦',
};

export const PAGE_SIZE = 20;

export function priceLabel(price) {
  const n = Number(price) || 0;
  return n === 0 ? 'Free' : `£${n.toFixed(2)}`;
}

// Public URL for a listing photo, or null when the listing has none.
export function photoUrl(path) {
  if (!path) return null;
  return supabase.storage.from('listing-photos').getPublicUrl(path).data.publicUrl;
}

import { supabase } from './supabase';

export const CATEGORIES = ['Timber', 'Tiles', 'Plumbing', 'Electrical', 'Fixings', 'Paint', 'Other'];

export const CONDITIONS = ['New', 'Used, clean', 'Used, fair'];

export const AREAS = ['Ruislip', 'Ruislip Manor', 'Eastcote', 'West Ruislip', 'Northwood'];

export const ROLES = ['Tradesperson', 'DIY / self-builder', 'Community group'];

// Older building materials can contain asbestos, so the seller must say how old the item is.
export const MATERIAL_AGES = [
  { key: 'post_2000', label: 'Post-2000' },
  { key: 'pre_2000', label: 'Pre-2000' },
  { key: 'unknown', label: 'Not sure' },
];

export const HAZARD_WARNING =
  'Materials made before 2000 can contain asbestos, for example cement sheets, textured coatings, pipe lagging and some floor tiles. Don’t list anything you think could be asbestos. If you’re unsure, get it checked by a licensed surveyor first.';

export const HAZARD_CONFIRM = 'I’ve checked this isn’t asbestos or another hazardous material.';

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

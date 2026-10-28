// Suggests a category from a listing photo, using Google ML Kit on-device labelling.
//
// This only works in a native build (for example an EAS APK). In Expo Go the native
// module is missing, so suggestFromPhoto() returns null and the form works as normal.
import { CATEGORIES } from './constants';

// Keywords that ML Kit labels might contain, mapped to our categories.
const KEYWORDS = {
  Timber: ['wood', 'timber', 'plank', 'lumber', 'plywood', 'board', 'hardwood', 'wooden'],
  Tiles: ['tile', 'ceramic', 'porcelain', 'mosaic'],
  Plumbing: ['pipe', 'plumbing', 'copper', 'tap', 'faucet', 'valve', 'sink', 'toilet', 'radiator'],
  Electrical: ['wire', 'cable', 'electrical', 'socket', 'switch', 'circuit', 'electronic'],
  Fixings: ['screw', 'bolt', 'nail', 'nut', 'fastener', 'hinge', 'bracket'],
  Paint: ['paint', 'varnish', 'brush', 'roller', 'paint can'],
};

// Ignore weak guesses. ML Kit confidence is 0 to 1.
const MIN_CONFIDENCE = 0.6;

function loadLabeller() {
  try {
    // Required lazily so a missing native module can't crash the app at startup.
    return require('@react-native-ml-kit/image-labeling').default;
  } catch (e) {
    return null;
  }
}

// Returns { category, confidence } for the most likely category, or null if unsure.
export function pickCategory(labels) {
  const scores = {};
  for (const label of labels) {
    if (label.confidence < MIN_CONFIDENCE) continue;
    const text = label.text.toLowerCase();
    for (const [category, words] of Object.entries(KEYWORDS)) {
      if (words.some((w) => text.includes(w))) {
        scores[category] = Math.max(scores[category] || 0, label.confidence);
      }
    }
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || !CATEGORIES.includes(best[0])) return null;
  return { category: best[0], confidence: best[1] };
}

export async function suggestFromPhoto(uri) {
  const labeller = loadLabeller();
  if (!labeller) return null;
  try {
    // ML Kit expects a plain file path, not a file:// URI.
    const path = uri.replace(/^file:\/\//, '');
    const labels = await labeller.label(path);
    return pickCategory(labels);
  } catch (e) {
    return null;
  }
}

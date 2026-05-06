// MusicBridge — responsive layout helpers for phone vs iPad/desktop.
// Uses Dimensions/useWindowDimensions so layouts adapt as the user rotates
// or splits their iPad screen.

import { useWindowDimensions } from 'react-native';

const TABLET_BREAKPOINT = 768;

export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_BREAKPOINT;
}

/**
 * Returns class names for a centered content column.
 * - Phone: full width, just horizontal padding from caller.
 * - Tablet/desktop: capped width, centered horizontally.
 */
export function contentColumnClass(variant: 'narrow' | 'wide' = 'narrow'): string {
  if (variant === 'wide') {
    return 'mx-auto w-full max-w-3xl';
  }
  return 'mx-auto w-full max-w-md';
}

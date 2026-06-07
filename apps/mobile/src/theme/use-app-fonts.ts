import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';

/**
 * Loads the Inter weights the app uses. Block the splash screen on this
 * — the rendered tree depends on Inter being available so swapping in
 * the system font mid-flight would visibly shift layout.
 *
 * Weights chosen to match the locked design tokens:
 *   400 → body text
 *   500 → secondary labels / disabled states
 *   600 → button labels, semibold accents
 *   700 → headings, currency totals
 *   800 → display ("Tahawash" wordmark, hero titles)
 *
 * Returns true once all faces are loaded (or the load fails — we don't
 * keep the splash up forever; system fallback will render).
 */
export function useAppFonts(): { loaded: boolean; error: Error | null } {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  return { loaded, error };
}

import { Image, type ImageStyle } from 'expo-image';
import type { ReactNode } from 'react';
import type { StyleProp } from 'react-native';

interface RemoteImageProps {
  /** Remote image URL. When falsy (null/empty), `fallback` renders instead. */
  uri: string | null | undefined;
  /** Style applied to the rendered <Image>. Should match the wrapper's dimensions. */
  style?: StyleProp<ImageStyle>;
  /** Rendered in place of the image when `uri` is falsy (e.g. a TenantMark or droplet icon). */
  fallback: ReactNode;
}

/**
 * Thin wrapper over expo-image for real remote images. Renders the image
 * with a subtle blur-up transition when a URL is present, and the caller's
 * existing placeholder/TenantMark `fallback` when it isn't.
 *
 * Defaults (per design): contentFit="cover", transition={200}, and a neutral
 * blurhash placeholder so the image fades in gently over the wrapper bg.
 * It only swaps the inner rendering — sizing/radii live on the parent View.
 */
export function RemoteImage({ uri, style, fallback }: RemoteImageProps) {
  if (!uri) return <>{fallback}</>;
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      transition={200}
      placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
    />
  );
}

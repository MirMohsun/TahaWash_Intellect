import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../src/components/ui';
import { IllustrationFind } from '../src/components/intro/IllustrationFind';
import { IllustrationPay } from '../src/components/intro/IllustrationPay';
import { IllustrationScan } from '../src/components/intro/IllustrationScan';
import { markIntroSeen } from '../src/lib/intro-store';
import { colors } from '../src/theme/tokens';

/**
 * First-launch intro carousel (3 slides) shown ONCE before the user
 * lands on the phone-entry screen.
 *
 * Routing:
 *   - app/index.tsx gates this: unauth + !introSeen → /intro.
 *   - On reaching slide 3 + "Get started", OR pressing "Skip" anywhere:
 *     mark the SecureStore intro flag → router.replace('/(auth)/phone').
 *   - We use `router.replace` (not push) so hardware back doesn't
 *     return into the intro on Android.
 *
 * Layout:
 *   SafeAreaView (top + bottom)
 *   ├── Top bar with "Skip" link (top-right, hit-slop wide)
 *   ├── FlatList — horizontal pagingEnabled, one full-width item per slide
 *   │     each item: Illustration → Headline → Body, all vertically centred
 *   ├── 3 pagination dots (active = wide pill, inactive = small circle)
 *   └── Primary CTA (Next on 1/2, Get started on 3) — haptic on press
 *
 * UX patterns followed (BACKEND_PATTERNS-equivalent for mobile, see
 * feedback_mobile_ux_critical_patterns):
 *   - Safe area top + bottom respected via SafeAreaView
 *   - Touch targets ≥ 44pt on Skip + Next/Get-started + dots
 *   - Haptic feedback (light on slide change, medium on finish)
 *   - StatusBar style="dark" (light background)
 *   - All copy via i18n (auth.intro.*); long-text-safe (numberOfLines on headlines)
 *   - Accessibility labels on icon-style buttons
 *   - No keyboard concerns (zero inputs)
 *   - Smooth FlatList native paging — no Reanimated needed
 */
type SlideId = 'find' | 'scan' | 'pay';

interface SlideConfig {
  id: SlideId;
  Illustration: (props: { size?: number }) => JSX.Element;
}

const SLIDES: ReadonlyArray<SlideConfig> = [
  { id: 'find', Illustration: IllustrationFind },
  { id: 'scan', Illustration: IllustrationScan },
  { id: 'pay', Illustration: IllustrationPay },
];

export default function IntroScreen() {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<SlideConfig>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const finishIntro = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await markIntroSeen();
    router.replace('/(auth)/phone');
  }, []);

  const handleNext = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeIndex >= SLIDES.length - 1) {
      void finishIntro();
      return;
    }
    flatListRef.current?.scrollToIndex({
      index: activeIndex + 1,
      animated: true,
    });
  }, [activeIndex, finishIntro]);

  const handleSkip = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void finishIntro();
  }, [finishIntro]);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const next = Math.round(offsetX / windowWidth);
      if (next !== activeIndex && next >= 0 && next < SLIDES.length) {
        setActiveIndex(next);
        void Haptics.selectionAsync();
      }
    },
    [activeIndex, windowWidth],
  );

  // viewabilityConfig + onViewableItemsChanged: more reliable than
  // onMomentumScrollEnd when the user does a slow drag without a
  // momentum settle. We keep BOTH so the index is in sync either way.
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return;
      const idx = viewableItems[0]?.index;
      if (typeof idx === 'number' && idx !== activeIndex) {
        setActiveIndex(idx);
      }
    },
    [activeIndex],
  );

  // Memoised via useRef so the FlatList doesn't reset on every render
  // (Expo Router warns about this otherwise).
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged: handleViewableItemsChanged },
  ]);
  // Keep the latest handler in the pair without re-creating the array.
  viewabilityConfigCallbackPairs.current[0]!.onViewableItemsChanged = handleViewableItemsChanged;

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      {/* Header bar with Skip button (top-right) */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        <Pressable
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel={t('auth.intro.skipA11y')}
          hitSlop={12}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            paddingVertical: 8,
            paddingHorizontal: 12,
          })}
        >
          <Text
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 14,
              color: colors.ink[500],
              letterSpacing: -0.1,
            }}
          >
            {t('auth.intro.skip')}
          </Text>
        </Pressable>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        snapToInterval={windowWidth}
        snapToAlignment="start"
        onMomentumScrollEnd={handleMomentumEnd}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        getItemLayout={(_, index) => ({
          length: windowWidth,
          offset: windowWidth * index,
          index,
        })}
        renderItem={({ item }) => (
          <Slide id={item.id} Illustration={item.Illustration} width={windowWidth} t={t} />
        )}
        style={{ flex: 1 }}
      />

      {/* Pagination dots */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 12,
          gap: 6,
        }}
      >
        {SLIDES.map((slide, i) => (
          <Dot
            key={slide.id}
            active={i === activeIndex}
            accessibilityLabel={t('auth.intro.dotA11y', {
              current: i + 1,
              total: SLIDES.length,
            })}
          />
        ))}
      </View>

      {/* Primary CTA */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          // Native bottom safe area provided by SafeAreaView; this extra
          // padding gives breathing room above the home indicator on
          // larger phones.
          paddingBottom: Math.max(insets.bottom, 12),
        }}
      >
        <Button
          full
          size="lg"
          onPress={handleNext}
          accessibilityLabel={isLast ? t('auth.intro.getStarted') : t('auth.intro.next')}
          trailing={isLast ? <CheckGlyph /> : <ArrowRightGlyph />}
        >
          {isLast ? t('auth.intro.getStarted') : t('auth.intro.next')}
        </Button>
      </View>
    </SafeAreaView>
  );
}

interface SlideProps {
  id: SlideId;
  Illustration: (props: { size?: number }) => JSX.Element;
  width: number;
  t: (key: string) => string;
}

function Slide({ id, Illustration, width, t }: SlideProps) {
  // Reserve ~280pt for the illustration, but clamp to 70% of width on
  // smaller phones so it doesn't dominate the screen on iPhone SE-class
  // devices.
  const illustrationSize = Math.min(280, Math.round(width * 0.7));
  return (
    <View
      style={{
        width,
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'flex-start',
      }}
    >
      {/* Illustration block */}
      <View
        style={{
          flex: 1,
          maxHeight: 360,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Illustration size={illustrationSize} />
      </View>

      {/* Headline + body */}
      <View style={{ paddingHorizontal: 4, paddingBottom: 8, alignSelf: 'stretch' }}>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: 'Inter_800ExtraBold',
            fontSize: 28,
            lineHeight: 34,
            letterSpacing: -0.6,
            color: colors.ink[900],
            textAlign: 'center',
          }}
        >
          {t(`auth.intro.slides.${id}.title`)}
        </Text>
        <Text
          numberOfLines={4}
          style={{
            marginTop: 10,
            fontFamily: 'Inter_400Regular',
            fontSize: 15,
            lineHeight: 22,
            letterSpacing: -0.1,
            color: colors.ink[500],
            textAlign: 'center',
          }}
        >
          {t(`auth.intro.slides.${id}.body`)}
        </Text>
      </View>
    </View>
  );
}

/** Active dot: wide pill in brand color. Inactive: small ink-300 circle. */
function Dot({ active, accessibilityLabel }: { active: boolean; accessibilityLabel: string }) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={{
        width: active ? 24 : 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: active ? colors.brand[500] : colors.ink[300],
      }}
    />
  );
}

function ArrowRightGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="#FFFFFF"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function CheckGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M5 12.5l4 4 10-10"
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

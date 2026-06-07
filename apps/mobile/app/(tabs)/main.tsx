import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Logo } from '../../src/components/brand/logo';
import { Card, Icon, Pill, RemoteImage, Skeleton, TenantMark } from '../../src/components/ui';
import { useNotifications } from '../../src/hooks/use-notifications';
import { useCarwashes } from '../../src/hooks/use-carwashes';
import { useFavorites } from '../../src/hooks/use-favorites';
import { useActivePromos, useFeaturedTenants } from '../../src/hooks/use-main-feed';
import { useMe } from '../../src/hooks/use-me';
import { useMyTransactions } from '../../src/hooks/use-transactions';
import { haversineKm, useUserLocation } from '../../src/hooks/use-user-location';
import type { PublicCarwash } from '../../src/lib/carwashes-api';
import type { FavoriteItem } from '../../src/lib/customers-api';
import type { FeaturedTenantItem } from '../../src/lib/featured-api';
import type { PublicPromo } from '../../src/lib/promos-api';
import type { CustomerTx } from '../../src/lib/transactions-api';
import { colors, promoPalette, promoThemes, shadows } from '../../src/theme/tokens';

/**
 * A3.1 Main tab — 1:1 port of Design_Mobile_App/app/screens-b.jsx →
 * ScreenMain, wired into 5 data sources.
 *
 * Sections (top → bottom):
 *   1. Header: logo + "Tahawash" + notifications bell
 *   2. Greeting + tagline
 *   3. Promo card (Wolt-style inset, brand gradient)
 *   4. Favorites strip — /me/favorites
 *   5. Open-now-near-you mini-card — /public/carwashes w/ geo filter
 *   6. Featured strip — /public/featured
 *   7. Recently used — derived from /me/transactions (paid_credited only)
 *
 * Sections render empty (hide entirely) when there's nothing to show
 * — matches Wolt's "your home feed is whatever's relevant to you"
 * behavior; no apologetic "no favorites yet" copy.
 */
export default function MainTab() {
  const { t, i18n } = useTranslation();
  const meQuery = useMe();
  const userLoc = useUserLocation();
  const favoritesQuery = useFavorites();
  const promosQuery = useActivePromos();
  const featuredQuery = useFeaturedTenants();
  // The tab bar floats (overlays), so pad scroll content past it.
  const tabBarHeight = useBottomTabBarHeight();
  const notificationsQuery = useNotifications();
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const txQuery = useMyTransactions(1, 50);

  // Carwashes query powers the "open now near you" card. Only fetch
  // when we have user coords — without them the "near" claim is moot.
  const carwashesQuery = useCarwashes(
    userLoc.status === 'ready'
      ? {
          centerLat: userLoc.location.lat,
          centerLng: userLoc.location.lng,
          radiusKm: 50,
        }
      : {},
  );

  const nearestOpenCarwash = useMemo(() => {
    return pickNearestOpen(carwashesQuery.data?.items ?? [], userLoc);
  }, [carwashesQuery.data, userLoc]);

  const recentTenants = useMemo(() => {
    return deriveRecentTenants(txQuery.data?.items ?? []);
  }, [txQuery.data]);

  const isInitialLoading = meQuery.isLoading || (favoritesQuery.isLoading && !favoritesQuery.data);

  const isRefreshing =
    favoritesQuery.isRefetching ||
    promosQuery.isRefetching ||
    featuredQuery.isRefetching ||
    txQuery.isRefetching;

  const onRefresh = () => {
    void Promise.all([
      meQuery.refetch(),
      favoritesQuery.refetch(),
      promosQuery.refetch(),
      featuredQuery.refetch(),
      txQuery.refetch(),
      carwashesQuery.refetch(),
    ]);
  };

  const greetingName = meQuery.data?.name;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand[500]}
          />
        }
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 4,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Logo size={28} />
            <Text
              style={{
                fontFamily: 'Inter_800ExtraBold',
                fontSize: 17,
                letterSpacing: -0.4,
                color: colors.ink[900],
              }}
            >
              {t('common.appName')}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={t('main.notifications')}
            android_ripple={{ color: 'rgba(14,122,231,0.18)', borderless: true }}
            hitSlop={8}
            // Plain bell glyph; a red badge overlays it when there are unread
            // notifications.
            style={{
              width: 42,
              height: 42,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="bell" size={22} color={colors.ink[700]} />
            {unreadCount > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  paddingHorizontal: 3,
                  backgroundColor: colors.error,
                  borderWidth: 1.5,
                  borderColor: colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 9, color: colors.white }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Greeting */}
        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 }}>
          {isInitialLoading ? (
            <Skeleton width="60%" height={28} />
          ) : (
            <Text
              style={{
                fontFamily: 'Inter_800ExtraBold',
                fontSize: 28,
                letterSpacing: -0.8,
                color: colors.ink[900],
              }}
            >
              {greetingName
                ? t('main.greetingWithName', { name: firstName(greetingName) })
                : t('main.greetingPlain')}
            </Text>
          )}
          <Text
            style={{
              marginTop: 2,
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.ink[500],
            }}
          >
            {t('main.tagline')}
          </Text>
        </View>

        <PromoSection promos={promosQuery.data ?? []} lang={i18n.resolvedLanguage ?? 'az'} />

        <FavoritesSection
          favorites={favoritesQuery.data ?? []}
          loading={favoritesQuery.isLoading}
        />

        <OpenNowSection
          carwash={nearestOpenCarwash?.carwash}
          distanceKm={nearestOpenCarwash?.distanceKm}
          // Show the skeleton while EITHER the carwash list is fetching OR
          // the location is still resolving — so the section shows a
          // placeholder immediately instead of nothing, then fills in.
          loading={carwashesQuery.isLoading || userLoc.status === 'loading'}
        />

        <FeaturedSection items={featuredQuery.data ?? []} loading={featuredQuery.isLoading} />

        <RecentlyUsedSection items={recentTenants} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── sections ───────────────────────────────────────────────────

/** Localized default CTA label when a promo has an action but no custom text. */
const DEFAULT_CTA: Record<string, string> = { az: 'Aç', ru: 'Открыть', en: 'Open' };

/** Banner gradient: the admin-chosen theme if set, else a color by position. */
function promoGradient(theme: string | null, index: number): readonly string[] {
  if (theme && theme in promoThemes) {
    return promoThemes[theme as keyof typeof promoThemes];
  }
  // Modulo keeps the index in-bounds; assert past noUncheckedIndexedAccess.
  return promoPalette[index % promoPalette.length]!;
}

function PromoSection({ promos, lang }: { promos: PublicPromo[]; lang: string }) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const activeRef = useRef(0);
  const draggingRef = useRef(false);
  const [active, setActive] = useState(0);
  const count = promos.length;

  const setIdx = (i: number) => {
    activeRef.current = i;
    setActive(i);
  };

  // Gentle auto-advance every 5s when there's more than one banner. Pauses
  // while the user is dragging so it never fights a manual swipe.
  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => {
      if (draggingRef.current) return;
      const next = (activeRef.current + 1) % count;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIdx(next);
    }, 5000);
    return () => clearInterval(id);
  }, [count, width]);

  if (count === 0) return null;

  // Single promo: render plainly — no paging / dots / auto-advance.
  if (count === 1) {
    return (
      <View style={{ paddingTop: 16 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <PromoCard
            promo={promos[0]!}
            lang={lang}
            gradient={promoGradient(promos[0]!.theme, 0)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 16 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          draggingRef.current = true;
        }}
        onMomentumScrollEnd={(e) => {
          draggingRef.current = false;
          setIdx(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
      >
        {promos.map((p, i) => (
          <View key={p.id} style={{ width, paddingHorizontal: 16 }}>
            <PromoCard promo={p} lang={lang} gradient={promoGradient(p.theme, i)} />
          </View>
        ))}
      </ScrollView>

      {/* Page dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {promos.map((p, i) => (
          <View
            key={p.id}
            style={{
              width: i === active ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === active ? colors.brand[500] : colors.line,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function PromoCard({
  promo,
  lang,
  gradient,
}: {
  promo: PublicPromo;
  lang: string;
  gradient: readonly string[];
}) {
  const title = pickLang(promo.titleAz, promo.titleRu, promo.titleEn, lang);
  const body = pickLang(promo.bodyAz, promo.bodyRu, promo.bodyEn, lang);
  const cta = pickLang(promo.ctaTextAz, promo.ctaTextRu, promo.ctaTextEn, lang);
  // Show the CTA button whenever there's an action to take (a target set),
  // even if no custom button text was entered — using a localized default.
  // (Previously the button only appeared when CTA text was filled, so
  // setting just the tenant/URL target showed no button.)
  const hasAction = Boolean(promo.ctaTargetType && promo.ctaTargetValue);
  const ctaLabel = cta || (hasAction ? (DEFAULT_CTA[lang] ?? 'Open') : '');

  const handlePress = async () => {
    if (promo.ctaTargetType === 'tenant' && promo.ctaTargetValue) {
      router.push(`/tenant/${promo.ctaTargetValue}`);
      return;
    }
    if (promo.ctaTargetType === 'external_url' && promo.ctaTargetValue) {
      await Linking.openURL(promo.ctaTargetValue);
    }
  };

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      {/* Fixed height so every banner in the carousel is identical regardless
          of copy length (title/body are capped to 2 lines below). */}
      <View style={{ borderRadius: 18, overflow: 'hidden', height: 220 }}>
        {/* Full-bleed promo photo behind the gradient/text overlay when
            imageUrl is present. When empty, the gradient alone is the
            background. Dimmed slightly over a photo so text stays legible. */}
        {promo.imageUrl ? (
          <RemoteImage
            uri={promo.imageUrl}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            fallback={null}
          />
        ) : null}
        <LinearGradient
          colors={gradient as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[{ flex: 1, padding: 22 }, promo.imageUrl ? { opacity: 0.78 } : null]}
        >
          {/* Decorative circles */}
          <View
            style={{
              position: 'absolute',
              right: -40,
              top: -40,
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: -10,
              bottom: -30,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          />

          <Pill bg="rgba(255,255,255,0.18)" color={colors.white}>
            ★ NEW
          </Pill>
          <Text
            numberOfLines={2}
            style={{
              marginTop: 12,
              fontFamily: 'Inter_800ExtraBold',
              fontSize: 22,
              lineHeight: 26,
              letterSpacing: -0.5,
              color: colors.white,
              maxWidth: '72%',
            }}
          >
            {title}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              marginTop: 6,
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              lineHeight: 18,
              color: 'rgba(255,255,255,0.88)',
              maxWidth: '72%',
            }}
          >
            {body}
          </Text>
          {ctaLabel ? (
            <View
              style={{
                marginTop: 14,
                alignSelf: 'flex-start',
                height: 36,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: colors.white,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: 13,
                  color: colors.brand[700],
                }}
              >
                {ctaLabel}
              </Text>
              <Icon name="arrowRight" size={14} stroke={2.2} color={colors.brand[700]} />
            </View>
          ) : null}
        </LinearGradient>
      </View>
    </Pressable>
  );
}

function FavoritesSection({ favorites, loading }: { favorites: FavoriteItem[]; loading: boolean }) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <Section title={t('main.favoritesTitle')}>
        <HScrollContainer>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                {
                  width: 168,
                  padding: 14,
                  backgroundColor: colors.bgElev,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 16,
                },
                shadows.card,
              ]}
            >
              <Skeleton width={40} height={40} radius={20} />
              <View style={{ height: 12 }} />
              <Skeleton width="80%" height={14} />
              <View style={{ height: 4 }} />
              <Skeleton width="60%" height={12} />
            </View>
          ))}
        </HScrollContainer>
      </Section>
    );
  }
  if (favorites.length === 0) return null;
  return (
    <Section
      title={t('main.favoritesTitle')}
      action={t('main.seeAll')}
      onAction={() => router.push('/favorites')}
    >
      <HScrollContainer>
        {favorites.map((fav) => (
          <Pressable
            key={fav.tenantId}
            onPress={() => router.push(`/tenant/${fav.tenantId}`)}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <View
              style={[
                {
                  width: 168,
                  padding: 14,
                  backgroundColor: colors.bgElev,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 16,
                },
                shadows.card,
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <RemoteImage
                  uri={fav.tenant.logoUrl}
                  style={{ width: 40, height: 40, borderRadius: 40 * 0.28 }}
                  fallback={<TenantMark name={fav.tenant.brandName} size={40} />}
                />
                {/* Heart bumped 18 → 24 with a soft pink badge behind it so
                    it reads as a clear favorited-state, not a stray glyph. */}
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.accent[50],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="heartSolid" size={18} color={colors.accent[500]} />
                </View>
              </View>
              <Text
                style={{
                  marginTop: 12,
                  fontFamily: 'Inter_700Bold',
                  fontSize: 14,
                  letterSpacing: -0.2,
                  color: colors.ink[900],
                }}
                numberOfLines={1}
              >
                {fav.tenant.brandName}
              </Text>
            </View>
          </Pressable>
        ))}
      </HScrollContainer>
    </Section>
  );
}

function OpenNowSection({
  carwash,
  distanceKm,
  loading,
}: {
  carwash: PublicCarwash | undefined;
  distanceKm: number | undefined;
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <Section title={t('main.openNowTitle')}>
        <View style={{ paddingHorizontal: 16 }}>
          <Card padding={12}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Skeleton width={72} height={72} radius={12} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="40%" height={11} />
                <Skeleton width="80%" height={16} />
                <Skeleton width="60%" height={12} />
              </View>
              <Skeleton width={44} height={44} radius={22} />
            </View>
          </Card>
        </View>
      </Section>
    );
  }
  if (!carwash) return null;
  const primary = carwash.locations[0];
  const bayCount = primary?.bayCount ?? 0;

  return (
    <Section title={t('main.openNowTitle')}>
      <View style={{ paddingHorizontal: 16 }}>
        <Card onPress={() => router.push(`/tenant/${carwash.id}`)} padding={12}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                backgroundColor: colors.lineSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RemoteImage
                uri={carwash.logoUrl}
                style={{ width: 48, height: 48, borderRadius: 48 * 0.28 }}
                fallback={<TenantMark name={carwash.brandName} size={48} />}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: 11,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  color: colors.success,
                }}
              >
                {distanceKm !== undefined
                  ? `${t('wash.open')} · ${formatDistance(distanceKm)}`
                  : t('wash.open')}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: 'Inter_700Bold',
                  fontSize: 16,
                  letterSpacing: -0.3,
                  color: colors.ink[900],
                }}
                numberOfLines={1}
              >
                {carwash.brandName}
                {primary?.name ? ` · ${primary.name}` : ''}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 12,
                  color: colors.ink[500],
                }}
              >
                {t('main.bayCount', { count: bayCount })}
              </Text>
            </View>
            <View
              style={[
                {
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.brand[500],
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                shadows.fab,
              ]}
            >
              <Icon name="arrowRight" size={20} stroke={2.4} color={colors.white} />
            </View>
          </View>
        </Card>
      </View>
    </Section>
  );
}

function FeaturedSection({ items, loading }: { items: FeaturedTenantItem[]; loading: boolean }) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <Section title={t('main.featuredTitle')}>
        <HScrollContainer>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={[
                {
                  width: 232,
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: colors.bgElev,
                  borderWidth: 1,
                  borderColor: colors.line,
                },
                shadows.card,
              ]}
            >
              <Skeleton width="100%" height={132} radius={0} />
              <View style={{ padding: 12, gap: 6 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="80%" height={12} />
              </View>
            </View>
          ))}
        </HScrollContainer>
      </Section>
    );
  }
  if (items.length === 0) return null;

  return (
    <Section title={t('main.featuredTitle')} action={t('main.seeAll')}>
      <HScrollContainer>
        {items.map((item) => (
          <Pressable
            key={item.tenantId}
            onPress={() => router.push(`/tenant/${item.tenantId}`)}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <View
              style={[
                {
                  width: 232,
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: colors.bgElev,
                  borderWidth: 1,
                  borderColor: colors.line,
                },
                shadows.card,
              ]}
            >
              <View
                style={{
                  height: 132,
                  backgroundColor: colors.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <RemoteImage
                  uri={item.tenant.heroPhotoUrl}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  fallback={<Icon name="drop" size={36} color={colors.ink[300]} />}
                />
                <View style={{ position: 'absolute', top: 10, left: 10 }}>
                  <Pill bg="rgba(0,0,0,0.55)" color={colors.white}>
                    {t('wash.open')}
                  </Pill>
                </View>
              </View>
              <View style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <RemoteImage
                    uri={item.tenant.logoUrl}
                    style={{ width: 26, height: 26, borderRadius: 8 }}
                    fallback={<TenantMark name={item.tenant.brandName} size={26} radius={8} />}
                  />
                  <Text
                    style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.ink[900] }}
                    numberOfLines={1}
                  >
                    {item.tenant.brandName}
                  </Text>
                </View>
                <Text
                  style={{
                    marginTop: 6,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 12,
                    color: colors.ink[500],
                  }}
                  numberOfLines={1}
                >
                  {item.tenant.firstLocation?.name ?? '—'}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </HScrollContainer>
    </Section>
  );
}

interface RecentEntry {
  tenantId: string;
  tenantBrandName: string;
  tenantLogoUrl: string | null;
  lastUsedAt: string;
}

function RecentlyUsedSection({ items }: { items: RecentEntry[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <Section title={t('main.recentTitle')}>
      <HScrollContainer>
        {items.map((entry) => (
          <Pressable
            key={entry.tenantId}
            onPress={() => router.push(`/tenant/${entry.tenantId}`)}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <View
              style={{
                width: 152,
                padding: 12,
                backgroundColor: colors.bgElev,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 14,
              }}
            >
              <RemoteImage
                uri={entry.tenantLogoUrl}
                style={{ width: 32, height: 32, borderRadius: 32 * 0.28 }}
                fallback={<TenantMark name={entry.tenantBrandName} size={32} />}
              />
              <Text
                style={{
                  marginTop: 10,
                  fontFamily: 'Inter_700Bold',
                  fontSize: 13,
                  letterSpacing: -0.2,
                  color: colors.ink[900],
                }}
                numberOfLines={1}
              >
                {entry.tenantBrandName}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 11,
                  color: colors.ink[400],
                }}
              >
                {relativeTime(entry.lastUsedAt, t)}
              </Text>
            </View>
          </Pressable>
        ))}
      </HScrollContainer>
    </Section>
  );
}

// ─── shared section primitives ───────────────────────────────────

function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 17,
            letterSpacing: -0.3,
            color: colors.ink[900],
          }}
        >
          {title}
        </Text>
        {action && onAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 13,
                color: colors.brand[600],
              }}
            >
              {action}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function HScrollContainer({ children }: { children: React.ReactNode }) {
  // paddingVertical:10 reserves space so each card's shadow (shadows.card /
  // elevation 2 on Android) isn't clipped at the top/bottom by the
  // horizontal ScrollView's bounds. Without this, the cards looked as if
  // their head + foot were chopped off the parent bg.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}
    >
      {children}
    </ScrollView>
  );
}

// ─── helpers ─────────────────────────────────────────────────────

function pickLang(az: string | null, ru: string | null, en: string | null, lang: string): string {
  switch (lang) {
    case 'az':
      return az ?? en ?? ru ?? '';
    case 'ru':
      return ru ?? en ?? az ?? '';
    case 'en':
    default:
      return en ?? az ?? ru ?? '';
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function pickNearestOpen(
  carwashes: PublicCarwash[],
  userLoc: ReturnType<typeof useUserLocation>,
): { carwash: PublicCarwash; distanceKm: number } | undefined {
  if (userLoc.status !== 'ready') return undefined;
  let best: { carwash: PublicCarwash; distanceKm: number } | undefined;
  for (const cw of carwashes) {
    const loc = cw.locations[0];
    if (!loc) continue;
    const dist =
      loc.distanceKm ??
      haversineKm(userLoc.location.lat, userLoc.location.lng, loc.latitude, loc.longitude);
    if (!best || dist < best.distanceKm) best = { carwash: cw, distanceKm: dist };
  }
  return best;
}

function deriveRecentTenants(transactions: CustomerTx[]): RecentEntry[] {
  const seen = new Map<string, RecentEntry>();
  for (const tx of transactions) {
    if (tx.status !== 'paid_credited') continue;
    if (!seen.has(tx.tenant.id)) {
      seen.set(tx.tenant.id, {
        tenantId: tx.tenant.id,
        tenantBrandName: tx.tenant.brandName,
        tenantLogoUrl: tx.tenant.logoUrl,
        lastUsedAt: tx.createdAt,
      });
    }
  }
  return Array.from(seen.values()).slice(0, 6);
}

function relativeTime(
  iso: string,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now - then);
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days === 0) return t('main.timeToday');
  if (days === 1) return t('main.timeYesterday');
  if (days < 7) return t('main.timeDaysAgo', { count: days });
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return t('main.timeLastWeek');
  return t('main.timeWeeksAgo', { count: weeks });
}

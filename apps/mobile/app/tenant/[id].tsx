import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BackButton,
  Button,
  Card,
  Icon,
  type IconName,
  Pill,
  RemoteImage,
  TenantMark,
} from '../../src/components/ui';
import { useCarwashDetail } from '../../src/hooks/use-carwash-detail';
import { useIsFavorite, useToggleFavorite } from '../../src/hooks/use-favorites';
import { useUserLocation, haversineKm } from '../../src/hooks/use-user-location';
import { buildDisplayHours } from '../../src/lib/working-hours';
import { colors, shadows } from '../../src/theme/tokens';
import type { PublicService } from '../../src/lib/carwashes-api';

/**
 * A5.1 Tenant brand page.
 *
 * Faithful port from Design_Mobile_App/app/screens-b.jsx → ScreenTenant
 * with these adaptations:
 *   - Hero photo carousel: shows heroPhotoUrl if present; placeholder
 *     block otherwise. Real R2-hosted carousel lands in Phase 1.7 +
 *     2.6b (gallery viewer A5.2).
 *   - Working hours card: groups consecutive same-hour weekdays via
 *     buildDisplayHours() instead of hardcoded "Mon-Fri / Sat-Sun"
 *     ranges from the mock.
 *   - "Get directions" deeplinks to native maps via geo: + apple-maps URLs.
 *   - Favorite heart toggles via /me/favorites with optimistic update.
 */
export default function TenantBrandPage() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const tenantId = params.id ?? '';

  const detail = useCarwashDetail(tenantId);
  const isFav = useIsFavorite(tenantId);
  const toggleFav = useToggleFavorite(tenantId);
  const userLoc = useUserLocation();

  if (detail.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
          <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
            <Icon name="alert" size={32} color={colors.amber} />
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 16,
                color: colors.ink[900],
                textAlign: 'center',
              }}
            >
              {t('tenant.errorTitle')}
            </Text>
            <Text
              style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 13,
                color: colors.ink[500],
                textAlign: 'center',
                lineHeight: 19,
              }}
            >
              {t('tenant.errorBody')}
            </Text>
            <Pressable onPress={() => void detail.refetch()} hitSlop={8}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.brand[600] }}>
                {t('common.retry')}
              </Text>
            </Pressable>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const carwash = detail.data;
  const primary = carwash.locations[0];

  const distanceKm =
    primary && userLoc.status === 'ready'
      ? (primary.distanceKm ??
        haversineKm(
          userLoc.location.lat,
          userLoc.location.lng,
          primary.latitude,
          primary.longitude,
        ))
      : undefined;

  const isOpenNow = primary?.is24_7 || computeIsOpenNow(primary?.workingHours);
  const bayCount = primary?.bayCount ?? 0;

  const handleDirections = async () => {
    if (!primary) return;
    const lat = primary.latitude;
    const lng = primary.longitude;
    const label = encodeURIComponent(`${carwash.brandName} · ${primary.name}`);
    // Apple Maps URL works on iOS; geo: on Android. expo-linking handles both.
    const url =
      // iOS: `maps://` deep-links into Apple Maps even without the app installed.
      `https://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
    try {
      await Linking.openURL(url);
    } catch {
      // No-op — user can copy the address from the card.
    }
  };

  const handleFavoriteToggle = () => {
    toggleFav.mutate({ next: !isFav });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Hero carousel. Reads tenant.photoUrls (set in admin Branding →
            Photos). The first entry — or the one flagged isHero on the
            backend — is what shows on Main feed cards; here we render all
            of them as a horizontal pager. Falls back to a droplet
            placeholder when no photos are uploaded. */}
        <HeroCarousel photoUrls={carwash.photoUrls} />

        <View style={{ paddingHorizontal: 16, position: 'absolute', top: 8, left: 16, zIndex: 30 }}>
          <BackButton onPress={() => router.back()} />
        </View>

        {/* Header info */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          {/* Two-layer avatar so the shadow renders cleanly on Android.
              Outer View paints the white "ring" + elevation around the
              shape's bounding rect; inner View clips its children to a
              circle via overflow:'hidden' so the TenantMark fits the shape
              exactly with no leak at the corners. */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: -42 }}>
            <View
              style={[
                {
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: colors.bgElev,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                shadows.card,
              ]}
            >
              <View
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 34,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.bg,
                }}
              >
                {/* If the tenant uploaded a logo via admin Branding, show
                    it; otherwise fall back to the initials TenantMark. */}
                <RemoteImage
                  uri={carwash.logoUrl}
                  style={{ width: 68, height: 68 }}
                  fallback={<TenantMark name={carwash.brandName} size={68} radius={34} />}
                />
              </View>
            </View>
          </View>

          {/* Title row with inline favorite toggle */}
          <View
            style={{
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontFamily: 'Inter_800ExtraBold',
                fontSize: 26,
                letterSpacing: -0.6,
                color: colors.ink[900],
              }}
              numberOfLines={1}
            >
              {carwash.brandName}
            </Text>
            <Pressable
              onPress={handleFavoriteToggle}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('main.favoritesTitle')}
              android_ripple={{ color: 'rgba(255,110,84,0.18)', borderless: true }}
              // Plain heart — no circle bg / border / shadow per your
              // request. Color flips between accent (favorited) and ink
              // (not favorited) so the state still reads clearly.
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                name={isFav ? 'heartSolid' : 'heart'}
                size={26}
                color={isFav ? colors.accent[500] : colors.ink[700]}
              />
            </Pressable>
          </View>
          {primary?.name ? (
            <Text
              style={{
                marginTop: 2,
                fontFamily: 'Inter_400Regular',
                fontSize: 14,
                color: colors.ink[500],
              }}
            >
              {primary.name}
            </Text>
          ) : null}

          {/* Stats pill row */}
          <View
            style={{
              marginTop: 14,
              flexDirection: 'row',
              gap: 6,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Pill
              bg={isOpenNow ? colors.successSoft : colors.errorSoft}
              color={isOpenNow ? colors.success : colors.error}
            >
              ● {isOpenNow ? t('wash.open') : t('wash.closed')}
            </Pill>
            {distanceKm !== undefined ? (
              <Pill bg={colors.bgElev} color={colors.ink[700]}>
                {formatDistance(distanceKm)}
              </Pill>
            ) : null}
            <Pill bg={colors.bgElev} color={colors.ink[700]}>
              {t('wash.boxCount', { count: bayCount })}
            </Pill>
          </View>

          {/* Get directions */}
          <View style={{ marginTop: 18 }}>
            <Button variant="outline" full onPress={handleDirections}>
              <Icon name="directions" size={18} color={colors.ink[900]} />
              {'  '}
              {t('tenant.getDirections')}
            </Button>
          </View>
        </View>

        {/* Sections */}
        <View style={{ padding: 16, gap: 12 }}>
          {primary ? <AddressCard address={primary.address} onPress={handleDirections} /> : null}

          {primary ? (
            <HoursCard
              workingHours={primary.workingHours}
              is24_7={primary.is24_7}
              isOpenNow={isOpenNow}
            />
          ) : null}

          {carwash.services.length > 0 ? <ServicesCard services={carwash.services} /> : null}

          {carwash.descriptionAz || carwash.descriptionRu || carwash.descriptionEn ? (
            <AboutCard
              descriptionAz={carwash.descriptionAz}
              descriptionRu={carwash.descriptionRu}
              descriptionEn={carwash.descriptionEn}
            />
          ) : null}

          {carwash.contactPhone || primary?.contactPhone ? (
            <ContactCard phone={primary?.contactPhone ?? carwash.contactPhone ?? ''} />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── sub-components ───────────────────────────────────────────────

function AddressCard({ address, onPress }: { address: string; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Card onPress={onPress}>
      <SectionHeader title={t('tenant.address')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            backgroundColor: '#E8EDEF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="mapPin" size={26} color={colors.brand[600]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.ink[900] }}
            numberOfLines={2}
          >
            {address}
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontFamily: 'Inter_400Regular',
              fontSize: 12,
              color: colors.ink[500],
            }}
          >
            {t('tenant.openInMaps')}
          </Text>
        </View>
        <Icon name="chevron" size={18} color={colors.ink[300]} />
      </View>
    </Card>
  );
}

function HoursCard({
  workingHours,
  is24_7,
  isOpenNow,
}: {
  workingHours: unknown;
  is24_7: boolean;
  isOpenNow: boolean;
}) {
  const { t } = useTranslation();
  const rows = is24_7
    ? [{ label: t('tenant.everyDay'), value: t('tenant.always') }]
    : buildDisplayHours(workingHours, t('tenant.closed'));

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionHeader title={t('tenant.workingHours')} />
        <Pill
          bg={isOpenNow ? colors.successSoft : colors.errorSoft}
          color={isOpenNow ? colors.success : colors.error}
        >
          {isOpenNow ? t('wash.open') : t('wash.closed')}
        </Pill>
      </View>
      <View style={{ marginTop: 10, gap: 8 }}>
        {rows.length === 0 ? (
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              color: colors.ink[500],
            }}
          >
            {t('tenant.hoursUnknown')}
          </Text>
        ) : (
          rows.map((row, i) => (
            <View
              key={`${row.label}-${i}`}
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 14,
                  color: colors.ink[500],
                }}
              >
                {row.label}
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 14,
                  color: colors.ink[900],
                  fontVariant: ['tabular-nums'],
                }}
              >
                {row.value}
              </Text>
            </View>
          ))
        )}
      </View>
    </Card>
  );
}

function ServicesCard({ services }: { services: PublicService[] }) {
  const { t, i18n } = useTranslation();
  const sorted = [...services].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <Card>
      <SectionHeader title={t('tenant.services')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, marginTop: 12, paddingRight: 16 }}
      >
        {sorted.map((s) => (
          <View
            key={s.id}
            style={{
              width: 76,
              height: 76,
              borderRadius: 14,
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.line,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <Icon name={mapServiceIcon(s.iconKey)} size={22} color={colors.brand[600]} />
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 11,
                color: colors.ink[900],
                paddingHorizontal: 6,
              }}
            >
              {pickServiceLabel(s, i18n.resolvedLanguage)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </Card>
  );
}

function AboutCard({
  descriptionAz,
  descriptionRu,
  descriptionEn,
}: {
  descriptionAz: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
}) {
  const { t, i18n } = useTranslation();
  const description =
    pickDescription(i18n.resolvedLanguage, descriptionAz, descriptionRu, descriptionEn) ?? '';
  if (!description) return null;
  return (
    <Card>
      <SectionHeader title={t('tenant.about')} />
      <Text
        style={{
          marginTop: 8,
          fontFamily: 'Inter_400Regular',
          fontSize: 14,
          lineHeight: 21,
          color: colors.ink[700],
        }}
      >
        {description}
      </Text>
    </Card>
  );
}

function ContactCard({ phone }: { phone: string }) {
  const { t } = useTranslation();
  const handleCall = async () => {
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      /* user can copy the number */
    }
  };
  return (
    <Card onPress={handleCall}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 11,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: colors.ink[500],
            }}
          >
            {t('tenant.contact')}
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontFamily: 'Inter_600SemiBold',
              fontSize: 15,
              color: colors.ink[900],
              fontVariant: ['tabular-nums'],
            }}
          >
            {phone}
          </Text>
        </View>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.brand[50],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="phone" size={20} color={colors.brand[600]} />
        </View>
      </View>
    </Card>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontFamily: 'Inter_700Bold',
        fontSize: 11,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: colors.ink[500],
      }}
    >
      {title}
    </Text>
  );
}

// ─── helpers ───────────────────────────────────────────────────

function computeIsOpenNow(workingHours: unknown): boolean {
  if (!workingHours || typeof workingHours !== 'object') return false;
  const hours = workingHours as Record<string, { open: string; close: string } | null>;
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const day = dayKeys[new Date().getDay()]!;
  const slot = hours[day];
  if (!slot) return false;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = slot.open.split(':').map(Number);
  const [closeH, closeM] = slot.close.split(':').map(Number);
  const open = (openH ?? 0) * 60 + (openM ?? 0);
  const close = (closeH ?? 0) * 60 + (closeM ?? 0);
  return minutes >= open && minutes <= close;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function pickDescription(
  lang: string | undefined,
  az: string | null,
  ru: string | null,
  en: string | null,
): string | null {
  switch (lang) {
    case 'az':
      return az ?? en ?? ru;
    case 'ru':
      return ru ?? en ?? az;
    case 'en':
    default:
      return en ?? az ?? ru;
  }
}

function pickServiceLabel(s: PublicService, lang: string | undefined): string {
  switch (lang) {
    case 'az':
      return s.labelAz || s.labelEn || s.labelRu;
    case 'ru':
      return s.labelRu || s.labelEn || s.labelAz;
    case 'en':
    default:
      return s.labelEn || s.labelAz || s.labelRu;
  }
}

/**
 * Hero photo carousel — horizontally paged. Reads photoUrls from the
 * carwash payload (TenantPhoto rows on the backend). Falls back to the
 * old droplet placeholder block when no photos are uploaded yet, so a
 * tenant that hasn't populated their gallery still has a visually
 * complete page.
 *
 * Implementation notes:
 *   - pagingEnabled: each photo is exactly the carousel width so the
 *     swipe snaps to the next one.
 *   - useWindowDimensions ensures we re-render at the correct width on
 *     orientation change (tablet rotation; phones stay portrait but the
 *     hook is cheap).
 *   - Active dot tracked via onMomentumScrollEnd — calculated from
 *     contentOffset rather than a flat-list index so it never lies about
 *     position during a programmatic scroll.
 */
function HeroCarousel({ photoUrls }: { photoUrls: string[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const heroWidth = Math.max(0, screenWidth - 32); // matches paddingHorizontal:16
  const [active, setActive] = useState(0);

  // Guard against degenerate widths (split-screen at 0 width during first paint).
  const slides = useMemo(
    () => (heroWidth > 0 ? photoUrls.filter((u) => typeof u === 'string' && u.length > 0) : []),
    [photoUrls, heroWidth],
  );

  if (slides.length === 0) {
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <View
          style={{
            height: 220,
            borderRadius: 18,
            backgroundColor: colors.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="drop" size={56} color={colors.ink[300]} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <View style={{ height: 220, borderRadius: 18, overflow: 'hidden' }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / heroWidth);
            setActive(Math.max(0, Math.min(slides.length - 1, idx)));
          }}
        >
          {slides.map((url, i) => (
            <RemoteImage
              key={`${url}-${i}`}
              uri={url}
              style={{ width: heroWidth, height: 220 }}
              fallback={null}
            />
          ))}
        </ScrollView>
        {slides.length > 1 ? (
          <View
            style={{
              position: 'absolute',
              bottom: 12,
              left: 0,
              right: 0,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
            pointerEvents="none"
          >
            {slides.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === active ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === active ? colors.white : 'rgba(255,255,255,0.5)',
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function mapServiceIcon(iconKey: string): IconName {
  // Tenant admin picks one of these keys; we map to our Lucide set.
  switch (iconKey) {
    case 'foam':
    case 'drop':
      return 'drop';
    case 'pressure':
    case 'spray':
      return 'spray';
    case 'wax':
      return 'wax';
    case 'brush':
      return 'brush';
    case 'vacuum':
      return 'vacuum';
    default:
      return 'drop';
  }
}

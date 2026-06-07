import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Map } from '../../src/components/map/Map';
import { Card, FilterChip, FilterSheet, Icon, Pill, RemoteImage, Skeleton } from '../../src/components/ui';
import { useCarwashes } from '../../src/hooks/use-carwashes';
import { haversineKm, useUserLocation } from '../../src/hooks/use-user-location';
import type { PublicCarwash } from '../../src/lib/carwashes-api';
import { colors, shadows } from '../../src/theme/tokens';

/**
 * A4.1 Wash tab — map (top) + carwash list (bottom).
 *
 * Faithful 1:1 port from Design_Mobile_App/app/screens-b.jsx → ScreenWash
 * with two judgment calls:
 *   1. Real backend data instead of the CARWASHES mock array.
 *      /public/carwashes already exists from Phase 1.6. List items render
 *      the FIRST location's address (a tenant may have multiple — design
 *      assumes one per row).
 *   2. SVG placeholder "map" per the locked design. Real Mapbox lands in
 *      Phase 2.5b alongside clustering + bottom sheets + EAS dev build.
 *
 * Deferred to Phase 2.5b:
 *   - Search active state (search bar here is display-only)
 *   - Filters modal (filter button is display-only)
 *   - Pin tap bottom sheet (taps highlight the pin + active row)
 *   - Cluster auto-zoom
 *   - Location-denied richer "show all by city" UX
 */
export default function WashTab() {
  const { t } = useTranslation();
  const userLoc = useUserLocation();
  const tabBarHeight = useBottomTabBarHeight();
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(50);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilter = radiusKm !== 50 || openNowOnly;

  // Send center/radius to backend only once we know the user's location.
  // Backend filters AND attaches distanceKm per location when geo filter
  // is included. radiusKm is driven by the filter sheet.
  const queryParams = useMemo(() => {
    if (userLoc.status === 'ready') {
      return {
        centerLat: userLoc.location.lat,
        centerLng: userLoc.location.lng,
        radiusKm,
      };
    }
    return {};
  }, [userLoc, radiusKm]);

  const carwashesQuery = useCarwashes(queryParams);
  const items: PublicCarwash[] = carwashesQuery.data?.items ?? [];

  // Sort by distance when known. Backend already attaches distanceKm to
  // each location when geo filter is sent; otherwise we compute locally.
  const enriched = useMemo(() => {
    return items
      .map((c) => {
        const firstLocation = c.locations[0];
        let distanceKm: number | undefined = firstLocation?.distanceKm;
        if (distanceKm === undefined && userLoc.status === 'ready' && firstLocation) {
          distanceKm = haversineKm(
            userLoc.location.lat,
            userLoc.location.lng,
            firstLocation.latitude,
            firstLocation.longitude,
          );
        }
        return { carwash: c, primaryLocation: firstLocation, distanceKm };
      })
      .sort((a, b) => {
        if (a.distanceKm === undefined && b.distanceKm === undefined) return 0;
        if (a.distanceKm === undefined) return 1;
        if (b.distanceKm === undefined) return -1;
        return a.distanceKm - b.distanceKm;
      });
  }, [items, userLoc]);

  // Open-now filter is applied client-side (radius is server-side via the
  // query). Drives BOTH the list and the map pins so they stay in sync.
  const visible = useMemo(
    () => (openNowOnly ? enriched.filter((e) => computeIsOpenNow(e.primaryLocation)) : enriched),
    [enriched, openNowOnly],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Search bar (Pressable → search screen) + filter pill (Pressable
          → search screen filter pre-opened). Both use static-style
          Pressable + android_ripple so the bg renders reliably on Fabric.
          Single horizontal row, fixed 48dp height; search-icon left-anchored
          inside the bar on the same baseline as the placeholder text.
          Filter sits on the right and is a real button now — was a
          non-interactive <View>. */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => router.push('/wash-search')}
          accessibilityRole="button"
          accessibilityLabel={t('wash.searchPlaceholder')}
          android_ripple={{ color: 'rgba(14,122,231,0.10)' }}
          style={[
            {
              flex: 1,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.bgElev,
              borderWidth: 1,
              borderColor: colors.line,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              gap: 10,
              overflow: 'hidden',
            },
            shadows.card,
          ]}
        >
          <Icon name="search" size={18} color={colors.ink[500]} />
          <Text
            style={{
              flex: 1,
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: colors.ink[400],
            }}
            numberOfLines={1}
          >
            {t('wash.searchPlaceholder')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFilterOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('wash.filterButton')}
          android_ripple={{ color: 'rgba(14,122,231,0.18)', borderless: true }}
          hitSlop={6}
          // Plain icon; a brand dot overlays it when a filter is active.
          style={{
            width: 48,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name="filter"
            size={22}
            color={activeFilter ? colors.brand[600] : colors.ink[700]}
          />
          {activeFilter ? (
            <View
              style={{
                position: 'absolute',
                top: 9,
                right: 9,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.brand[500],
              }}
            />
          ) : null}
        </Pressable>
      </View>

      {/* Map — RealMap if Mapbox token is configured (EAS preview/prod
          builds with @rnmapbox/maps linked); PlaceholderMap otherwise
          (Expo Go local dev). Both accept the same MapPin shape. The
          first location of each carwash is used as the pin coord. */}
      <View
        style={{
          marginHorizontal: 16,
          marginTop: 2,
          marginBottom: 12,
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Map
          pins={visible.map(({ carwash: c, primaryLocation }) => ({
            id: c.id,
            brandName: c.brandName,
            latitude: primaryLocation?.latitude,
            longitude: primaryLocation?.longitude,
            themeColor: c.themeColor,
          }))}
          activePinId={activePinId}
          hasUserLocation={userLoc.status === 'ready'}
          onPinPress={setActivePinId}
        />
      </View>

      {/* List */}
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: tabBarHeight + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={carwashesQuery.isRefetching}
            onRefresh={() => void carwashesQuery.refetch()}
            tintColor={colors.brand[500]}
          />
        }
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 16,
              letterSpacing: -0.3,
              color: colors.ink[900],
            }}
          >
            {t('wash.listTitle')}
          </Text>
          {!carwashesQuery.isLoading && visible.length > 0 ? (
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
                color: colors.ink[500],
              }}
            >
              {t('wash.resultCount', { count: visible.length })}
            </Text>
          ) : null}
        </View>

        {carwashesQuery.isLoading ? (
          <LoadingState />
        ) : carwashesQuery.isError ? (
          <ErrorState onRetry={() => void carwashesQuery.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {visible.map(({ carwash, primaryLocation, distanceKm }) => (
              <CarwashRow
                key={carwash.id}
                carwash={carwash}
                location={primaryLocation}
                distanceKm={distanceKm}
                active={activePinId === carwash.id}
                onPress={() => {
                  setActivePinId(carwash.id);
                  router.push(`/tenant/${carwash.id}`);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FilterSheet
        visible={filterOpen}
        title={t('wash.filterTitle', { defaultValue: 'Filter' })}
        onClose={() => setFilterOpen(false)}
        onReset={
          activeFilter
            ? () => {
                setRadiusKm(50);
                setOpenNowOnly(false);
              }
            : undefined
        }
        resetLabel={t('common.reset', { defaultValue: 'Reset' })}
        doneLabel={t('common.done', { defaultValue: 'Done' })}
      >
        <Text
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
            color: colors.ink[500],
            marginBottom: 10,
          }}
        >
          {t('wash.filterDistance', { defaultValue: 'Within' })}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[1, 3, 5, 10, 25, 50].map((r) => (
            <FilterChip
              key={r}
              label={`${r} km`}
              active={radiusKm === r}
              onPress={() => setRadiusKm(r)}
            />
          ))}
        </View>

        <Pressable
          onPress={() => setOpenNowOnly((v) => !v)}
          style={{
            marginTop: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.ink[900] }}>
            {t('wash.filterOpenNow', { defaultValue: 'Open now only' })}
          </Text>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: 2,
              borderColor: openNowOnly ? colors.brand[500] : colors.line,
              backgroundColor: openNowOnly ? colors.brand[500] : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {openNowOnly ? <Icon name="check" size={16} color={colors.white} /> : null}
          </View>
        </Pressable>
      </FilterSheet>
    </SafeAreaView>
  );
}

interface CarwashRowProps {
  carwash: PublicCarwash;
  location: PublicCarwash['locations'][number] | undefined;
  distanceKm: number | undefined;
  active: boolean;
  onPress: () => void;
}

function CarwashRow({ carwash, location, distanceKm, active, onPress }: CarwashRowProps) {
  const { t } = useTranslation();
  const isOpen = computeIsOpenNow(location);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <Card
        padding={12}
        style={active ? { borderColor: colors.brand[500], borderWidth: 1.5 } : undefined}
      >
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* Carwash photo — hero photo, falling back to the logo, then to
              the droplet placeholder when neither is uploaded. */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 12,
              flexShrink: 0,
              overflow: 'hidden',
              backgroundColor: colors.lineSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RemoteImage
              uri={carwash.heroPhotoUrl ?? carwash.logoUrl}
              style={{ width: 80, height: 80 }}
              fallback={<Icon name="drop" size={28} color={colors.ink[300]} />}
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: 15,
                  letterSpacing: -0.3,
                  color: colors.ink[900],
                  flexShrink: 1,
                }}
              >
                {carwash.brandName}
              </Text>
              {location?.name ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 12,
                    color: colors.ink[500],
                  }}
                >
                  · {location.name}
                </Text>
              ) : null}
            </View>

            <Text
              numberOfLines={1}
              style={{
                marginTop: 2,
                fontFamily: 'Inter_400Regular',
                fontSize: 12,
                color: colors.ink[500],
              }}
            >
              {location?.address ?? '—'}
            </Text>

            <View
              style={{
                marginTop: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <Pill
                bg={isOpen ? colors.successSoft : colors.errorSoft}
                color={isOpen ? colors.success : colors.error}
              >
                {isOpen ? t('wash.open') : t('wash.closed')}
              </Pill>
              {distanceKm !== undefined ? (
                <Text
                  style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: 12,
                    color: colors.ink[500],
                  }}
                >
                  {formatDistance(distanceKm)}
                </Text>
              ) : null}
              {location?.bayCount !== undefined ? (
                <>
                  <Text
                    style={{
                      fontFamily: 'Inter_400Regular',
                      fontSize: 12,
                      color: colors.ink[400],
                    }}
                  >
                    ·
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="drop" size={13} stroke={2} color={colors.ink[500]} />
                    <Text
                      style={{
                        fontFamily: 'Inter_500Medium',
                        fontSize: 12,
                        color: colors.ink[500],
                      }}
                    >
                      {t('wash.boxCount', { count: location.bayCount })}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function LoadingState() {
  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <Card key={i} padding={12}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton width={80} height={80} radius={12} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="90%" height={12} />
              <Skeleton width="40%" height={12} />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ paddingHorizontal: 16 }}>
      <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
        <Icon name="alert" size={32} color={colors.amber} />
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 16,
            color: colors.ink[900],
            textAlign: 'center',
          }}
        >
          {t('wash.errorTitle')}
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
          {t('wash.errorBody')}
        </Text>
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.brand[600] }}>
            {t('common.retry')}
          </Text>
        </Pressable>
      </Card>
    </View>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <View style={{ paddingHorizontal: 16 }}>
      <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.brand[50],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="map" size={28} color={colors.brand[600]} />
        </View>
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 16,
            color: colors.ink[900],
            textAlign: 'center',
          }}
        >
          {t('wash.emptyTitle')}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            color: colors.ink[500],
            textAlign: 'center',
            lineHeight: 19,
            maxWidth: 280,
          }}
        >
          {t('wash.emptyBody')}
        </Text>
      </Card>
    </View>
  );
}

// ─── helpers ───────────────────────────────────────────────────

/**
 * Best-effort "is this location open right now" from the workingHours JSON.
 * Schema: { mon: { open: "HH:mm", close: "HH:mm" } | null, tue: ..., ... }
 * is24_7 short-circuits to true. Missing hours → false (better to say
 * "Closed" than mark a tenant open when we don't actually know).
 */
function computeIsOpenNow(location: PublicCarwash['locations'][number] | undefined): boolean {
  if (!location) return false;
  if (location.is24_7) return true;
  const hours = location.workingHours as
    | Record<string, { open: string; close: string } | null>
    | null
    | undefined;
  if (!hours) return false;
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

/** "1.4 km" / "850 m" — comma decimal per spec. */
function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1).replace('.', ',')} km`;
}

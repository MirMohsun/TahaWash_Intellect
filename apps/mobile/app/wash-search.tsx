import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Icon, Pill, Skeleton, TenantMark } from '../src/components/ui';
import { useCarwashes } from '../src/hooks/use-carwashes';
import { useUserLocation, haversineKm } from '../src/hooks/use-user-location';
import type { PublicCarwash } from '../src/lib/carwashes-api';
import { colors, shadows } from '../src/theme/tokens';

/**
 * A4.5 Wash search — active state.
 *
 * Deferred from Phase 2.5 (the search bar in Wash was display-only).
 * Tapping it opens this full-screen route; typing filters the
 * loaded carwashes by tenant brand name OR first-location address.
 *
 * For Phase 2.14 we deliberately keep this CLIENT-SIDE: the user
 * already has the carwashes list loaded via the Wash tab, so we
 * filter in JS instead of round-tripping a search endpoint. When
 * we have >1000 tenants this swaps to a backend search endpoint
 * with a debounced query — that's Phase 4 (super-admin promo /
 * featured) territory.
 */
export default function WashSearch() {
  const { t } = useTranslation();
  const userLoc = useUserLocation();
  const [query, setQuery] = useState('');

  const carwashesQuery = useCarwashes(
    userLoc.status === 'ready'
      ? {
          centerLat: userLoc.location.lat,
          centerLng: userLoc.location.lng,
          radiusKm: 50,
        }
      : {},
  );

  const items: PublicCarwash[] = carwashesQuery.data?.items ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((cw) => {
      if (cw.brandName.toLowerCase().includes(q)) return true;
      const loc = cw.locations[0];
      if (loc && loc.address.toLowerCase().includes(q)) return true;
      if (loc && loc.name.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [items, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Search bar w/ inline back */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 12,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel={t('common.back')}
            accessibilityRole="button"
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.bgElev,
                borderWidth: 1,
                borderColor: colors.line,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              },
              shadows.card,
            ]}
          >
            <Icon name="back" size={20} color={colors.ink[900]} stroke={2} />
          </Pressable>
          <View
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
                paddingHorizontal: 14,
                gap: 10,
              },
              shadows.card,
            ]}
          >
            <Icon name="search" size={18} color={colors.ink[500]} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('wash.searchPlaceholder')}
              placeholderTextColor={colors.ink[400]}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              style={{
                flex: 1,
                height: '100%',
                fontFamily: 'Inter_500Medium',
                fontSize: 15,
                color: colors.ink[900],
              }}
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityLabel={t('common.cancel')}
              >
                <Icon name="close" size={18} color={colors.ink[400]} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* States: idle (empty query), loading, results, no-results */}
          {query.trim().length === 0 ? (
            <IdleState />
          ) : carwashesQuery.isLoading ? (
            <SearchLoading />
          ) : filtered.length === 0 ? (
            <NoResults query={query} />
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {filtered.map((cw) => (
                <SearchRow
                  key={cw.id}
                  carwash={cw}
                  userLat={userLoc.status === 'ready' ? userLoc.location.lat : undefined}
                  userLng={userLoc.status === 'ready' ? userLoc.location.lng : undefined}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SearchRow({
  carwash,
  userLat,
  userLng,
}: {
  carwash: PublicCarwash;
  userLat: number | undefined;
  userLng: number | undefined;
}) {
  const primary = carwash.locations[0];
  let distance: string | null = null;
  if (primary && userLat !== undefined && userLng !== undefined) {
    const km =
      primary.distanceKm ?? haversineKm(userLat, userLng, primary.latitude, primary.longitude);
    distance = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
  }
  return (
    <Card onPress={() => router.push(`/tenant/${carwash.id}`)} padding={12}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TenantMark name={carwash.brandName} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 15,
              letterSpacing: -0.2,
              color: colors.ink[900],
            }}
            numberOfLines={1}
          >
            {carwash.brandName}
            {primary?.name ? (
              <Text style={{ fontFamily: 'Inter_400Regular', color: colors.ink[500] }}>
                {' · '}
                {primary.name}
              </Text>
            ) : null}
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontFamily: 'Inter_400Regular',
              fontSize: 12,
              color: colors.ink[500],
            }}
            numberOfLines={1}
          >
            {primary?.address ?? '—'}
          </Text>
        </View>
        {distance ? (
          <Pill bg={colors.lineSoft} color={colors.ink[700]}>
            {distance}
          </Pill>
        ) : null}
      </View>
    </Card>
  );
}

function IdleState() {
  const { t } = useTranslation();
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
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
          <Icon name="search" size={28} color={colors.brand[600]} />
        </View>
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 16,
            color: colors.ink[900],
            textAlign: 'center',
          }}
        >
          {t('washSearch.idleTitle')}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            color: colors.ink[500],
            textAlign: 'center',
            maxWidth: 280,
            lineHeight: 19,
          }}
        >
          {t('washSearch.idleBody')}
        </Text>
      </Card>
    </View>
  );
}

function SearchLoading() {
  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <Card key={i} padding={12}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton width={44} height={44} radius={22} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="80%" height={12} />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

function NoResults({ query }: { query: string }) {
  const { t } = useTranslation();
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.lineSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="search" size={28} color={colors.ink[400]} />
        </View>
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 16,
            color: colors.ink[900],
            textAlign: 'center',
          }}
        >
          {t('washSearch.noResults', { query })}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            color: colors.ink[500],
            textAlign: 'center',
            maxWidth: 280,
            lineHeight: 19,
          }}
        >
          {t('washSearch.noResultsBody')}
        </Text>
      </Card>
    </View>
  );
}

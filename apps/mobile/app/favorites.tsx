import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, Card, Icon, RemoteImage, Skeleton } from '../src/components/ui';
import { useFavorites, useToggleFavorite } from '../src/hooks/use-favorites';
import type { FavoriteItem } from '../src/lib/customers-api';
import { colors } from '../src/theme/tokens';

/**
 * Full favorites list — reached from the Main-tab favorites strip "See all".
 * Lists every favorited carwash; tapping a row opens the tenant page, and
 * the heart on each row unfavorites it (optimistic, via useToggleFavorite).
 */
export default function FavoritesScreen() {
  const { t } = useTranslation();
  const query = useFavorites();
  const items: FavoriteItem[] = query.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <BackButton onPress={() => router.back()} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand[500]}
          />
        }
      >
        <Text
          style={{
            paddingHorizontal: 4,
            fontFamily: 'Inter_800ExtraBold',
            fontSize: 28,
            letterSpacing: -0.8,
            color: colors.ink[900],
          }}
        >
          {t('main.favoritesTitle')}
        </Text>

        <View style={{ height: 16 }} />

        {query.isLoading ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <Card key={i} padding={12}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Skeleton width={56} height={56} radius={14} />
                  <Skeleton width="55%" height={15} />
                </View>
              </Card>
            ))}
          </View>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((fav) => (
              <FavoriteRow key={fav.tenantId} fav={fav} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FavoriteRow({ fav }: { fav: FavoriteItem }) {
  const toggle = useToggleFavorite(fav.tenantId);
  return (
    <Pressable
      onPress={() => router.push(`/tenant/${fav.tenantId}`)}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <Card padding={12}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              overflow: 'hidden',
              backgroundColor: colors.lineSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RemoteImage
              uri={fav.tenant.heroPhotoUrl ?? fav.tenant.logoUrl}
              style={{ width: 56, height: 56 }}
              fallback={<Icon name="drop" size={24} color={colors.ink[300]} />}
            />
          </View>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: 'Inter_700Bold',
              fontSize: 16,
              letterSpacing: -0.3,
              color: colors.ink[900],
            }}
          >
            {fav.tenant.brandName}
          </Text>
          <Pressable
            onPress={() => toggle.mutate({ next: false })}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={fav.tenant.brandName}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="heartSolid" size={22} color={colors.accent[500]} />
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.accent[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="heart" size={26} color={colors.accent[500]} />
      </View>
      <Text
        style={{
          fontFamily: 'Inter_700Bold',
          fontSize: 16,
          color: colors.ink[900],
          textAlign: 'center',
        }}
      >
        {t('favorites.emptyTitle', { defaultValue: 'No favorites yet' })}
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 13,
          color: colors.ink[500],
          textAlign: 'center',
          lineHeight: 19,
          maxWidth: 260,
        }}
      >
        {t('favorites.emptyBody', {
          defaultValue: 'Tap the heart on any carwash to save it here for quick access.',
        })}
      </Text>
    </Card>
  );
}

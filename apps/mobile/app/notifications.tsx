import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, Card, Icon, Skeleton } from '../src/components/ui';
import { useMarkNotificationsRead, useNotifications } from '../src/hooks/use-notifications';
import type { AppNotification } from '../src/lib/notifications-api';
import { colors } from '../src/theme/tokens';

/**
 * In-app notifications inbox. Reached from the Main-tab bell. Lists the
 * broadcasts the super-admin sent to this customer (view-only for now —
 * no deep links). Opening the screen marks everything read, which clears
 * the bell badge.
 */
export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'az';
  const query = useNotifications();
  const markRead = useMarkNotificationsRead();
  const items: AppNotification[] = query.data?.items ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;

  // Mark all read once when the screen has unread items (clears the badge).
  useEffect(() => {
    if (unreadCount > 0 && !markRead.isPending) {
      markRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

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
          {t('notifications.title', { defaultValue: 'Notifications' })}
        </Text>

        <View style={{ height: 16 }} />

        {query.isLoading ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <View style={{ gap: 8 }}>
                  <Skeleton width="50%" height={14} />
                  <Skeleton width="92%" height={12} />
                </View>
              </Card>
            ))}
          </View>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((n) => (
              <NotificationRow key={n.id} n={n} lang={lang} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationRow({ n, lang }: { n: AppNotification; lang: string }) {
  const title = pickLang(n.titleAz, n.titleRu, n.titleEn, lang);
  const body = pickLang(n.bodyAz, n.bodyRu, n.bodyEn, lang);
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12 }}>
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
          <Icon name="bell" size={20} color={colors.brand[600]} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <Text
              style={{
                flex: 1,
                fontFamily: 'Inter_700Bold',
                fontSize: 15,
                color: colors.ink[900],
              }}
              numberOfLines={2}
            >
              {title}
            </Text>
            {!n.read ? (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  marginTop: 5,
                  backgroundColor: colors.brand[500],
                }}
              />
            ) : null}
          </View>
          <Text
            style={{
              marginTop: 3,
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              lineHeight: 19,
              color: colors.ink[700],
            }}
          >
            {body}
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontFamily: 'Inter_500Medium',
              fontSize: 11,
              color: colors.ink[400],
            }}
          >
            {timeAgo(n.createdAt)}
          </Text>
        </View>
      </View>
    </Card>
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
          backgroundColor: colors.brand[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="bell" size={28} color={colors.brand[600]} />
      </View>
      <Text
        style={{
          fontFamily: 'Inter_700Bold',
          fontSize: 16,
          color: colors.ink[900],
          textAlign: 'center',
        }}
      >
        {t('notifications.emptyTitle', { defaultValue: 'No notifications yet' })}
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 13,
          lineHeight: 19,
          color: colors.ink[500],
          textAlign: 'center',
          maxWidth: 280,
        }}
      >
        {t('notifications.emptyBody', {
          defaultValue: 'Updates and offers from Tahawash will appear here.',
        })}
      </Text>
    </Card>
  );
}

function pickLang(az: string, ru: string, en: string, lang: string): string {
  switch (lang) {
    case 'ru':
      return ru || en || az;
    case 'en':
      return en || az || ru;
    default:
      return az || en || ru;
  }
}

/** Compact relative time: now / 5m / 3h / 2d, else a date. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return new Date(iso).toLocaleDateString();
}

import { formatAzPhone } from '@tahawash/shared-utils';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Button, Card, Icon, type IconName, Skeleton } from '../../src/components/ui';
import { useFavorites } from '../../src/hooks/use-favorites';
import { useMe } from '../../src/hooks/use-me';
import { usePaymentMethods } from '../../src/hooks/use-me';
import { useMyTransactions } from '../../src/hooks/use-transactions';
import { formatTetri, parseAznToTetri } from '../../src/lib/charge-amount';
import type { PaymentMethod } from '../../src/lib/customers-api';
import type { CustomerTx } from '../../src/lib/transactions-api';
import { useAuthStore } from '../../src/store/auth';
import { colors, gradients } from '../../src/theme/tokens';

/**
 * A9.1 Profile tab — 1:1 port of Design_Mobile_App/app/screens-c.jsx →
 * ScreenProfile, hooked into real backend data.
 *
 * Layout:
 *   - Profile header: 72×72 avatar gradient + name + phone + Edit chip
 *   - Stats strip: Washes / Spent / Saved (3 cells, vertical dividers)
 *   - Settings group 1: Payment methods · Language · Notifications
 *   - Settings group 2: WhatsApp support · Terms · Privacy
 *   - Settings group 3: Delete account (danger)
 *   - App version footer
 *
 * Each settings row navigates to its dedicated sub-screen
 * (app/profile/*) — none of those screens hide the tab bar (they
 * stack above it), so back gestures return here naturally.
 */
export default function ProfileTab() {
  const { t, i18n } = useTranslation();
  const meQuery = useMe();
  const txQuery = useMyTransactions(1, 100);
  const favQuery = useFavorites();
  const paymentsQuery = usePaymentMethods();
  const tabBarHeight = useBottomTabBarHeight();

  // The Notifications row must reflect the REAL OS permission, not the
  // server pushToken (which stays null on simulators / when registration
  // fails, even though permission is granted). Re-read on focus so it
  // updates after the user returns from the OS Settings screen.
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Notifications.getPermissionsAsync()
        .then((p) => {
          if (active) setNotifGranted(p.status === 'granted');
        })
        .catch(() => {
          /* leave previous state on failure */
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const customer = meQuery.data;
  const stats = useMemo(() => {
    const total = txQuery.data?.total ?? 0;
    const items: CustomerTx[] = txQuery.data?.items ?? [];
    const spentTetri = items
      .filter((tx) => tx.status === 'paid_credited')
      .reduce((acc, tx) => acc + parseAznToTetri(tx.amountAzn), 0);
    const saved = favQuery.data?.length ?? 0;
    return { washes: total, spentTetri, saved };
  }, [txQuery.data, favQuery.data]);

  const paymentMethods: PaymentMethod[] = paymentsQuery.data ?? [];
  const defaultCard = paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0];
  const paymentDetail = defaultCard
    ? `${capitalize(defaultCard.brand)} •• ${defaultCard.lastFour}`
    : t('profile.noCard');

  const handleWhatsApp = async () => {
    const num = (process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');
    const url = num ? `https://wa.me/${num}` : 'https://wa.me/';
    try {
      await Linking.openURL(url);
    } catch {
      /* no-op */
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <Avatar name={customer?.name} phone={customer?.phone} />
          <View style={{ flex: 1, minWidth: 0 }}>
            {meQuery.isLoading && !customer ? (
              <>
                <Skeleton width="70%" height={20} />
                <View style={{ height: 6 }} />
                <Skeleton width="50%" height={14} />
              </>
            ) : (
              <>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: 'Inter_800ExtraBold',
                    fontSize: 20,
                    letterSpacing: -0.4,
                    color: colors.ink[900],
                  }}
                >
                  {customer?.name || t('profile.unnamed')}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 14,
                    color: colors.ink[500],
                  }}
                >
                  {customer?.phone ? formatAzPhone(customer.phone) : '—'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Stats strip */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Card padding={0} style={{ flexDirection: 'row', overflow: 'hidden' }}>
            <Stat label={t('profile.washes')} value={`${stats.washes}`} />
            <View style={{ width: 1, backgroundColor: colors.line }} />
            <Stat label={t('profile.spent')} value={formatTetri(stats.spentTetri)} />
            <View style={{ width: 1, backgroundColor: colors.line }} />
            <Stat label={t('profile.saved')} value={`${stats.saved}`} />
          </Card>
        </View>

        {/* Settings group 1 */}
        <SettingsGroup>
          <SettingsRow
            icon="user"
            title={t('profile.editName')}
            detail={customer?.name ?? t('profile.unnamed')}
            onPress={() => router.push('/profile/edit-name')}
          />
          <SettingsRow
            icon="card"
            title={t('profile.paymentMethods')}
            detail={paymentDetail}
            onPress={() => router.push('/profile/payment-methods')}
          />
          <SettingsRow
            icon="globe"
            title={t('profile.language')}
            detail={<LangChip code={i18n.resolvedLanguage ?? 'az'} />}
            onPress={() => router.push('/profile/language')}
          />
          <SettingsRow
            icon="bell"
            title={t('profile.notifications')}
            detail={
              notifGranted === null
                ? ''
                : notifGranted
                  ? t('profile.notificationsOn')
                  : t('profile.notificationsOff')
            }
            onPress={() => Linking.openSettings()}
          />
        </SettingsGroup>

        {/* Settings group 2 */}
        <SettingsGroup>
          <SettingsRow
            icon="whatsapp"
            title={t('profile.contactSupport')}
            detail={t('profile.whatsapp')}
            iconBg="#E6F8EE"
            iconFg="#1FA855"
            onPress={handleWhatsApp}
          />
          <SettingsRow
            icon="doc"
            title={t('profile.terms')}
            onPress={() => router.push('/legal/terms')}
          />
          <SettingsRow
            icon="doc"
            title={t('profile.privacy')}
            onPress={() => router.push('/legal/privacy')}
          />
        </SettingsGroup>

        {/* Logout — a clear button right after Privacy. Outline (not danger)
            so it stays visually distinct from the red Delete account row. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button
            variant="outline"
            full
            onPress={async () => {
              await useAuthStore.getState().logout();
              router.replace('/');
            }}
          >
            {t('profile.logout')}
          </Button>
        </View>

        {/* Settings group 3 — danger */}
        <SettingsGroup>
          <SettingsRow
            icon="trash"
            title={t('profile.deleteAccount')}
            titleColor={colors.error}
            iconBg={colors.errorSoft}
            iconFg={colors.error}
            chevron={false}
            centered
            onPress={() => router.push('/profile/delete-account')}
          />
        </SettingsGroup>

        {/* App version footer */}
        <Text
          style={{
            marginTop: 24,
            textAlign: 'center',
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            color: colors.ink[400],
          }}
        >
          Tahawash v0.1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── pieces ────────────────────────────────────────────────────

function Avatar({
  name,
  phone,
}: {
  name: string | null | undefined;
  phone: string | null | undefined;
}) {
  const initials = computeInitials(name, phone);
  // expo-linear-gradient expects a tuple of at least 2 colors.
  const colorsTuple = gradients.avatar as unknown as readonly [string, string, ...string[]];
  return (
    <LinearGradient
      colors={colorsTuple}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: 'Inter_700Bold',
          fontSize: 26,
          color: colors.white,
        }}
      >
        {initials}
      </Text>
    </LinearGradient>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' }}>
      <Text
        style={{
          fontFamily: 'Inter_800ExtraBold',
          fontSize: 19,
          letterSpacing: -0.4,
          color: colors.ink[900],
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={{
          marginTop: 2,
          fontFamily: 'Inter_600SemiBold',
          fontSize: 11,
          color: colors.ink[500],
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      <Card padding={0} style={{ overflow: 'hidden' }}>
        {children}
      </Card>
    </View>
  );
}

interface SettingsRowProps {
  icon: IconName;
  title: string;
  detail?: React.ReactNode;
  chevron?: boolean;
  iconBg?: string;
  iconFg?: string;
  titleColor?: string;
  /** Center the icon+title as a group (used by the standalone Delete row). */
  centered?: boolean;
  onPress?: () => void;
}

function SettingsRow({
  icon,
  title,
  detail,
  chevron = true,
  iconBg = colors.brand[50],
  iconFg = colors.brand[600],
  titleColor = colors.ink[900],
  centered = false,
  onPress,
}: SettingsRowProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: centered ? 'center' : 'flex-start',
          paddingVertical: 14,
          paddingHorizontal: 16,
          gap: 12,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={20} color={iconFg} />
        </View>
        <Text
          style={{
            flex: centered ? 0 : 1,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 15,
            color: titleColor,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {detail !== undefined ? (
          typeof detail === 'string' ? (
            <Text
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.ink[500] }}
              numberOfLines={1}
            >
              {detail}
            </Text>
          ) : (
            detail
          )
        ) : null}
        {chevron ? <Icon name="chevron" size={16} color={colors.ink[300]} /> : null}
      </View>
    </Pressable>
  );
}

function LangChip({ code }: { code: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: colors.lineSoft,
      }}
    >
      <Text
        style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 12,
          color: colors.ink[700],
          letterSpacing: 0.4,
        }}
      >
        {code.toUpperCase()}
      </Text>
    </View>
  );
}

// ─── helpers ───────────────────────────────────────────────

function computeInitials(
  name: string | null | undefined,
  phone: string | null | undefined,
): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return (first + second).toUpperCase() || 'U';
  }
  // Fallback to last 2 digits of phone for a sense of identity.
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    return digits.slice(-2);
  }
  return 'U';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, Button, Card, Icon, Pill, RemoteImage, TenantMark } from '../../src/components/ui';
import { useMyTransaction } from '../../src/hooks/use-transactions';
import { formatHistoryDate } from '../../src/lib/baku-date';
import { formatTetri, parseAznToTetri } from '../../src/lib/charge-amount';
import type { CustomerTx, CustomerTxStatus } from '../../src/lib/transactions-api';
import { colors } from '../../src/theme/tokens';

/**
 * A8.2 Transaction detail.
 *
 * Reached from the History list. Renders the full receipt:
 *   - Brand + bay + branch + status pill
 *   - Big amount (tabular-nums)
 *   - Receipt rows: date, payment method, reference number,
 *     hardware credited time, error reason (when present)
 *   - WhatsApp support button for hardware errors (round-1 spec —
 *     support is via WhatsApp only)
 */
export default function TransactionDetail() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const txId = params.id ?? '';
  const txQuery = useMyTransaction(txId);

  if (txQuery.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (txQuery.isError || !txQuery.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View
          style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 12 }}
        >
          <Icon name="alert" size={32} color={colors.amber} />
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 18,
              color: colors.ink[900],
              textAlign: 'center',
            }}
          >
            {t('transaction.errorTitle')}
          </Text>
          <Pressable onPress={() => void txQuery.refetch()} hitSlop={8}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.brand[600] }}>
              {t('common.retry')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return <DetailBody tx={txQuery.data} />;
}

function DetailBody({ tx }: { tx: CustomerTx }) {
  const { t } = useTranslation();
  const visual = statusVisual(tx.status);
  const showHardwareErrorSupport = tx.status === 'paid_hardware_error';

  const handleSupport = async () => {
    const supportNumber = (process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');
    const message = t('transaction.supportMessage', {
      bay: tx.bay.name,
      tenant: tx.tenant.brandName,
      ref: tx.ePointReference ?? tx.id,
      amount: formatTetri(parseAznToTetri(tx.amountAzn)),
    });
    const url = supportNumber
      ? `https://wa.me/${supportNumber}?text=${encodeURIComponent(message)}`
      : 'https://wa.me/'; // graceful no-op if env not configured yet
    try {
      await Linking.openURL(url);
    } catch {
      /* user can copy the ePoint reference from the receipt */
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <BackButton onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
      >
        {/* Tenant + bay header */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <RemoteImage
              uri={tx.tenant.logoUrl}
              style={{ width: 48, height: 48, borderRadius: 24 }}
              fallback={<TenantMark name={tx.tenant.brandName} size={48} radius={24} />}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: colors.ink[900] }}
              >
                {tx.tenant.brandName}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13,
                  color: colors.ink[500],
                }}
              >
                {tx.bay.name} · {tx.location.name}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <Pill bg={visual.bg} color={visual.fg}>
              {visual.icon} {t(visual.labelKey)}
            </Pill>
            <Text
              style={{
                marginTop: 12,
                fontFamily: 'Inter_800ExtraBold',
                fontSize: 38,
                letterSpacing: -1,
                color: colors.ink[900],
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatTetri(parseAznToTetri(tx.amountAzn))}
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontFamily: 'Inter_400Regular',
                fontSize: 13,
                color: colors.ink[500],
              }}
            >
              {formatHistoryDate(tx.createdAt, t)}
            </Text>
          </View>
        </Card>

        {/* Receipt rows */}
        <View style={{ height: 12 }} />
        <Card>
          <ReceiptRow label={t('transaction.address')} value={tx.location.address} multiline />
          {tx.paymentMethod ? (
            <ReceiptRow label={t('transaction.paymentMethod')} value={formatPaymentMethod(t, tx)} />
          ) : null}
          {tx.ePointReference ? (
            <ReceiptRow label={t('transaction.reference')} value={tx.ePointReference} mono />
          ) : null}
          {tx.hardwareCreditedAt ? (
            <ReceiptRow
              label={t('transaction.hardwareCreditedAt')}
              value={formatHistoryDate(tx.hardwareCreditedAt, t)}
            />
          ) : null}
          {tx.errorReason ? (
            <ReceiptRow label={t('transaction.errorReason')} value={tx.errorReason} multiline />
          ) : null}
        </Card>

        {/* Support CTA — hardware errors only */}
        {showHardwareErrorSupport ? (
          <>
            <View style={{ height: 16 }} />
            <Card>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: '#E6F8EE',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="whatsapp" size={20} color="#1FA855" stroke={1.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.ink[900] }}
                  >
                    {t('transaction.supportTitle')}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontFamily: 'Inter_400Regular',
                      fontSize: 13,
                      lineHeight: 19,
                      color: colors.ink[500],
                    }}
                  >
                    {t('transaction.supportBody')}
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 14 }}>
                <Button full onPress={handleSupport}>
                  {t('transaction.contactWhatsApp')}
                </Button>
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

interface ReceiptRowProps {
  label: string;
  value: string;
  multiline?: boolean;
  mono?: boolean;
}

function ReceiptRow({ label, value, multiline, mono }: ReceiptRowProps) {
  return (
    <View
      style={{
        flexDirection: multiline ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: multiline ? 4 : 12,
        paddingVertical: 8,
      }}
    >
      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.ink[500] }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: mono ? 'Inter_500Medium' : 'Inter_600SemiBold',
          fontSize: 14,
          color: colors.ink[900],
          flexShrink: multiline ? undefined : 1,
          textAlign: multiline ? 'left' : 'right',
          fontVariant: mono ? ['tabular-nums'] : undefined,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── helpers ──────────────────────────────────────────────

interface StatusVisual {
  labelKey: string;
  bg: string;
  fg: string;
  icon: string;
}

function statusVisual(status: CustomerTxStatus): StatusVisual {
  switch (status) {
    case 'paid_credited':
      return {
        labelKey: 'history.statusPaid',
        bg: colors.successSoft,
        fg: colors.success,
        icon: '●',
      };
    case 'paid_hardware_error':
      return {
        labelKey: 'history.statusHardwareError',
        bg: colors.amberSoft,
        fg: colors.amber,
        icon: '⚠',
      };
    case 'declined':
      return {
        labelKey: 'history.statusDeclined',
        bg: colors.errorSoft,
        fg: colors.error,
        icon: '✕',
      };
    case 'cancelled':
      return {
        labelKey: 'history.statusCancelled',
        bg: colors.lineSoft,
        fg: colors.ink[500],
        icon: '—',
      };
    case 'pending':
    case 'paid_crediting':
    default:
      return {
        labelKey: 'history.statusProcessing',
        bg: colors.lineSoft,
        fg: colors.ink[500],
        icon: '⋯',
      };
  }
}

function formatPaymentMethod(
  t: (k: string, opts?: Record<string, unknown>) => string,
  tx: CustomerTx,
): string {
  if (tx.paymentMethod === 'apple_pay') return 'Apple Pay';
  if (tx.paymentMethod === 'google_pay') return 'Google Pay';
  // card
  const brand = tx.cardBrand ?? 'unknown';
  const brandName = brand === 'unknown' ? t('transaction.card') : capitalize(brand);
  if (tx.cardLastFour) return `${brandName} •• ${tx.cardLastFour}`;
  return brandName;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

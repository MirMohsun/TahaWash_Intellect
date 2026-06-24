import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { BackButton, Icon, TenantMark, useDialog } from '../../src/components/ui';
import {
  buildBounds,
  canDecrement,
  canIncrement,
  decrement,
  defaultAmountTetri,
  formatTetri,
  increment,
  parseAznToTetri,
  suggestedChips,
} from '../../src/lib/charge-amount';
import { lookupDevice } from '../../src/lib/devices-api';
import { usePaymentMethods } from '../../src/hooks/use-me';
import { useCreatePayment } from '../../src/hooks/use-payments';
import type { PaymentMethod } from '../../src/lib/customers-api';
import type { CreatePaymentMethod, CreatePaymentRequest } from '../../src/lib/payments-api';
import { colors, shadows } from '../../src/theme/tokens';

/**
 * A6.2 Charge screen — THE magic-moment screen.
 *
 * Reached via two paths:
 *   1. /scanner → successful QR lookup → router.replace('/charge/:id')
 *   2. Manual entry (Phase 2.14 QA pass may add a "type the code"
 *      fallback for users whose camera doesn't work).
 *
 * Visually pinned to the locked design exactly:
 *   - Back button top-left
 *   - "WASH BAY" caption (uppercase, brand-600, letter-spaced)
 *   - Bay name in display weight (Inter 800, 40pt, -1.2 letter-spacing)
 *   - TenantMark + "Brand · Branch" subtitle
 *   - Big amount counter: tabular-nums brand-600, 76pt, ± buttons either side
 *   - "Steps of 0,50 ₼ · min X — max Y" hint
 *   - 4 quick chips (1,00 / 2,00 / 3,00 / 5,00 by default)
 *   - Charge button bottom-pinned with brand-tinted glow
 *
 * Payment integration is Phase 2.8 — for now the Charge button shows a
 * placeholder confirming the amount, with a clear message that the real
 * ePoint flow lands in the next stage.
 */
export default function ChargeScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ qrShortId: string }>();
  const qrShortId = params.qrShortId ?? '';

  const deviceQuery = useQuery({
    queryKey: ['device', qrShortId],
    queryFn: () => lookupDevice(qrShortId),
    enabled: Boolean(qrShortId),
    // Device data shouldn't change while the customer is staring at the
    // charge screen — keep it stale-while-revalidating with a longish
    // window. If the bay was disabled mid-session the payment flow
    // catches it on POST.
    staleTime: 5 * 60 * 1000,
  });

  if (deviceQuery.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (deviceQuery.isError || !deviceQuery.data) {
    // Shouldn't normally happen — we only navigate here AFTER a
    // successful scanner lookup. If it does (e.g. token expired
    // mid-navigation, or the user deep-linked into a bad qrShortId),
    // bounce back to the scanner.
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
            {t('charge.lookupFailedTitle')}
          </Text>
          <Pressable onPress={() => router.replace('/scanner')} hitSlop={8}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.brand[600] }}>
              {t('scanner.tryAgain')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return <ChargeBody device={deviceQuery.data} />;
}

interface ChargeBodyProps {
  device: NonNullable<ReturnType<typeof useQuery>['data']> & {
    bay: { id: string; name: string; qrShortId: string };
    location: { id: string; name: string; address: string };
    tenant: {
      id: string;
      brandName: string;
      themeColor: string;
      logoUrl: string | null;
      minChargeAmount: string;
      chargeStep: string;
    };
  };
}

function ChargeBody({ device }: ChargeBodyProps) {
  const { t } = useTranslation();
  const bounds = useMemo(
    () => buildBounds(device.tenant.minChargeAmount, device.tenant.chargeStep),
    [device.tenant.minChargeAmount, device.tenant.chargeStep],
  );
  const [tetri, setTetri] = useState<number>(() => defaultAmountTetri(bounds));
  const chips = useMemo(() => suggestedChips(bounds), [bounds]);

  // The card that will actually pay — default-first, else the first saved.
  // Drives the card-ending shown in the pay bar. Null until loaded / if none.
  const methodsQuery = usePaymentMethods();
  const card = useMemo<PaymentMethod | null>(() => {
    const list: PaymentMethod[] = methodsQuery.data ?? [];
    return list.find((m) => m.isDefault) ?? list[0] ?? null;
  }, [methodsQuery.data]);
  const dialog = useDialog();
  const createPayment = useCreatePayment();

  const handleInc = () => {
    if (!canIncrement(tetri, bounds)) return;
    void Haptics.selectionAsync();
    setTetri((prev) => increment(prev, bounds));
  };

  const handleDec = () => {
    if (!canDecrement(tetri, bounds)) return;
    void Haptics.selectionAsync();
    setTetri((prev) => decrement(prev, bounds));
  };

  const handleChipPress = (chipTetri: number) => {
    void Haptics.selectionAsync();
    setTetri(chipTetri);
  };

  const handleCharge = async (method: CreatePaymentMethod) => {
    if (createPayment.isPending) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const amount = (tetri / 100).toFixed(2);
    const base = { qrShortId: device.bay.qrShortId, amount };
    const req: CreatePaymentRequest =
      method === 'saved_card' && card
        ? { ...base, method: 'saved_card', cardId: card.id }
        : method === 'new_card'
          ? { ...base, method: 'new_card', saveCard: true }
          : { ...base, method }; // apple_pay | google_pay

    try {
      const res = await createPayment.mutateAsync(req);
      if (res.status === 'declined') {
        await dialog.alert({
          title: t('charge.declinedTitle', { defaultValue: 'Payment declined' }),
          message:
            res.message ??
            t('charge.declinedBody', {
              defaultValue: 'Your payment could not be completed. Please try another method.',
            }),
          confirmLabel: t('common.done'),
        });
        return;
      }
      // authorized (saved card) → poll; redirect → open the URL in a WebView.
      const url = res.redirectUrl ?? res.widgetUrl;
      router.push({
        pathname: '/payment/[id]',
        params: { id: res.transactionId, ...(url ? { url: encodeURIComponent(url) } : {}) },
      });
    } catch {
      await dialog.alert({
        title: t('charge.payErrorTitle', { defaultValue: 'Something went wrong' }),
        message: t('charge.payErrorBody', {
          defaultValue: "We couldn't start your payment. Please try again.",
        }),
        confirmLabel: t('common.done'),
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <BackButton onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 20 }}>
        {/* Caption + bay name */}
        <Text
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
            color: colors.brand[600],
            letterSpacing: 0.2,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          {t('charge.washBay')}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_800ExtraBold',
            fontSize: 40,
            lineHeight: 42,
            letterSpacing: -1.2,
            color: colors.ink[900],
          }}
        >
          {device.bay.name}
        </Text>

        {/* Tenant subtitle */}
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TenantMark name={device.tenant.brandName} size={20} />
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
              color: colors.ink[500],
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {device.tenant.brandName} · {device.location.name}
          </Text>
        </View>

        {/* Amount counter — brand-colored number flanked by bare ± icon
            buttons (no filled "blob" chrome). The bigger number reads as
            the focal "magic moment"; the icons stay quiet and tappable. */}
        <View
          style={{
            marginTop: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <CounterButton icon="minus" onPress={handleDec} disabled={!canDecrement(tetri, bounds)} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: 'Inter_800ExtraBold',
                fontSize: 58,
                lineHeight: 62,
                letterSpacing: -2.5,
                color: colors.brand[600],
                fontVariant: ['tabular-nums'],
                textAlign: 'center',
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatTetri(tetri)}
            </Text>
          </View>
          <CounterButton icon="plus" onPress={handleInc} disabled={!canIncrement(tetri, bounds)} />
        </View>

        <Text
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            color: colors.ink[500],
          }}
        >
          {t('charge.stepHint', {
            step: formatTetri(bounds.stepTetri),
            min: formatTetri(bounds.minTetri),
            max: formatTetri(bounds.maxTetri),
          })}
        </Text>

        {/* Quick-pick chips — one balanced row of equal-width presets
            (was a lopsided 3-then-1 wrap). */}
        <View style={{ marginTop: 28, flexDirection: 'row', gap: 10 }}>
          {chips.map((chip) => (
            <PresetChip
              key={chip}
              label={formatChip(chip)}
              active={chip === tetri}
              onPress={() => handleChipPress(chip)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Pay bar — pinned near bottom. Left shows WHICH card pays (brand
          chip + last-4); right is the action + amount. Single line each, with
          the left side allowed to shrink, so nothing collides on narrow
          screens. STATIC style array (not function-style) so the fill paints
          reliably under New Arch / Fabric. */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Pressable
          onPress={() => void handleCharge(card ? 'saved_card' : 'new_card')}
          disabled={createPayment.isPending}
          android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
          style={[
            {
              height: 66,
              borderRadius: 999,
              backgroundColor: colors.brand[500],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              gap: 12,
              overflow: 'hidden',
            },
            shadows.fab,
          ]}
        >
          {/* Which card is paying */}
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}
          >
            <View
              style={{
                minWidth: 44,
                height: 28,
                paddingHorizontal: 7,
                borderRadius: 6,
                backgroundColor: 'rgba(255,255,255,0.22)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {card ? (
                <Text
                  style={{
                    fontFamily: 'Inter_800ExtraBold',
                    fontSize: 10,
                    letterSpacing: 0.6,
                    color: colors.white,
                  }}
                >
                  {cardBrandLabel(card.brand)}
                </Text>
              ) : (
                <Icon name="card" size={16} color={colors.white} />
              )}
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 15,
                color: colors.white,
                fontVariant: ['tabular-nums'],
                flexShrink: 1,
              }}
            >
              {card
                ? `•••• ${card.lastFour}`
                : t('charge.cardOnFile', { defaultValue: 'Card on file' })}
            </Text>
          </View>

          {/* Action + amount */}
          {createPayment.isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'Inter_800ExtraBold',
                fontSize: 18,
                color: colors.white,
                letterSpacing: -0.3,
              }}
            >
              {t('charge.payAction', { amount: formatTetri(tetri) })}
            </Text>
          )}
        </Pressable>

        {/* Alternative payment methods — wallet (Apple/Google Pay) + new card */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Pressable
            onPress={() => void handleCharge(Platform.OS === 'ios' ? 'apple_pay' : 'google_pay')}
            disabled={createPayment.isPending}
            android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: colors.line,
              backgroundColor: colors.bgElev,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.ink[900] }}>
              {Platform.OS === 'ios'
                ? t('charge.applePay', { defaultValue: 'Apple Pay' })
                : t('charge.googlePay', { defaultValue: 'Google Pay' })}
            </Text>
          </Pressable>
          {card ? (
            <Pressable
              onPress={() => void handleCharge('new_card')}
              disabled={createPayment.isPending}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: colors.line,
                backgroundColor: colors.bgElev,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.ink[900] }}>
                {t('charge.newCard', { defaultValue: 'New card' })}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text
          style={{
            marginTop: 10,
            textAlign: 'center',
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            color: colors.ink[400],
          }}
        >
          {t('charge.secured')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

/** Bare +/- icon control — no filled circle / border / shadow, just the
    glyph (the user asked for "normal icons", not chrome blobs). Generous
    hitSlop + a borderless press ripple keep it tappable. Static style array
    so it paints reliably under New Arch / Fabric. */
function CounterButton({
  icon,
  onPress,
  disabled,
}: {
  icon: 'plus' | 'minus';
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={14}
      android_ripple={
        disabled ? undefined : { color: 'rgba(14,122,231,0.16)', borderless: true, radius: 28 }
      }
      style={{
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Icon
        name={icon}
        size={30}
        stroke={2.4}
        color={disabled ? colors.ink[400] : colors.brand[600]}
      />
    </Pressable>
  );
}

/** Short uppercase label for a saved card's network. */
function cardBrandLabel(brand: PaymentMethod['brand']): string {
  switch (brand) {
    case 'visa':
      return 'VISA';
    case 'mastercard':
      return 'MC';
    case 'unionpay':
      return 'UP';
    case 'maestro':
      return 'MS';
    default:
      return 'CARD';
  }
}

/** Preset-amount chip. Tag-styled with proper touch target. */
function PresetChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      android_ripple={{ color: 'rgba(14,122,231,0.12)' }}
      style={[
        {
          flex: 1,
          height: 46,
          paddingHorizontal: 8,
          borderRadius: 23,
          borderWidth: 1.5,
          borderColor: active ? colors.brand[500] : colors.line,
          backgroundColor: active ? colors.brand[50] : colors.bgElev,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        active ? shadows.card : null,
      ]}
    >
      <Text
        style={{
          fontFamily: 'Inter_700Bold',
          fontSize: 14,
          color: active ? colors.brand[700] : colors.ink[700],
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** "1,00" → "1,00 ₼" but trimmed for chips. */
function formatChip(tetri: number): string {
  return formatTetri(tetri);
}

// Use the parseAznToTetri export so prettier doesn't strip the import in
// dead-code paths during this scaffold phase. The function is used by
// buildBounds inside charge-amount.ts; we re-export effectively here.
void parseAznToTetri;

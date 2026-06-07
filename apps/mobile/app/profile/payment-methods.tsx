import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, Card, Icon, Pill, Skeleton, useDialog } from '../../src/components/ui';
import { useDeletePaymentMethod, usePaymentMethods } from '../../src/hooks/use-me';
import type { PaymentMethod } from '../../src/lib/customers-api';
import { colors } from '../../src/theme/tokens';

/**
 * A9.2 Payment methods management.
 *
 * Lists the customer's saved cards (default-first). Each row has a
 * delete button. Adding a new card is NOT a direct action on this
 * screen — cards are saved automatically during a payment flow when
 * the user opts in (Phase 2.8 wires the ePoint "save card?" toggle).
 * We surface that hint at the bottom rather than a dead "Add card"
 * button.
 */
export default function PaymentMethodsScreen() {
  const { t } = useTranslation();
  const methodsQuery = usePaymentMethods();
  const deleteMutation = useDeletePaymentMethod();
  const dialog = useDialog();

  const methods: PaymentMethod[] = methodsQuery.data ?? [];

  const handleDelete = async (id: string, brandLabel: string) => {
    const ok = await dialog.confirm({
      title: t('paymentMethods.deleteTitle'),
      message: t('paymentMethods.deleteBody', { card: brandLabel }),
      confirmLabel: t('paymentMethods.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) deleteMutation.mutate(id);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <BackButton onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
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
          {t('paymentMethods.title')}
        </Text>
        <Text
          style={{
            marginTop: 6,
            paddingHorizontal: 4,
            fontFamily: 'Inter_400Regular',
            fontSize: 15,
            color: colors.ink[500],
          }}
        >
          {t('paymentMethods.subtitle')}
        </Text>

        <View style={{ height: 16 }} />

        {methodsQuery.isLoading ? (
          <View style={{ gap: 10 }}>
            {[0, 1].map((i) => (
              <Card key={i}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Skeleton width={44} height={32} radius={6} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="60%" height={14} />
                    <Skeleton width="40%" height={12} />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : methods.length === 0 ? (
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
              <Icon name="card" size={28} color={colors.brand[600]} />
            </View>
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 16,
                color: colors.ink[900],
                textAlign: 'center',
              }}
            >
              {t('paymentMethods.emptyTitle')}
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
              {t('paymentMethods.emptyBody')}
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {methods.map((m) => (
              <CardRow
                key={m.id}
                method={m}
                onDelete={() => handleDelete(m.id, `${capitalize(m.brand)} •• ${m.lastFour}`)}
                deleting={deleteMutation.isPending && deleteMutation.variables === m.id}
              />
            ))}
            <Text
              style={{
                marginTop: 8,
                fontFamily: 'Inter_400Regular',
                fontSize: 12,
                lineHeight: 18,
                color: colors.ink[400],
                textAlign: 'center',
                paddingHorizontal: 16,
              }}
            >
              {t('paymentMethods.addHint')}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CardRow({
  method,
  onDelete,
  deleting,
}: {
  method: PaymentMethod;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 48,
            height: 32,
            borderRadius: 6,
            backgroundColor: brandColor(method.brand),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'Inter_800ExtraBold',
              fontSize: 11,
              letterSpacing: 0.6,
              color: colors.white,
            }}
          >
            {brandLabel(method.brand)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 15,
                color: colors.ink[900],
                fontVariant: ['tabular-nums'],
              }}
            >
              •• {method.lastFour}
            </Text>
            {method.isDefault ? (
              <Pill bg={colors.brand[50]} color={colors.brand[700]}>
                {t('paymentMethods.default')}
              </Pill>
            ) : null}
          </View>
          <Text
            style={{
              marginTop: 2,
              fontFamily: 'Inter_500Medium',
              fontSize: 12,
              color: colors.ink[500],
            }}
          >
            {capitalize(method.brand)}
          </Text>
        </View>
        <Pressable
          onPress={onDelete}
          disabled={deleting}
          hitSlop={8}
          style={({ pressed }) => [
            {
              opacity: deleting ? 0.4 : pressed ? 0.6 : 1,
              padding: 8,
            },
          ]}
        >
          <Icon name="trash" size={20} color={colors.error} />
        </Pressable>
      </View>
    </Card>
  );
}

function brandColor(brand: PaymentMethod['brand']): string {
  switch (brand) {
    case 'visa':
      return '#1A1F71';
    case 'mastercard':
      return '#EB001B';
    case 'unionpay':
      return '#005BAC';
    case 'maestro':
      return '#0099DF';
    default:
      return colors.ink[700];
  }
}

function brandLabel(brand: PaymentMethod['brand']): string {
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

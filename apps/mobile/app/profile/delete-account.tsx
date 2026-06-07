import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, BackHandler, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, Button, Card, Icon } from '../../src/components/ui';
import { useDeleteMe } from '../../src/hooks/use-me';
import { useAuthStore } from '../../src/store/auth';
import { colors } from '../../src/theme/tokens';

/**
 * A9.4 Account deletion — 3 steps in one screen.
 *
 *   Step 1 — Warning: explain what disappears, "Continue" button.
 *   Step 2 — Confirm: type "DELETE" exactly to enable the destructive button.
 *   Step 3 — Deleting: spinner while DELETE /me runs.
 *
 * On success we clear local tokens via the auth store's logout(), which
 * also bumps the user to /(auth)/phone. The server has already
 * anonymized their transactions + revoked refresh tokens, so the next
 * cold start can't recover the account.
 */
const CONFIRM_PHRASE = 'DELETE';

export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const deleteMutation = useDeleteMe();
  const logout = useAuthStore((s) => s.logout);

  const matches = typed.trim().toUpperCase() === CONFIRM_PHRASE;

  // Android hardware back: step 2 → step 1 instead of popping the
  // whole route. Step 1 falls through to the system handler (router
  // pops back to Profile).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 2 && !deleteMutation.isPending) {
        setStep(1);
        return true; // consume the event
      }
      return false;
    });
    return () => sub.remove();
  }, [step, deleteMutation.isPending]);

  const handleConfirmDelete = async () => {
    if (!matches || deleteMutation.isPending) return;
    setErrorMessage(null);
    try {
      await deleteMutation.mutateAsync();
      // Local logout — also bumps to /(auth)/phone via the auth gate.
      await logout();
    } catch {
      setErrorMessage(t('deleteAccount.errorBody'));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <BackButton
          onPress={() => {
            if (step === 2 && !deleteMutation.isPending) setStep(1);
            else router.back();
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
      >
        {step === 1 ? (
          <WarningStep onContinue={() => setStep(2)} />
        ) : (
          <ConfirmStep
            typed={typed}
            setTyped={setTyped}
            matches={matches}
            onDelete={handleConfirmDelete}
            pending={deleteMutation.isPending}
            errorMessage={errorMessage}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WarningStep({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: 'center', paddingTop: 8 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.errorSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="trash" size={36} color={colors.error} />
        </View>
      </View>

      <Text
        style={{
          fontFamily: 'Inter_800ExtraBold',
          fontSize: 26,
          letterSpacing: -0.6,
          color: colors.ink[900],
          textAlign: 'center',
        }}
      >
        {t('deleteAccount.warningTitle')}
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 15,
          lineHeight: 22,
          color: colors.ink[500],
          textAlign: 'center',
        }}
      >
        {t('deleteAccount.warningBody')}
      </Text>

      <Card>
        <BulletRow text={t('deleteAccount.bullet1')} />
        <BulletRow text={t('deleteAccount.bullet2')} />
        <BulletRow text={t('deleteAccount.bullet3')} />
        <BulletRow text={t('deleteAccount.bullet4')} />
      </Card>

      <View style={{ height: 8 }} />

      <Button variant="danger" full onPress={onContinue}>
        {t('deleteAccount.continueButton')}
      </Button>
      <Button variant="outline" full onPress={() => router.back()}>
        {t('common.cancel')}
      </Button>
    </View>
  );
}

function ConfirmStep({
  typed,
  setTyped,
  matches,
  onDelete,
  pending,
  errorMessage,
}: {
  typed: string;
  setTyped: (s: string) => void;
  matches: boolean;
  onDelete: () => void;
  pending: boolean;
  errorMessage: string | null;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 16 }}>
      <Text
        style={{
          fontFamily: 'Inter_800ExtraBold',
          fontSize: 26,
          letterSpacing: -0.6,
          color: colors.ink[900],
        }}
      >
        {t('deleteAccount.confirmTitle')}
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 15,
          lineHeight: 22,
          color: colors.ink[500],
        }}
      >
        {t('deleteAccount.confirmBody', { phrase: CONFIRM_PHRASE })}
      </Text>

      <Card padding={0}>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          editable={!pending}
          placeholder={CONFIRM_PHRASE}
          placeholderTextColor={colors.ink[400]}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            fontFamily: 'Inter_700Bold',
            fontSize: 18,
            letterSpacing: 4,
            color: colors.ink[900],
          }}
        />
      </Card>

      {errorMessage ? (
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 13,
            color: colors.error,
            textAlign: 'center',
          }}
        >
          {errorMessage}
        </Text>
      ) : null}

      <View style={{ height: 8 }} />

      <Button variant="danger" full disabled={!matches || pending} onPress={onDelete}>
        {pending ? <ActivityIndicator color={colors.error} /> : t('deleteAccount.confirmButton')}
      </Button>
      <Button variant="outline" full onPress={() => router.back()} disabled={pending}>
        {t('common.cancel')}
      </Button>
    </View>
  );
}

function BulletRow({ text }: { text: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 6,
        alignItems: 'flex-start',
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          marginTop: 7,
          backgroundColor: colors.error,
        }}
      />
      <Text
        style={{
          flex: 1,
          fontFamily: 'Inter_500Medium',
          fontSize: 14,
          lineHeight: 21,
          color: colors.ink[700],
        }}
      >
        {text}
      </Text>
    </View>
  );
}

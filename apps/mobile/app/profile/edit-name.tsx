import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, Button, Card } from '../../src/components/ui';
import { useMe, useUpdateMe } from '../../src/hooks/use-me';
import { colors } from '../../src/theme/tokens';

/**
 * Deferred from 2.10. Tiny screen — single TextInput + Save.
 *
 * Phone changes require a re-OTP flow and aren't editable here (Phase 3
 * tenant admin will likely add a "change phone" support workflow once
 * we have the OTP-anew + verify pattern down). For now, name is the
 * only field a customer can self-edit.
 */
export default function EditNameScreen() {
  const { t } = useTranslation();
  const meQuery = useMe();
  const updateMe = useUpdateMe();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Seed once /me arrives.
  useEffect(() => {
    if (meQuery.data && name === '') {
      setName(meQuery.data.name ?? '');
    }
    // intentionally don't depend on `name` to avoid wiping user input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meQuery.data]);

  const canSave = name.trim().length > 0 && name.trim().length <= 80 && !updateMe.isPending;
  const handleSave = async () => {
    if (!canSave) return;
    setError(null);
    try {
      await updateMe.mutateAsync({ name: name.trim() });
      router.back();
    } catch {
      setError(t('editName.error'));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <BackButton onPress={() => router.back()} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
            {t('editName.title')}
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
            {t('editName.subtitle')}
          </Text>

          <View style={{ height: 16 }} />

          <Card padding={0}>
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (error) setError(null);
              }}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              maxLength={80}
              placeholder={t('editName.placeholder')}
              placeholderTextColor={colors.ink[400]}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 18,
                color: colors.ink[900],
              }}
            />
          </Card>

          {error ? (
            <Text
              style={{
                marginTop: 10,
                paddingHorizontal: 4,
                fontFamily: 'Inter_500Medium',
                fontSize: 13,
                color: colors.error,
              }}
            >
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Button full disabled={!canSave} loading={updateMe.isPending} onPress={handleSave}>
            {t('common.save')}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

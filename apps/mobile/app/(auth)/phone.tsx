import { normalizeAzPhone, validateAzPhone } from '@tahawash/shared-utils';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Logo } from '../../src/components/brand/logo';
import { Button } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/auth';
import { colors } from '../../src/theme/tokens';

/**
 * A1.2 Phone entry.
 *
 * Ported 1:1 from the locked design (Design_Mobile_App/app/screens-a.jsx
 * → ScreenOnboarding):
 *   - Wordmark + Tahawash logo top-left
 *   - "Wash. Pay. Go." display title (-1.2 letter-spacing)
 *   - Subtitle paragraph
 *   - Phone field: AZ flag bars + "+994" locked prefix on the left,
 *     editable 9-digit local number on the right
 *   - Field has brand-500 border + brand-tinted focus glow
 *   - Primary button below
 *   - Tiny T&C footer pinned to bottom
 *
 * Translations to React Native:
 *   - Focus glow → borderColor swap (RN doesn't support box-shadow on
 *     transparent backgrounds the same way; the brand-bordered look is
 *     what reads visually anyway)
 *   - readOnly input → controlled TextInput w/ keyboardType=number-pad,
 *     maxLength=9 (local digits only)
 *   - Hardware return on submit
 */
export default function PhoneScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [local, setLocal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);

  const requestOtp = useAuthStore((s) => s.requestOtp);

  const display = formatLocalAsTyped(local);
  const e164 = local.length === 9 ? `+994${local}` : null;
  const canSubmit = e164 !== null && validateAzPhone(e164);

  // Track keyboard visibility so the footer's bottom padding can collapse
  // the system-navigation-bar inset when the keyboard is up. Without this,
  // the SafeAreaView's bottom inset (~24-48dp for nav bar) sits wasted
  // between the keyboard and the Continue button.
  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEv, () => setKeyboardUp(true));
    const hideSub = Keyboard.addListener(hideEv, () => setKeyboardUp(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    const normalized = normalizeAzPhone(`+994${local}`);
    if (!normalized) {
      setError(t('auth.phone.invalid'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await requestOtp(normalized);
      router.push({ pathname: '/(auth)/otp', params: { phone: normalized } });
    } catch (err) {
      // Surface the real axios error to logcat so `adb logcat | grep ReactNativeJS`
      // shows the actual failure (timeout, DNS, TLS, 4xx/5xx body, etc.) instead
      // of just our user-facing "network error" string.
      const axErr = err as {
        message?: string;
        code?: string;
        response?: { status?: number; data?: { code?: string; message?: string } };
        config?: { url?: string; baseURL?: string };
      };
      // eslint-disable-next-line no-console
      console.error('[phone] requestOtp failed', {
        message: axErr?.message,
        code: axErr?.code,
        status: axErr?.response?.status,
        body: axErr?.response?.data,
        url: `${axErr?.config?.baseURL ?? ''}${axErr?.config?.url ?? ''}`,
      });
      const apiCode = axErr?.response?.data?.code;
      if (apiCode === 'OTP_RATE_LIMITED') {
        setError(t('auth.phone.rateLimited'));
      } else {
        // Preview/dev: append the axios diagnostic (status / code / message)
        // to the user-facing error so we don't have to fish in adb logcat.
        // Strip before going to production.
        const detail = axErr?.response?.status
          ? `HTTP ${axErr.response.status}: ${axErr?.response?.data?.message ?? axErr?.message ?? ''}`
          : `${axErr?.code ?? 'UNKNOWN'}: ${axErr?.message ?? ''}`;
        setError(`${t('auth.phone.networkError')}\n${detail}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Layout philosophy — rewritten from scratch:
  //   ONE ScrollView holds everything. Content flows top-to-bottom:
  //   wordmark → title → subtitle → phone field → (error) → Continue → T&C.
  //   The button sits IMMEDIATELY below the input with a fixed 24dp gap, so
  //   there's no longer a "split" caused by the input pinning to the top of
  //   one container and the button pinning to the bottom of another.
  //   The T&C uses marginTop:'auto' so it floats to the bottom of the scroll
  //   content when there's room, and slides up tight against the button when
  //   the keyboard collapses the available area.
  //
  //   ScrollView contentContainerStyle.flexGrow:1 makes the inner column
  //   stretch to at least the ScrollView's height — required for marginTop:
  //   'auto' to know how much room to claim.
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: keyboardUp ? 10 : Math.max(12, insets.bottom + 4),
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand wordmark — Logo + "Tahawash". Tighter top margin when
              keyboard is up so the input doesn't fall below the keyboard. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: keyboardUp ? 24 : 48,
            }}
          >
            <Logo size={36} />
            <Text
              style={{
                fontFamily: 'Inter_800ExtraBold',
                fontSize: 22,
                color: colors.ink[900],
                letterSpacing: -0.6,
              }}
            >
              {t('common.appName')}
            </Text>
          </View>

          <Text
            style={{
              fontFamily: 'Inter_800ExtraBold',
              fontSize: 32,
              lineHeight: 38,
              color: colors.ink[900],
              letterSpacing: -0.6,
              marginBottom: 10,
            }}
          >
            {t('auth.phone.title')}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
              lineHeight: 23,
              color: colors.ink[500],
              marginBottom: 24,
            }}
          >
            {t('auth.phone.subtitle')}
          </Text>

          {/* Phone field */}
          <View
            style={{
              height: 64,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: error ? colors.error : colors.brand[500],
              backgroundColor: colors.bgElev,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 18,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12 }}>
              <AzFlag />
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: 17,
                  color: colors.ink[900],
                }}
              >
                +994
              </Text>
            </View>
            <View style={{ width: 1, height: 28, backgroundColor: colors.line }} />
            <TextInput
              value={display}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, '').slice(0, 9);
                setLocal(digits);
                if (error) setError(null);
              }}
              placeholder="50 234 56 78"
              placeholderTextColor={colors.ink[400]}
              keyboardType="number-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              autoFocus
              maxLength={12} /* "50 234 56 78" with spaces = 12 */
              style={{
                flex: 1,
                height: '100%',
                paddingHorizontal: 14,
                fontSize: 19,
                fontFamily: 'Inter_600SemiBold',
                color: colors.ink[900],
                letterSpacing: 0.5,
              }}
            />
          </View>

          {error ? (
            <Text
              style={{
                marginTop: 10,
                fontFamily: 'Inter_500Medium',
                fontSize: 13,
                color: colors.error,
              }}
            >
              {error}
            </Text>
          ) : null}

          {/* Continue button — fixed 24dp from the input. Lives in the same
              ScrollView as the input so the two move together as the keyboard
              opens; no separate footer means no "split" between them. */}
          <View style={{ marginTop: 24 }}>
            <Button full onPress={handleSubmit} loading={submitting} disabled={!canSubmit}>
              {t('auth.phone.continue')}
            </Button>
          </View>

          {/* T&C hint. marginTop:'auto' pushes it to the bottom of the scroll
              content — visible at the screen edge when keyboard is closed,
              tight under the button when keyboard is open. */}
          {/* T&C footer. Each link is its OWN Pressable (with hitSlop) in a
              wrapping row — nested <Text onPress> taps are unreliable on RN's
              New Architecture, which is why only part of the line responded. */}
          <View
            style={{
              marginTop: 'auto',
              paddingTop: 24,
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text style={TERMS_TEXT}>{t('auth.phone.termsHintPrefix')} </Text>
            <Pressable onPress={() => router.push('/legal/terms')} hitSlop={10}>
              <Text style={TERMS_LINK}>{t('auth.phone.terms')}</Text>
            </Pressable>
            <Text style={TERMS_TEXT}> {t('auth.phone.termsHintAnd')} </Text>
            <Pressable onPress={() => router.push('/legal/privacy')} hitSlop={10}>
              <Text style={TERMS_LINK}>{t('auth.phone.privacy')}</Text>
            </Pressable>
            <Text style={TERMS_TEXT}>.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const TERMS_TEXT = {
  fontFamily: 'Inter_400Regular' as const,
  fontSize: 12,
  lineHeight: 18,
  color: colors.ink[400],
};
const TERMS_LINK = {
  fontFamily: 'Inter_600SemiBold' as const,
  fontSize: 12,
  lineHeight: 18,
  color: colors.brand[600],
};

/** Format the typed local digits as "XX XXX XX XX" while user types. */
function formatLocalAsTyped(local: string): string {
  const d = local.replace(/\D/g, '');
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
  if (d.length <= 7) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
}

/**
 * Azerbaijan flag — three horizontal bands (blue / red / green) with the
 * white crescent and eight-pointed star centred on the red band. Drawn as SVG
 * so the crescent + star stay crisp at this small chip size. (The previous
 * version was three plain bars in the wrong order and missing the emblem.)
 */
function AzFlag() {
  return (
    <View style={{ width: 24, height: 16, borderRadius: 3, overflow: 'hidden' }}>
      <Svg width={24} height={16} viewBox="0 0 24 16">
        <Rect x={0} y={0} width={24} height={5.34} fill="#0098C3" />
        <Rect x={0} y={5.33} width={24} height={5.34} fill="#EF3340" />
        <Rect x={0} y={10.66} width={24} height={5.34} fill="#3F9C35" />
        {/* White crescent = a white disc with an offset red disc cut out. */}
        <Circle cx={10.5} cy={8} r={3} fill="#FFFFFF" />
        <Circle cx={11.8} cy={8} r={2.5} fill="#EF3340" />
        {/* Eight-pointed star. */}
        <Path
          d="M14.2 6.1 L14.5 7.28 L15.54 6.66 L14.92 7.7 L16.1 8 L14.92 8.3 L15.54 9.34 L14.5 8.72 L14.2 9.9 L13.9 8.72 L12.86 9.34 L13.48 8.3 L12.3 8 L13.48 7.7 L12.86 6.66 L13.9 7.28 Z"
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
}

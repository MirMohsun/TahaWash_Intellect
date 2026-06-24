import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { BackButton, Button, Icon, type IconName } from '../../src/components/ui';
import { isSettled, useMockCompletePayment, usePaymentStatus } from '../../src/hooks/use-payments';
import { colors } from '../../src/theme/tokens';

/** Mock provider URLs use this host — we auto-complete them instead of loading a dead page. */
const MOCK_HOST = 'pay.mock.tahawash';
/** ePoint redirects the customer back to our `/pay-return` URL on completion. */
const RETURN_MARKER = '/pay-return';
/** If the callback hasn't landed in this long, show a "still processing" result. */
const POLL_TIMEOUT_MS = 30_000;

/**
 * Bridges the ePoint token widget's `window.postMessage({status,...})` (Apple /
 * Google Pay) to React Native's onMessage, which only fires for
 * `window.ReactNativeWebView.postMessage`.
 */
const INJECTED_BRIDGE = `
(function () {
  function forward(e) {
    try {
      var d = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
      window.ReactNativeWebView.postMessage(d);
    } catch (_) {}
  }
  window.addEventListener('message', forward);
  document.addEventListener('message', forward);
})();
true;
`;

type Phase = 'web' | 'polling';

/**
 * Payment processing + result screen.
 *
 * Entered from the Charge screen with `{ id }` (always) and `{ url }` (for
 * new-card / Apple-Google-Pay flows). Flow:
 *   - real url   → WebView; on return-URL navigation OR a widget message, poll.
 *   - mock url   → auto-complete then poll.
 *   - no url     → saved-card charge already authorized; poll immediately.
 * Polling stops when the transaction settles; then we show success/declined/etc.
 */
export default function PaymentScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; url?: string }>();
  const id = params.id ?? '';
  const url = params.url ? decodeURIComponent(params.url) : undefined;
  const isMockUrl = url ? url.includes(MOCK_HOST) : false;

  const mockComplete = useMockCompletePayment();
  const [phase, setPhase] = useState<Phase>(() => (url && !isMockUrl ? 'web' : 'polling'));
  const [timedOut, setTimedOut] = useState(false);
  const triggeredMock = useRef(false);

  // Mock redirect/widget → simulate ePoint's callback once, then let polling pick it up.
  useEffect(() => {
    if (phase === 'polling' && isMockUrl && !triggeredMock.current) {
      triggeredMock.current = true;
      mockComplete.mutate(id);
    }
  }, [phase, isMockUrl, id, mockComplete]);

  // Safety net: stop spinning forever if the callback is slow / never arrives.
  useEffect(() => {
    if (phase !== 'polling') return;
    const timer = setTimeout(() => setTimedOut(true), POLL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const statusQuery = usePaymentStatus(id, { enabled: phase === 'polling' });
  const status = statusQuery.data?.status;

  const onNav = (nav: WebViewNavigation) => {
    if (nav.url.includes(RETURN_MARKER)) setPhase('polling');
  };
  const onMessage = (_e: WebViewMessageEvent) => {
    // Any message from the widget means the customer finished — confirm via polling.
    setPhase('polling');
  };

  // ── WebView phase: real ePoint hosted page / Apple-Google-Pay widget ──
  if (phase === 'web' && url) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <BackButton onPress={() => router.back()} />
        </View>
        <WebView
          source={{ uri: url }}
          injectedJavaScript={INJECTED_BRIDGE}
          onMessage={onMessage}
          onNavigationStateChange={onNav}
          startInLoadingState
          style={{ flex: 1, backgroundColor: colors.bg }}
        />
      </SafeAreaView>
    );
  }

  // ── Polling / result phase ──
  const settled = isSettled(status);
  const showResult = settled || timedOut;
  const visual = settled ? resultVisual(status) : PENDING_VISUAL;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View
        style={{ flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 18 }}
      >
        {!showResult ? (
          <>
            <ActivityIndicator size="large" color={colors.brand[500]} />
            <Text style={TITLE}>
              {t('payment.processingTitle', { defaultValue: 'Processing your payment…' })}
            </Text>
            <Text style={BODY}>
              {t('payment.processingBody', {
                defaultValue: 'This only takes a moment — please keep the app open.',
              })}
            </Text>
          </>
        ) : (
          <>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: visual.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={visual.icon} size={42} color={visual.fg} />
            </View>
            <Text style={TITLE}>{t(visual.titleKey, { defaultValue: visual.titleDefault })}</Text>
            <Text style={BODY}>
              {(settled && statusQuery.data?.errorReason) ||
                t(visual.bodyKey, { defaultValue: visual.bodyDefault })}
            </Text>
          </>
        )}
      </View>

      {showResult && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Button full onPress={() => router.replace('/')}>
            {t('common.done', { defaultValue: 'Done' })}
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

const TITLE = {
  fontFamily: 'Inter_800ExtraBold',
  fontSize: 22,
  color: colors.ink[900],
  textAlign: 'center' as const,
  letterSpacing: -0.5,
};
const BODY = {
  fontFamily: 'Inter_400Regular',
  fontSize: 15,
  color: colors.ink[500],
  textAlign: 'center' as const,
  lineHeight: 22,
  maxWidth: 320,
};

interface ResultVisual {
  icon: IconName;
  bg: string;
  fg: string;
  titleKey: string;
  titleDefault: string;
  bodyKey: string;
  bodyDefault: string;
}

const PENDING_VISUAL: ResultVisual = {
  icon: 'clock',
  bg: colors.lineSoft,
  fg: colors.ink[500],
  titleKey: 'payment.pendingTitle',
  titleDefault: 'Still processing',
  bodyKey: 'payment.pendingBody',
  bodyDefault: "Your payment is being confirmed. Check History in a moment for the result.",
};

function resultVisual(status: string | undefined): ResultVisual {
  switch (status) {
    case 'paid_credited':
    case 'paid_crediting':
      return {
        icon: 'check',
        bg: colors.successSoft,
        fg: colors.success,
        titleKey: 'payment.successTitle',
        titleDefault: 'Payment successful',
        bodyKey: 'payment.successBody',
        bodyDefault: 'Your wash is starting — enjoy!',
      };
    case 'paid_hardware_error':
      return {
        icon: 'alert',
        bg: colors.amberSoft,
        fg: colors.amber,
        titleKey: 'payment.hardwareTitle',
        titleDefault: "Paid — but the bay didn't start",
        bodyKey: 'payment.hardwareBody',
        bodyDefault:
          "You were charged but the bay didn't activate. Please contact support — you won't be charged twice.",
      };
    case 'declined':
    case 'cancelled':
      return {
        icon: 'close',
        bg: colors.errorSoft,
        fg: colors.error,
        titleKey: 'payment.declinedTitle',
        titleDefault: 'Payment declined',
        bodyKey: 'payment.declinedBody',
        bodyDefault: 'Your payment could not be completed. Please try another method.',
      };
    default:
      return PENDING_VISUAL;
  }
}

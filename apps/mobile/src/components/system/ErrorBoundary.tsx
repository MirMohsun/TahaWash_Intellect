import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../ui/Icon';
import { colors } from '../../theme/tokens';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * A10.4 generic error boundary — catches uncaught render errors in the
 * authenticated app shell, shows a friendly recovery screen, and lets
 * the user reset to try again.
 *
 * Mounted just inside the root tree in app/_layout.tsx so it wraps
 * every route. The reset button clears local state; if the underlying
 * cause was a transient API hiccup, re-mounting the tree often gets
 * the user unstuck without forcing a restart.
 *
 * Once Sentry is wired (Phase 0.11 deferred), componentDidCatch is the
 * right place to report:
 *
 *   componentDidCatch(error, info) {
 *     Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
 *   }
 *
 * Today we just log to the JS console so the error is visible in dev.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[Tahawash error boundary]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorFallback onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ onReset }: { onReset: () => void }) {
  // Avoid useTranslation here — if the error happened inside i18n setup
  // we'd loop forever. Render in EN as a last resort; the underlying
  // bug is what's getting shown.
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 16,
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.amberSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="alert" size={40} color={colors.amber} />
      </View>
      <Text
        style={{
          fontFamily: 'Inter_700Bold',
          fontSize: 22,
          letterSpacing: -0.4,
          color: colors.ink[900],
          textAlign: 'center',
        }}
      >
        Something went wrong
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 14,
          lineHeight: 21,
          color: colors.ink[500],
          textAlign: 'center',
        }}
      >
        Tahawash hit an unexpected error. Tap below to try again — if the problem persists, please
        restart the app or message support on WhatsApp.
      </Text>
      <Pressable
        onPress={onReset}
        style={({ pressed }) => [
          {
            marginTop: 8,
            paddingHorizontal: 22,
            height: 56,
            borderRadius: 999,
            backgroundColor: colors.brand[500],
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.white }}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

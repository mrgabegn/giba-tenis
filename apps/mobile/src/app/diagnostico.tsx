import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkApiHealth } from '../services/health';
import { colors } from '../theme';

export default function DiagnosticsScreen() {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('Toque no botão para consultar a API configurada.');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  if (!__DEV__) return <Redirect href="/" />;

  async function verify() {
    request.current?.abort();
    const current = new AbortController();
    request.current = current;
    setState('loading');
    try {
      const result = await checkApiHealth(current.signal);
      if (current.signal.aborted) return;
      setMessage(
        `API disponível. Verificada às ${new Date(result.timestamp).toLocaleTimeString('pt-BR')}.`,
      );
      setState('ok');
    } catch (error) {
      if (current.signal.aborted) return;
      setMessage(
        error instanceof Error && error.name !== 'AbortError'
          ? error.message
          : 'Tempo de conexão esgotado. Verifique a URL, o Wi-Fi e se a API está executando.',
      );
      setState('error');
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>App → API</Text>
        <Text style={styles.description}>
          Este diagnóstico é exibido apenas durante o desenvolvimento. Ele verifica a API sem
          acessar dados de clientes.
        </Text>
        <View style={styles.card} accessibilityLiveRegion="polite">
          <Text style={[styles.message, state === 'error' && styles.error]}>{message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: state === 'loading' }}
            disabled={state === 'loading'}
            onPress={() => void verify()}
            style={({ pressed }) => [
              styles.button,
              (pressed || state === 'loading') && { opacity: 0.65 },
            ]}
          >
            {state === 'loading' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Verificar conexão</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.description}>
          A verificação de escrita e leitura no MongoDB é feita no computador com npm run db:check.
          As credenciais do banco permanecem no servidor.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 22, width: '100%', maxWidth: 620, alignSelf: 'center' },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    gap: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  message: { color: colors.ink, fontSize: 16, lineHeight: 25 },
  error: { color: colors.danger },
  button: {
    backgroundColor: colors.green,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 52,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

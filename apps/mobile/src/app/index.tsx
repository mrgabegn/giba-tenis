import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.wordmark}>
          <View style={styles.dot} />
          <Text style={styles.brand}>GIBA QUADRA</Text>
        </View>
        <Text style={styles.eyebrow}>MAIS TEMPO EM QUADRA</Text>
        <Text style={styles.title}>Sua próxima{'\n'}partida começa aqui.</Text>
        <Text style={styles.subtitle}>
          Um jeito simples de encontrar seu horário e organizar o próximo jogo.
        </Text>
        <View
          style={styles.hero}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.court}>
            <View style={styles.singles} />
            <View style={styles.serviceBox} />
            <View style={styles.centerLine} />
            <View style={styles.net} />
          </View>
          <View style={styles.ball} />
          <Text style={styles.heroLabel}>NOS VEMOS NA QUADRA.</Text>
        </View>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Estamos preparando a agenda</Text>
          <Text style={styles.noticeText}>
            Os horários e as reservas estarão disponíveis em uma próxima versão.
          </Text>
        </View>
        {__DEV__ && (
          <Link href="/diagnostico" style={styles.devLink}>
            Verificar conexão com a API →
          </Link>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 20, width: '100%', maxWidth: 620, alignSelf: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 20 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.green },
  brand: { color: colors.ink, fontWeight: '800', fontSize: 15, letterSpacing: 2 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '700', letterSpacing: 2.2 },
  title: {
    color: colors.ink,
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 44,
    letterSpacing: -1.4,
  },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 25 },
  hero: {
    backgroundColor: colors.green,
    height: 256,
    borderRadius: 24,
    padding: 26,
    overflow: 'hidden',
  },
  court: {
    position: 'absolute',
    top: 23,
    left: 28,
    right: 28,
    bottom: 58,
    borderWidth: 1.5,
    borderColor: '#9FC3A9',
    transform: [{ rotate: '-8deg' }],
  },
  singles: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '13%',
    right: '13%',
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: '#9FC3A9',
  },
  serviceBox: {
    position: 'absolute',
    top: '23%',
    bottom: '23%',
    left: '13%',
    right: '13%',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#9FC3A9',
  },
  centerLine: {
    position: 'absolute',
    top: '23%',
    bottom: '23%',
    left: '50%',
    width: 1.5,
    backgroundColor: '#9FC3A9',
  },
  net: {
    position: 'absolute',
    top: '50%',
    left: -10,
    right: -10,
    height: 2,
    backgroundColor: '#FFFFFF',
  },
  ball: {
    position: 'absolute',
    right: 37,
    bottom: 55,
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: colors.lime,
  },
  heroLabel: {
    position: 'absolute',
    bottom: 22,
    left: 26,
    color: colors.lime,
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 10,
  },
  notice: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    borderRadius: 18,
    gap: 8,
    backgroundColor: colors.surface,
  },
  noticeTitle: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  noticeText: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  devLink: {
    color: colors.green,
    paddingVertical: 12,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

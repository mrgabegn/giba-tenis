import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  canSelectStart,
  clockTime,
  gameDuration,
  minutes,
  monthDates,
  type AvailabilityResponse,
  type GameModality,
} from '@giba-quadra/contracts';
import { formatCourtDate, todayAtCourt } from '../calendar/dates';
import { MonthCalendar } from '../components/MonthCalendar';
import { CalendarAccessError, fetchAvailability } from '../services/availability';
import { colors } from '../theme';

export default function CalendarScreen() {
  const [today] = useState(() => todayAtCourt());
  const [token, setToken] = useState('');
  const [draftToken, setDraftToken] = useState('');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [modality, setModality] = useState<GameModality>('singles');
  const [date, setDate] = useState(today);
  const [start, setStart] = useState('');
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selection, setSelection] = useState<AvailabilityResponse['selection']>();
  const selectionController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    setSelection(undefined);
    fetchAvailability({ token, month, modality, signal: controller.signal })
      .then((body) => {
        if (controller.signal.aborted) return;
        setData(body);
        setDate((current) =>
          body.days.some((day) => day.date === current && day.status !== 'past')
            ? current
            : (body.days.find((day) => day.status === 'available')?.date ?? body.days[0]!.date),
        );
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        if (failure instanceof CalendarAccessError) setToken('');
        setError(
          failure instanceof Error ? failure.message : 'Não foi possível carregar os horários.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, month, modality, refresh]);

  useEffect(() => {
    selectionController.current?.abort();
    setChecking(false);
    setSelection(undefined);
    return () => selectionController.current?.abort();
  }, [token, month, modality, date, start, refresh]);

  const current = data?.month === month && data.modality === modality ? data : null;
  const day = current?.days.find((item) => item.date === date);
  const duration = gameDuration[modality];
  const valid = !!day && canSelectStart(day, start, duration);

  async function selectTime() {
    if (!valid || checking) return;
    const controller = new AbortController();
    selectionController.current?.abort();
    selectionController.current = controller;
    setChecking(true);
    setError('');
    setSelection(undefined);
    try {
      const body = await fetchAvailability({
        token,
        month,
        modality,
        selection: { date, start },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setData(body);
      if (body.selection?.available) setSelection(body.selection);
      else setError('Esse horário não está mais disponível. Escolha outro início livre.');
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure instanceof CalendarAccessError) setToken('');
      setError(
        failure instanceof Error ? failure.message : 'Não foi possível verificar esse horário.',
      );
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }

  function chooseDate(value: string) {
    setDate(value);
    setStart('');
    setError('');
  }

  function changeModality(value: GameModality) {
    setModality(value);
    setStart('');
  }

  const errorNotice = error ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {error}
    </Text>
  ) : null;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safe}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>SUA PRÓXIMA PARTIDA</Text>
          <Text style={styles.title}>Um dia. Um horário.{'\n'}A quadra é o destino.</Text>
          {!token ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Acesso dos sócios</Text>
              <Text style={styles.body}>
                Use o código fornecido pela administração para consultar a agenda da quadra.
              </Text>
              <TextInput
                accessibilityLabel="Código de acesso"
                placeholder="Código de acesso"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={64}
                value={draftToken}
                onChangeText={setDraftToken}
                style={styles.input}
                onSubmitEditing={() => {
                  const value = draftToken.trim().toLowerCase();
                  if (/^[a-f0-9]{64}$/.test(value)) {
                    setToken(value);
                    setDraftToken('');
                  } else setError('Confira o código de acesso fornecido pela administração.');
                }}
              />
              {errorNotice}
              <Pressable
                accessibilityRole="button"
                style={styles.primary}
                onPress={() => {
                  const value = draftToken.trim().toLowerCase();
                  if (!/^[a-f0-9]{64}$/.test(value)) {
                    setError('Confira o código de acesso fornecido pela administração.');
                    return;
                  }
                  setToken(value);
                  setDraftToken('');
                }}
              >
                <Text style={styles.primaryText}>Abrir calendário →</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.modalityRow}>
                {(
                  [
                    { value: 'singles', label: 'Simples', detail: '1h30 de jogo' },
                    { value: 'doubles', label: 'Duplas', detail: '2h de jogo' },
                  ] as const
                ).map((option) => (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: modality === option.value }}
                    onPress={() => changeModality(option.value)}
                    style={[styles.modality, modality === option.value && styles.activeModality]}
                  >
                    <Text style={[styles.modalityTitle, modality === option.value && styles.white]}>
                      {option.label}
                    </Text>
                    <Text style={[styles.small, modality === option.value && styles.white]}>
                      {option.detail}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <MonthCalendar
                month={month}
                today={current?.today ?? today}
                days={
                  current?.days ??
                  monthDates(month).map((value) => ({
                    date: value,
                    status: 'closed',
                    windows: [],
                    startTimes: null,
                    freeRanges: [],
                    occupancies: [],
                  }))
                }
                selectedDate={date}
                loading={loading || !current}
                onMonthChange={(value) => {
                  setMonth(value);
                  setStart('');
                }}
                onSelectDate={chooseDate}
              />
              {loading && (
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel="Consultando horários"
                  style={styles.loading}
                >
                  <ActivityIndicator color={colors.green} />
                  <Text style={styles.body}>Consultando horários…</Text>
                </View>
              )}
              {errorNotice}
              {day && !loading && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>
                    {formatCourtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
                  </Text>
                  <Text style={styles.small}>Horários locais da quadra</Text>
                  {day.status === 'closed' ? (
                    <Text style={styles.body}>A quadra está fechada neste dia.</Text>
                  ) : day.status === 'past' ? (
                    <Text style={styles.body}>Escolha uma data a partir de hoje.</Text>
                  ) : (
                    <>
                      <Text style={styles.body}>
                        Funcionamento:{' '}
                        {day.windows.map((window) => `${window.start}–${window.end}`).join(' · ')}
                      </Text>
                      {day.status === 'full' ? (
                        <Text style={styles.body}>
                          Sem horário livre para {modality === 'singles' ? '1h30' : '2h'} de jogo
                          neste dia. Experimente outra data ou modalidade.
                        </Text>
                      ) : day.startTimes !== null ? (
                        <>
                          <Text style={styles.label}>Escolha um início liberado</Text>
                          <View style={styles.times}>
                            {day.startTimes.map((time) => {
                              const available = canSelectStart(day, time, duration);
                              return (
                                <Pressable
                                  key={time}
                                  accessibilityRole="button"
                                  accessibilityLabel={`${time}, ${available ? 'disponível' : 'indisponível'}`}
                                  accessibilityState={{
                                    selected: start === time,
                                    disabled: !available,
                                  }}
                                  disabled={!available}
                                  onPress={() => {
                                    setStart(time);
                                    setError('');
                                  }}
                                  style={[
                                    styles.time,
                                    start === time && styles.activeModality,
                                    !available && styles.disabled,
                                  ]}
                                >
                                  <Text
                                    style={[styles.modalityTitle, start === time && styles.white]}
                                  >
                                    {time}
                                  </Text>
                                  <Text style={[styles.small, start === time && styles.white]}>
                                    {available ? 'Livre' : 'Indisponível'}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={styles.label}>Períodos livres para seu jogo</Text>
                          {day.freeRanges.map((range) => (
                            <Pressable
                              key={`${range.start}-${range.end}`}
                              accessibilityRole="button"
                              accessibilityLabel={`Período livre das ${range.start} às ${range.end}. Escolher início às ${range.start}`}
                              onPress={() => {
                                setStart(range.start);
                                setError('');
                              }}
                              style={styles.range}
                            >
                              <Text style={styles.rangeText}>
                                {range.start} – {range.end}
                              </Text>
                              <Text style={styles.small}>Iniciar às {range.start} →</Text>
                            </Pressable>
                          ))}
                          <Text style={styles.label}>Horário de início (HH:MM)</Text>
                          <TextInput
                            accessibilityLabel="Horário de início (HH:MM)"
                            value={start}
                            onChangeText={(value) => {
                              setStart(value.replace(/[^0-9:]/g, '').slice(0, 5));
                              setError('');
                            }}
                            autoCorrect={false}
                            autoCapitalize="none"
                            placeholder="Ex.: 07:00"
                            placeholderTextColor={colors.muted}
                            maxLength={5}
                            style={styles.input}
                            keyboardType="numbers-and-punctuation"
                          />
                          <Text style={styles.small}>
                            Escolha um início que comporte todo o jogo dentro de um período livre.
                          </Text>
                        </>
                      )}
                      {day.occupancies.length > 0 && (
                        <View style={styles.occupancies}>
                          <Text style={styles.label}>Períodos ocupados</Text>
                          {day.occupancies.map((occupied, index) => (
                            <Text key={index} style={styles.body}>
                              {occupied.start} – {occupied.end} · Reservado
                              {occupied.responsibleName ? ` · ${occupied.responsibleName}` : ''}
                            </Text>
                          ))}
                        </View>
                      )}
                      {day.status === 'available' && (
                        <>
                          {!!start && (
                            <Text
                              accessibilityLiveRegion="polite"
                              style={valid ? styles.rangeText : styles.error}
                            >
                              {valid
                                ? `Seu jogo termina às ${clockTime(minutes(start) + duration)}.`
                                : 'Início indisponível para essa modalidade. Confira os períodos livres.'}
                            </Text>
                          )}
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ disabled: !valid || checking }}
                            disabled={!valid || checking}
                            onPress={() => void selectTime()}
                            style={[styles.primary, (!valid || checking) && styles.disabled]}
                          >
                            {checking ? (
                              <ActivityIndicator color={colors.surface} />
                            ) : (
                              <Text style={styles.primaryText}>Selecionar horário →</Text>
                            )}
                          </Pressable>
                        </>
                      )}
                    </>
                  )}
                </View>
              )}
              {selection?.available && selection.date === date && selection.start === start && (
                <View accessibilityLiveRegion="polite" style={styles.summary}>
                  <Text style={styles.summaryEyebrow}>HORÁRIO SELECIONADO</Text>
                  <Text style={styles.summaryTitle}>
                    {formatCourtDate(selection.date, { day: 'numeric', month: 'long' })}
                  </Text>
                  <Text style={styles.summaryTitle}>
                    {selection.start} – {selection.end}
                  </Text>
                  <Text style={styles.white}>
                    {modality === 'singles' ? 'Simples · 1h30' : 'Duplas · 2h'}
                  </Text>
                  <Text style={styles.summaryNote}>
                    Disponibilidade verificada agora. Esta seleção ainda não cria uma reserva.
                  </Text>
                </View>
              )}
              <View style={styles.footer}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setStart('');
                    setRefresh((value) => value + 1);
                  }}
                  disabled={loading}
                  style={styles.textButton}
                >
                  <Text style={styles.link}>Atualizar horários</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setToken('');
                    setData(null);
                    setStart('');
                    setError('');
                  }}
                  style={styles.textButton}
                >
                  <Text style={styles.link}>Sair da agenda</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 22,
    gap: 20,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingBottom: 40,
  },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: '700', letterSpacing: 2.2 },
  title: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    color: colors.ink,
    fontSize: 16,
    minHeight: 50,
  },
  primary: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  primaryText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  modalityRow: { flexDirection: 'row', gap: 12 },
  modality: {
    flex: 1,
    padding: 16,
    gap: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalityTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  activeModality: { backgroundColor: colors.green, borderColor: colors.green },
  white: { color: colors.surface },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  time: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 4,
    minWidth: 88,
  },
  range: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    borderRadius: 12,
    gap: 4,
  },
  rangeText: { color: colors.green, fontSize: 14, fontWeight: '600' },
  occupancies: { gap: 8, borderTopWidth: 1, borderColor: colors.border, paddingTop: 14 },
  disabled: { opacity: 0.4 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 22 },
  loading: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  summary: { backgroundColor: colors.green, borderRadius: 22, padding: 24, gap: 10 },
  summaryEyebrow: { color: colors.lime, fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  summaryTitle: { color: colors.surface, fontSize: 25, fontWeight: '700' },
  summaryNote: { color: colors.surface, fontSize: 12, lineHeight: 19, opacity: 0.9, marginTop: 4 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  textButton: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.green, fontSize: 14, textDecorationLine: 'underline' },
});

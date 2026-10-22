import { athleteManager } from '../services/athleteManager';
import { intervalsApi, IntervalsActivityResponse } from '../services/intervalsApi';
import { evolutionApi } from '../services/evolutionApi';
import { CompletedActivityRecord } from '../database';
import { getLocalDateString } from './dailyDispatcher';

/**
 * Converte segundos por quilômetro para formato mm:ss/km
 */
export function formatPace(secPerKm: number | null): string {
  if (!secPerKm || isNaN(secPerKm) || secPerKm <= 0) return '--:--/km';
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

/**
 * Converte segundos totais para hh:mm:ss ou mm:ss
 */
export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0 min';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

/**
 * Formata mensagem de feedback noturno do WhatsApp
 */
export function formatReconciliationMessage(
  athleteName: string,
  date: string,
  activities: CompletedActivityRecord[]
): string {
  const parts: string[] = [];

  parts.push(`🌙 *FEEDBACK DE TREINOS - ${athleteName.toUpperCase()}* 🏁`);
  parts.push(`🗓️ *Data:* ${date}`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);

  if (activities.length === 0) {
    parts.push(`Nenhuma atividade registrada no Intervals.icu para hoje.`);
    parts.push(`Descanse bem e recupere as energias para amanhã! 💪`);
  } else {
    parts.push(`Identificamos *${activities.length}* atividade(s) concluída(s) hoje:\n`);

    activities.forEach((act, index) => {
      const distKm = act.distance_meters ? (act.distance_meters / 1000).toFixed(2) : '0.00';
      const paceFormatted = formatPace(act.avg_pace_sec_km);
      const durationFormatted = formatDuration(act.moving_time_seconds);

      parts.push(`*#${index + 1} - ${act.name || act.type || 'Atividade'}*`);
      parts.push(`• 🏃 Tipo: ${act.type || 'Geral'}`);
      parts.push(`• 📏 Distância: *${distKm} km*`);
      parts.push(`• ⏱️ Tempo: *${durationFormatted}*`);
      parts.push(`• ⚡ Pace Médio: *${paceFormatted}*`);
      if (act.avg_hr) parts.push(`• ❤️ FC Média: *${Math.round(act.avg_hr)} bpm*`);
      if (act.load) parts.push(`• 📊 Carga Interna (Load): *${Math.round(act.load)}*`);
      if (act.rpe) parts.push(`• 🧠 PSE (RPE): *${act.rpe}/10*`);
      parts.push(``);
    });

    parts.push(`Parabéns pela dedicação e consistência! 🚀`);
  }

  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  return parts.join('\n');
}

/**
 * Executa a reconciliação noturna com Intervals.icu
 */
export async function runIntervalsSync(targetDate?: string): Promise<void> {
  const dateStr = targetDate || getLocalDateString();
  console.log(`[IntervalsSync] Iniciando reconciliação noturna para ${dateStr}...`);

  const athletes = athleteManager.getAllAthletes(true);

  for (const athlete of athletes) {
    if (!athlete.intervals_athlete_id || !athlete.intervals_api_key) {
      console.log(`[IntervalsSync] Atleta ${athlete.name} sem credenciais do Intervals.icu configuradas. Pulando.`);
      continue;
    }

    try {
      console.log(`[IntervalsSync] Consultando atividades de ${athlete.name} (${athlete.intervals_athlete_id})...`);
      const apiActivities: IntervalsActivityResponse[] = await intervalsApi.getActivities(
        athlete.intervals_athlete_id,
        athlete.intervals_api_key,
        dateStr,
        dateStr
      );

      const savedRecords: CompletedActivityRecord[] = [];

      for (const act of apiActivities) {
        // Cálculo do pace em segundos por km:
        // average_speed em m/s => sec/km = 1000 / average_speed
        let paceSecKm: number | null = null;
        if (act.average_speed && act.average_speed > 0) {
          paceSecKm = 1000 / act.average_speed;
        } else if (act.moving_time && act.distance && act.distance > 0) {
          paceSecKm = (act.moving_time / act.distance) * 1000;
        }

        const record: CompletedActivityRecord = {
          id: String(act.id),
          athlete_id: athlete.id,
          date: dateStr,
          name: act.name || 'Treino',
          type: act.type || 'Workout',
          distance_meters: act.distance ?? 0,
          moving_time_seconds: act.moving_time ?? act.elapsed_time ?? 0,
          avg_hr: act.average_heartrate ?? null,
          avg_pace_sec_km: paceSecKm,
          rpe: act.icu_rpe ?? null,
          load: act.icu_training_load ?? null,
        };

        athleteManager.saveCompletedActivity(record);
        savedRecords.push(record);
      }

      console.log(`[IntervalsSync] ${savedRecords.length} atividade(s) processada(s) para ${athlete.name}.`);

      // Envia resumo no WhatsApp se houver atividades concluídas
      if (savedRecords.length > 0 && athlete.whatsapp_number) {
        console.log(`[IntervalsSync] Enviando resumo de treinos para ${athlete.name} no WhatsApp...`);
        const message = formatReconciliationMessage(athlete.name, dateStr, savedRecords);
        const sent = await evolutionApi.sendTextMessage(athlete.whatsapp_number, message);
        if (sent) {
          console.log(`[IntervalsSync] ✅ Resumo de treino enviado para ${athlete.name}.`);
        } else {
          console.error(`[IntervalsSync] ❌ Falha ao enviar resumo de treino para ${athlete.name}.`);
        }
      }
    } catch (err: any) {
      console.error(`[IntervalsSync] Erro na reconciliação de ${athlete.name}: ${err.message}`);
    }
  }

  console.log(`[IntervalsSync] Reconciliação concluída para ${dateStr}.`);
}

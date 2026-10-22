import { athleteManager } from '../services/athleteManager';
import { evolutionApi } from '../services/evolutionApi';
import { weatherService, WeatherForecast } from '../services/weatherService';
import { ScheduledWorkoutRecord, RaceRecord } from '../database';

/**
 * Retorna a data no formato YYYY-MM-DD
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata a mensagem matinal de treino para o WhatsApp com clima e contagem de prova
 */
export function formatWorkoutMessage(
  athleteName: string,
  workout: ScheduledWorkoutRecord,
  weather: WeatherForecast | null,
  nextRace: RaceRecord | null
): string {
  const parts: string[] = [];

  parts.push(`🏃 *BOM DIA, ${athleteName.toUpperCase()}!* ☀️`);
  parts.push(`🗓️ *Treino do Dia:* ${workout.date}`);

  // 1. Previsão do Clima & Dica de Roupa
  if (weather) {
    parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
    parts.push(`🌤️ *Clima Agora em São Paulo:* ${weather.temp}°C (${weather.description})`);
    parts.push(`👕 *Dica:* ${weather.suggestion}`);
  }

  // 2. Countdown da Prova-Alvo
  if (nextRace) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const raceDate = new Date(nextRace.race_date + 'T00:00:00');
    const diffTime = raceDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0) {
      parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
      parts.push(`🏁 *PROVA ALVO:* ${nextRace.name} (${nextRace.distance_km}K)`);
      if (diffDays === 0) {
        parts.push(`🔥 *É HOJE!* Boa prova, dê o seu melhor e divirta-se!`);
      } else {
        const weeks = Math.floor(diffDays / 7);
        const days = diffDays % 7;
        const weekTxt = weeks > 0 ? `${weeks} sem e ${days} dias` : `${days} dias`;
        parts.push(`⏳ *Faltam ${diffDays} dias* (${weekTxt}) para a sua largada!`);
      }
    }
  }

  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);

  if (workout.focus) {
    parts.push(`🎯 *Foco:* ${workout.focus}`);
  }

  if (workout.target_km) {
    parts.push(`📏 *Volume Previsto:* ${workout.target_km} km`);
  }

  if (workout.road_prescription && workout.road_prescription !== '—') {
    parts.push(`\n🛣️ *Opção Rua:*`);
    parts.push(workout.road_prescription.trim());
  }

  if (workout.treadmill_prescription && workout.treadmill_prescription !== '—') {
    parts.push(`\n🏃‍♂️ *Opção Esteira:*`);
    parts.push(workout.treadmill_prescription.trim());
  }

  if (workout.strength_work && workout.strength_work !== '—') {
    parts.push(`\n🏋️ *Musculação / Fortalecimento:*`);
    parts.push(workout.strength_work.trim());
  }

  if (workout.bike_work && workout.bike_work !== '—') {
    parts.push(`\n🚴 *Bike / Cross-training:*`);
    parts.push(workout.bike_work.trim());
  }

  if (workout.clinical_notes && workout.clinical_notes !== '—') {
    parts.push(`\n🩺 *Clínica & Cuidados:*`);
    parts.push(workout.clinical_notes.trim());
  }

  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  parts.push(`Tenha um excelente treino! Não esqueça de registrar seu relógio/aplicativo.`);

  return parts.join('\n');
}

/**
 * Executa o despacho diário matinal de treinos
 */
export async function runDailyDispatcher(targetDate?: string): Promise<void> {
  const dateStr = targetDate || getLocalDateString();
  console.log(`[DailyDispatcher] Iniciando verificação de treinos para ${dateStr}...`);

  const pending = await athleteManager.getPendingScheduledWorkoutsForDate(dateStr);

  if (pending.length === 0) {
    console.log(`[DailyDispatcher] Nenhum treino pendente de envio para ${dateStr}.`);
    return;
  }

  console.log(`[DailyDispatcher] ${pending.length} treino(s) pendente(s) encontrado(s).`);

  // Consulta previsão do tempo uma vez para os envios da manhã
  const weather = await weatherService.getMorningForecast();

  for (const item of pending) {
    try {
      console.log(`[DailyDispatcher] Enviando treino para ${item.athlete_name} (${item.whatsapp_number})...`);

      // Busca próxima prova do atleta
      const races = await athleteManager.getRacesByAthlete(item.athlete_id);
      const nextRace = races.find((r) => r.race_date >= dateStr) || (races.length > 0 ? races[0] : null);

      const message = formatWorkoutMessage(item.athlete_name, item, weather, nextRace);

      const success = await evolutionApi.sendTextMessage(item.whatsapp_number, message);

      if (success) {
        await athleteManager.markWorkoutAsSent(item.id);
        console.log(`[DailyDispatcher] ✅ Treino ID ${item.id} enviado com sucesso para ${item.athlete_name}.`);
      } else {
        console.error(`[DailyDispatcher] ❌ Falha no envio do treino ID ${item.id} para ${item.athlete_name}.`);
      }
    } catch (err: any) {
      console.error(`[DailyDispatcher] Erro ao processar treino ID ${item.id}: ${err.message}`);
    }
  }
}

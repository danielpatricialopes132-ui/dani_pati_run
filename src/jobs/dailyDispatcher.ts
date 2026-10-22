import { athleteManager } from '../services/athleteManager';
import { evolutionApi } from '../services/evolutionApi';
import { ScheduledWorkoutRecord } from '../database';

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
 * Formata a mensagem matinal de treino para o WhatsApp
 */
export function formatWorkoutMessage(athleteName: string, workout: ScheduledWorkoutRecord): string {
  const parts: string[] = [];

  parts.push(`🏃 *BOM DIA, ${athleteName.toUpperCase()}!* ☀️`);
  parts.push(`🗓️ *Treino do Dia:* ${workout.date}`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);

  if (workout.focus) {
    parts.push(`🎯 *Foco:* ${workout.focus}`);
  }

  if (workout.target_km) {
    parts.push(`📏 *Volume Previsto:* ${workout.target_km} km`);
  }

  if (workout.road_prescription) {
    parts.push(`\n🛣️ *Opção Rua:*`);
    parts.push(workout.road_prescription.trim());
  }

  if (workout.treadmill_prescription) {
    parts.push(`\n🏃‍♂️ *Opção Esteira:*`);
    parts.push(workout.treadmill_prescription.trim());
  }

  if (workout.strength_work) {
    parts.push(`\n🏋️ *Musculação / Fortalecimento:*`);
    parts.push(workout.strength_work.trim());
  }

  if (workout.bike_work) {
    parts.push(`\n🚴 *Bike / Cross-training:*`);
    parts.push(workout.bike_work.trim());
  }

  if (workout.clinical_notes) {
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

  const pending = athleteManager.getPendingScheduledWorkoutsForDate(dateStr);

  if (pending.length === 0) {
    console.log(`[DailyDispatcher] Nenhum treino pendente de envio para ${dateStr}.`);
    return;
  }

  console.log(`[DailyDispatcher] ${pending.length} treino(s) pendente(s) encontrado(s).`);

  for (const item of pending) {
    try {
      console.log(`[DailyDispatcher] Enviando treino para ${item.athlete_name} (${item.whatsapp_number})...`);
      const message = formatWorkoutMessage(item.athlete_name, item);

      const success = await evolutionApi.sendTextMessage(item.whatsapp_number, message);

      if (success) {
        athleteManager.markWorkoutAsSent(item.id);
        console.log(`[DailyDispatcher] ✅ Treino ID ${item.id} enviado com sucesso para ${item.athlete_name}.`);
      } else {
        console.error(`[DailyDispatcher] ❌ Falha no envio do treino ID ${item.id} para ${item.athlete_name}.`);
      }
    } catch (err: any) {
      console.error(`[DailyDispatcher] Erro ao processar treino ID ${item.id}: ${err.message}`);
    }
  }
}

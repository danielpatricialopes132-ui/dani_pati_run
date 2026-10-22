import cron from 'node-cron';
import { athleteManager } from './services/athleteManager';
import { runDailyDispatcher } from './jobs/dailyDispatcher';
import { runIntervalsSync } from './jobs/intervalsSync';
import { config } from './config';
import { initDatabase } from './database';
import { createServer } from './server';

function startScheduler() {
  console.log('[Scheduler] Inicializando agendador de tarefas cron...');

  // 1. Job padrão matinal das 06:30 (WhatsApp)
  cron.schedule('30 6 * * *', async () => {
    console.log('[Scheduler] Executando rotina matinal padrão das 06:30...');
    try {
      await runDailyDispatcher();
    } catch (err: any) {
      console.error(`[Scheduler] Erro no job matinal: ${err.message}`);
    }
  });

  // 2. Verificação de horários personalizados (por minuto)
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}`;

    if (currentTime === '06:30') return;

    try {
      const athletes = await athleteManager.getAllAthletes(true);
      const customAthletes = athletes.filter(
        (a) => a.notify_time && a.notify_time === currentTime && a.notify_time !== '06:30'
      );

      if (customAthletes.length > 0) {
        console.log(`[Scheduler] Executando lembrete em horário personalizado (${currentTime}) para: ${customAthletes.map(a => a.name).join(', ')}`);
        await runDailyDispatcher();
      }
    } catch (err: any) {
      console.error(`[Scheduler] Erro no scheduler minuto: ${err.message}`);
    }
  });

  // 3. Job noturno das 22:00 (Reconciliação Intervals.icu)
  cron.schedule('0 22 * * *', async () => {
    console.log('[Scheduler] Executando rotina noturna das 22:00 (Reconciliação Intervals.icu)...');
    try {
      await runIntervalsSync();
    } catch (err: any) {
      console.error(`[Scheduler] Erro no job noturno: ${err.message}`);
    }
  });

  console.log('[Scheduler] ✅ Agendador ativo:');
  console.log('   - 06:30: Lembrete Matinal de Treinos (WhatsApp)');
  console.log('   - 22:00: Reconciliação Noturna de Atividades (Intervals.icu)');
}

async function main() {
  console.log('========================================================');
  console.log('🏃 workout-controller - Sistema de Treinos, PWA & Sync');
  console.log('========================================================');
  console.log(`Ambiente: ${config.nodeEnv}`);
  console.log(`Evolution API: ${config.evolution.baseUrl} (Instância: ${config.evolution.instanceName})`);

  // Inicializa o banco de dados no Supabase e sementes iniciais
  try {
    console.log('[Database] Conectando ao PostgreSQL do Supabase...');
    await initDatabase();
    console.log('[Database] ✅ Conexão e tabelas Supabase verificadas com sucesso.');

    const athletes = await athleteManager.getAllAthletes(false);
    console.log(`[Database] ${athletes.length} atleta(s) registrado(s):`);
    athletes.forEach((a) => {
      console.log(`  - ${a.name} (${a.id}) | WhatsApp: ${a.whatsapp_number} | Intervals ID: ${a.intervals_athlete_id || 'N/A'}`);
    });
  } catch (dbErr: any) {
    console.error('[Database] ⚠️ Erro ao conectar ao banco de dados Supabase:', dbErr.message);
  }

  // Inicializa os jobs em background
  startScheduler();

  // Inicializa o servidor HTTP Express para PWA e API
  const app = createServer();
  const server = app.listen(config.port, () => {
    console.log(`[PWA Server] 🌐 Servidor web rodando em: http://localhost:${config.port}`);
    console.log(`[PWA Server] 📱 Abra no navegador ou instale no celular (Chrome / Safari PWA)`);
  });

  const gracefulShutdown = () => {
    console.log('\n[Daemon] Encerrando workout-controller suavemente...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

main().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});

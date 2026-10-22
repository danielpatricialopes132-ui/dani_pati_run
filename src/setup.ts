import readline from 'readline';
import { athleteManager } from './services/athleteManager';
import { runDailyDispatcher, getLocalDateString } from './jobs/dailyDispatcher';
import { runIntervalsSync } from './jobs/intervalsSync';
import { evolutionApi } from './services/evolutionApi';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function listAthletes() {
  console.log('\n================== ATLETAS CADASTRADOS ==================');
  const athletes = athleteManager.getAllAthletes(false);
  if (athletes.length === 0) {
    console.log('Nenhum atleta cadastrado.');
  } else {
    console.table(
      athletes.map((a) => ({
        ID: a.id,
        Nome: a.name,
        WhatsApp: a.whatsapp_number,
        'Intervals ID': a.intervals_athlete_id || 'Não definido',
        'Notificação': a.notify_time,
        Ativo: a.active ? 'Sim' : 'Não',
      }))
    );
  }
}

async function createOrUpdateAthlete() {
  console.log('\n================== CADASTRAR / EDITAR ATLETA ==================');
  const idInput = await question('ID do Atleta (ex: daniel, patricia): ');
  const id = idInput.trim().toLowerCase();
  if (!id) {
    console.log('ID inválido.');
    return;
  }

  const existing = athleteManager.getAthleteById(id);
  if (existing) {
    console.log(`\nAtleta existente encontrado: [${existing.name}]`);
    console.log('Pressione ENTER sem digitar nada para manter o valor atual.');
  }

  const name = await question(`Nome [${existing?.name || ''}]: `);
  const whatsapp = await question(`WhatsApp (com DDI e DDD) [${existing?.whatsapp_number || ''}]: `);
  const intervalsId = await question(`Intervals.icu Athlete ID [${existing?.intervals_athlete_id || ''}]: `);
  const intervalsKey = await question(`Intervals.icu API Key [${existing?.intervals_api_key || ''}]: `);
  const notifyTime = await question(`Horário Lembrete (HH:MM) [${existing?.notify_time || '06:30'}]: `);
  const activeInput = await question(`Ativo? (1 = Sim, 0 = Não) [${existing ? existing.active : 1}]: `);

  const updated = athleteManager.upsertAthlete({
    id,
    name: name.trim() || (existing ? existing.name : id),
    whatsapp_number: whatsapp.trim() || (existing ? existing.whatsapp_number : ''),
    intervals_athlete_id: intervalsId.trim() || (existing ? existing.intervals_athlete_id : null),
    intervals_api_key: intervalsKey.trim() || (existing ? existing.intervals_api_key : null),
    notify_time: notifyTime.trim() || (existing ? existing.notify_time : '06:30'),
    active: activeInput.trim() !== '' ? parseInt(activeInput.trim(), 10) : existing ? existing.active : 1,
  });

  console.log('\n✅ Atleta salvo com sucesso!');
  console.log(JSON.stringify(updated, null, 2));
}

async function addWorkoutManually() {
  console.log('\n================== AGENDAR NOVO TREINO ==================');
  const athletes = athleteManager.getAllAthletes(true);
  if (athletes.length === 0) {
    console.log('Nenhum atleta ativo cadastrado.');
    return;
  }

  console.log('Selecione o atleta:');
  athletes.forEach((a, idx) => console.log(`  ${idx + 1}. ${a.name} (${a.id})`));

  const sel = await question('Escolha o número ou digite o ID: ');
  const athlete =
    athletes[parseInt(sel, 10) - 1] || athleteManager.getAthleteById(sel.trim().toLowerCase());

  if (!athlete) {
    console.log('Atleta inválido.');
    return;
  }

  const todayStr = getLocalDateString();
  const dateInput = await question(`Data do treino (YYYY-MM-DD) [${todayStr}]: `);
  const date = dateInput.trim() || todayStr;

  const focus = await question('Foco do treino (ex: Tiro curto, Rodagem Z2, Longão): ');
  const kmInput = await question('KM previsto (ex: 10.5): ');
  const road = await question('Opção Rua (prescrição): ');
  const treadmill = await question('Opção Esteira (prescrição): ');
  const strength = await question('Musculação / Fortalecimento: ');
  const bike = await question('Bike / Cross-training: ');
  const notes = await question('Notas Clínicas / Orientações: ');

  const workoutId = `wk_${athlete.id}_${date}_${Date.now()}`;

  athleteManager.addScheduledWorkout({
    id: workoutId,
    athlete_id: athlete.id,
    date,
    focus: focus.trim() || null,
    target_km: kmInput ? parseFloat(kmInput.replace(',', '.')) : null,
    road_prescription: road.trim() || null,
    treadmill_prescription: treadmill.trim() || null,
    strength_work: strength.trim() || null,
    bike_work: bike.trim() || null,
    clinical_notes: notes.trim() || null,
    whatsapp_sent: 0,
  });

  console.log(`\n✅ Treino [${workoutId}] agendado para ${athlete.name} em ${date}!`);
}

async function testWhatsappSend() {
  console.log('\n================== TESTAR ENVIO WHATSAPP ==================');
  const number = await question('Número de telefone (ex: 5511988139833): ');
  const text = await question('Mensagem de teste: ');

  console.log('Disparando via Evolution API...');
  const success = await evolutionApi.sendTextMessage(number.trim(), text || 'Teste do Workout Controller!');
  if (success) {
    console.log('✅ Mensagem enviada com sucesso!');
  } else {
    console.log('❌ Falha ao enviar mensagem. Verifique a URL e a API Key da Evolution API no .env.');
  }
}

async function testJobsManually() {
  console.log('\n================== TESTAR ROTINAS AGORA ==================');
  console.log('1. Executar Lembrete Matinal (WhatsApp)');
  console.log('2. Executar Reconciliação Noturna (Intervals.icu)');
  const opt = await question('Opção: ');

  if (opt.trim() === '1') {
    await runDailyDispatcher();
  } else if (opt.trim() === '2') {
    await runIntervalsSync();
  } else {
    console.log('Opção inválida.');
  }
}

async function main() {
  console.log('\n🏃‍♂️ BEM-VINDO AO WORKOUT-CONTROLLER SETUP CLI 🏃‍♀️');

  let running = true;
  while (running) {
    console.log('\n----------------- MENU PRINCIPAL -----------------');
    console.log('1. Listar Atletas');
    console.log('2. Cadastrar ou Atualizar Atleta');
    console.log('3. Agendar Treino');
    console.log('4. Testar Disparo WhatsApp');
    console.log('5. Executar Rotinas Cron Manualmente');
    console.log('6. Sair');

    const choice = await question('\nSelecione uma opção (1-6): ');

    switch (choice.trim()) {
      case '1':
        await listAthletes();
        break;
      case '2':
        await createOrUpdateAthlete();
        break;
      case '3':
        await addWorkoutManually();
        break;
      case '4':
        await testWhatsappSend();
        break;
      case '5':
        await testJobsManually();
        break;
      case '6':
        running = false;
        break;
      default:
        console.log('Opção inválida.');
    }
  }

  rl.close();
  console.log('\nSetup finalizado. Até mais!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro no setup CLI:', err);
  rl.close();
  process.exit(1);
});

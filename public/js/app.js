// Estado Global da Aplicação
let currentAthleteId = 'daniel'; // 'daniel', 'patricia', 'casal'
let currentView = 'today'; // 'today', 'reports'
let volumeChartInstance = null;
let dashboardStatsData = null;

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration error:', err);
    });
  });
}

// Utilitários de formatação
function formatPace(secPerKm) {
  if (!secPerKm || isNaN(secPerKm) || secPerKm <= 0) return '--:--/km';
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0 min';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  setupAthleteTabs();
  setupNavViews();
  setupActionButtons();
  setupStoryModal();
  loadAll();
});

// Alternância de Tema & Atleta
function setupAthleteTabs() {
  const tabs = document.querySelectorAll('.athlete-tab');
  const body = document.body;
  const brandTitle = document.getElementById('brand-title');
  const brandBadge = document.getElementById('brand-badge');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentAthleteId = tab.dataset.id;

      // Altera o tema no body (CSS custom variables)
      body.setAttribute('data-theme', currentAthleteId);

      if (currentAthleteId === 'daniel') {
        brandTitle.textContent = 'DANIEL RUN (FLA)';
        brandBadge.textContent = '🔴⚫';
      } else if (currentAthleteId === 'patricia') {
        brandTitle.textContent = 'PATRÍCIA RUN (GRÊMIO)';
        brandBadge.textContent = '🔵⚪';
      } else {
        brandTitle.textContent = 'DANI & PATI CASAL';
        brandBadge.textContent = '💛';
      }

      loadAll();
    });
  });
}

// Navegação entre Visão de Hoje e Hub de Relatórios
function setupNavViews() {
  const btnToday = document.getElementById('tab-today-view');
  const btnReports = document.getElementById('tab-reports-view');
  const containerToday = document.getElementById('view-today-container');
  const containerReports = document.getElementById('view-reports-container');

  btnToday.addEventListener('click', () => {
    btnToday.classList.add('active');
    btnReports.classList.remove('active');
    currentView = 'today';
    containerToday.style.display = 'block';
    containerReports.style.display = 'none';
  });

  btnReports.addEventListener('click', () => {
    btnReports.classList.add('active');
    btnToday.classList.remove('active');
    currentView = 'reports';
    containerToday.style.display = 'none';
    containerReports.style.display = 'flex';
    renderReports();
  });
}

function setupActionButtons() {
  const btnSync = document.getElementById('btn-sync-intervals');
  const btnWhatsapp = document.getElementById('btn-send-whatsapp');

  btnSync.addEventListener('click', async () => {
    btnSync.disabled = true;
    btnSync.innerHTML = '<span>⏳</span> Sincronizando...';
    try {
      const res = await fetch('/api/actions/sync-intervals', { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Sincronização concluída!');
      loadAll();
    } catch (e) {
      alert('Erro ao sincronizar: ' + e.message);
    } finally {
      btnSync.disabled = false;
      btnSync.innerHTML = '<span>🔄</span> Sincronizar Intervals.icu';
    }
  });

  btnWhatsapp.addEventListener('click', async () => {
    btnWhatsapp.disabled = true;
    btnWhatsapp.innerHTML = '<span>⏳</span> Enviando...';
    try {
      const res = await fetch('/api/actions/send-morning-reminder', { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Lembrete enviado com sucesso!');
      loadAll();
    } catch (e) {
      alert('Erro ao enviar WhatsApp: ' + e.message);
    } finally {
      btnWhatsapp.disabled = false;
      btnWhatsapp.innerHTML = '<span>📲</span> Disparar WhatsApp';
    }
  });
}

async function loadAll() {
  await Promise.all([loadTodayData(), loadWeekData(), loadDashboardStats()]);
  if (currentView === 'reports') {
    renderReports();
  }
}

// Carregar Dados do Treino de Hoje
async function loadTodayData() {
  const statusBadge = document.getElementById('workout-status-badge');
  const workoutContent = document.getElementById('workout-content');
  const activitiesContent = document.getElementById('activities-content');
  const athleteQuery = currentAthleteId === 'casal' ? 'daniel' : currentAthleteId;

  try {
    const res = await fetch(`/api/athletes/${athleteQuery}/today`);
    const data = await res.json();

    // Renderizar Treino Prescrito
    if (data.workout) {
      statusBadge.textContent = data.workout.whatsapp_sent ? 'Enviado no WhatsApp' : 'Planejado';
      statusBadge.className = data.workout.whatsapp_sent ? 'badge badge-success' : 'badge badge-theme';

      let html = '';
      if (data.workout.focus) {
        html += `
          <div class="focus-banner">
            <div class="focus-label">Foco Principal</div>
            <div class="focus-value">${data.workout.focus}</div>
            ${data.workout.target_km ? `<div style="font-size: 14px; margin-top: 4px; color: #cbd5e1;">Volume Alvo: <strong>${data.workout.target_km} km</strong></div>` : ''}
          </div>
        `;
      }

      html += '<div class="prescription-group">';

      if (data.workout.road_prescription && data.workout.road_prescription !== '—') {
        html += `
          <div class="prescription-item">
            <div class="prescription-item-header"><span>🛣️</span> Opção Rua</div>
            <div class="prescription-item-content">${data.workout.road_prescription.replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }

      if (data.workout.treadmill_prescription && data.workout.treadmill_prescription !== '—') {
        html += `
          <div class="prescription-item">
            <div class="prescription-item-header"><span>🏃‍♂️</span> Opção Esteira</div>
            <div class="prescription-item-content">${data.workout.treadmill_prescription.replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }

      if (data.workout.strength_work && data.workout.strength_work !== '—') {
        html += `
          <div class="prescription-item">
            <div class="prescription-item-header"><span>🏋️</span> Fortalecimento / Musculação</div>
            <div class="prescription-item-content">${data.workout.strength_work.replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }

      if (data.workout.bike_work && data.workout.bike_work !== '—') {
        html += `
          <div class="prescription-item">
            <div class="prescription-item-header"><span>🚴</span> Bike / Cross-training</div>
            <div class="prescription-item-content">${data.workout.bike_work.replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }

      if (data.workout.clinical_notes && data.workout.clinical_notes !== '—') {
        html += `
          <div class="prescription-item">
            <div class="prescription-item-header"><span>🩺</span> Cuidados & Clínica</div>
            <div class="prescription-item-content">${data.workout.clinical_notes.replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }

      html += '</div>';
      workoutContent.innerHTML = html;
    } else {
      statusBadge.textContent = 'Descanso';
      statusBadge.className = 'badge';
      workoutContent.innerHTML = `
        <div style="text-align: center; padding: 25px 0; color: #94a3b8;">
          <div style="font-size: 32px; margin-bottom: 8px;">🛌</div>
          Nenhum treino prescrito para hoje. Dia livre ou de recuperação ativa!
        </div>
      `;
    }

    // Renderizar Atividades Concluídas
    if (data.activities && data.activities.length > 0) {
      let actHtml = '';
      data.activities.forEach((act) => {
        const distKm = act.distance_meters ? (Number(act.distance_meters) / 1000).toFixed(2) : '0.00';
        actHtml += `
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 14px; padding: 14px; margin-top: 10px;">
            <div style="font-weight: 700; color: #10b981; font-size: 15px; margin-bottom: 8px;">
              ✓ ${act.name || act.type || 'Treino Concluído'}
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
              <div style="background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 10px;">
                <div style="font-size: 11px; color: #94a3b8;">Distância</div>
                <div style="font-size: 16px; font-weight: 700; color: #fff;">${distKm} km</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 10px;">
                <div style="font-size: 11px; color: #94a3b8;">Pace Médio</div>
                <div style="font-size: 16px; font-weight: 700; color: #fff;">${formatPace(act.avg_pace_sec_km ? Number(act.avg_pace_sec_km) : null)}</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 10px;">
                <div style="font-size: 11px; color: #94a3b8;">Duração</div>
                <div style="font-size: 16px; font-weight: 700; color: #fff;">${formatDuration(act.moving_time_seconds ? Number(act.moving_time_seconds) : null)}</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 10px;">
                <div style="font-size: 11px; color: #94a3b8;">FC / Carga (Load)</div>
                <div style="font-size: 16px; font-weight: 700; color: #fff;">${act.avg_hr ? Math.round(Number(act.avg_hr)) + ' bpm' : '-'} / ${act.load ? Math.round(Number(act.load)) : '-'}</div>
              </div>
            </div>
          </div>
        `;
      });
      activitiesContent.innerHTML = actHtml;
    } else {
      activitiesContent.innerHTML = `
        <div style="text-align: center; padding: 15px 0; color: #64748b; font-size: 13px;">
          Nenhuma atividade concluída sincronizada ainda hoje.
        </div>
      `;
    }
  } catch (err) {
    console.error('Erro ao carregar dados de hoje:', err);
  }
}

// Carregar Visão Semanal
async function loadWeekData() {
  const weekGrid = document.getElementById('week-grid');
  const athleteQuery = currentAthleteId === 'casal' ? 'daniel' : currentAthleteId;

  try {
    const res = await fetch(`/api/athletes/${athleteQuery}/week`);
    const data = await res.json();

    let gridHtml = '';
    data.week.forEach((item) => {
      const dayNum = item.date.split('-')[2];
      const todayClass = item.isToday ? 'today' : '';
      const dotClass = item.status === 'COMPLETED' ? 'completed' : item.status === 'PLANNED' ? 'planned' : 'rest';

      gridHtml += `
        <div class="week-day ${todayClass}">
          <span class="week-day-name">${item.dayOfWeek}</span>
          <span class="week-day-date">${dayNum}</span>
          <span class="status-dot ${dotClass}" title="${item.status}"></span>
        </div>
      `;
    });

    weekGrid.innerHTML = gridHtml;
  } catch (err) {
    console.error('Erro ao carregar visão semanal:', err);
  }
}

// Carregar Estatísticas Consolidadas do Dashboard
async function loadDashboardStats() {
  try {
    const res = await fetch('/api/dashboard-stats');
    dashboardStatsData = await res.json();

    renderKpisToday();
    renderCoupleMeter();
    renderRacesCountdown();
    renderGamification();
  } catch (err) {
    console.error('Erro ao carregar estatísticas:', err);
  }
}

// Renderizar Countdown das Provas Alvo
function renderRacesCountdown() {
  const container = document.getElementById('races-countdown-content');
  if (!container || !dashboardStatsData || !dashboardStatsData.races) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredRaces = currentAthleteId === 'casal'
    ? dashboardStatsData.races
    : dashboardStatsData.races.filter((r) => r.athlete_id === currentAthleteId);

  if (filteredRaces.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 10px;">Nenhuma prova cadastrada para este atleta.</div>`;
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">
      ${filteredRaces.map((r) => {
        const raceDate = new Date(r.race_date + 'T00:00:00');
        const diffTime = raceDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isPast = diffDays < 0;

        const athleteColor = r.athlete_id === 'daniel' ? '#e11d48' : '#0284c7';
        const athleteIcon = r.athlete_id === 'daniel' ? '🔴' : '🔵';

        let badgeStatus = '';
        if (diffDays === 0) {
          badgeStatus = '<span style="color: #f59e0b; font-weight: 800;">🔥 É HOJE!</span>';
        } else if (diffDays > 0) {
          badgeStatus = `<span style="font-size: 18px; font-weight: 800; color: ${athleteColor};">Faltam ${diffDays} dias</span>`;
        } else {
          badgeStatus = '<span style="color: #10b981; font-weight: 700;">✓ Concluída</span>';
        }

        return `
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: 14px; padding: 14px; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: ${athleteColor};">
                ${athleteIcon} ${r.athlete_name || (r.athlete_id === 'daniel' ? 'Daniel' : 'Patrícia')} • ${r.priority || 'P1'}
              </span>
              <span style="font-size: 11px; color: var(--text-muted);">${r.race_date}</span>
            </div>
            <div style="font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 4px;">${r.name}</div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px;">
              <div style="font-size: 13px; color: var(--text-muted);">Alvo: <strong>${r.distance_km} km</strong> ${r.target_time ? `(${r.target_time})` : ''}</div>
              <div>${badgeStatus}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Renderizar Gamificação & Duelo Casal (Fla vs Grêmio)
function renderGamification() {
  const container = document.getElementById('gamification-content');
  if (!container || !dashboardStatsData) return;

  const dDone = dashboardStatsData.daniel.done;
  const pDone = dashboardStatsData.patricia.done;

  const dKm = parseFloat(dDone.total_km_done || 0);
  const pKm = parseFloat(pDone.total_km_done || 0);
  const totalCasalKm = (dKm + pKm).toFixed(1);

  // Meta do Casal de 1.500 km acumulados no ano
  const casalMeta = 1500;
  const metaPct = Math.min(100, ((parseFloat(totalCasalKm) / casalMeta) * 100)).toFixed(1);

  // Faixa da semana
  const badgeChamp = document.getElementById('badge-weekly-champion');
  let championText = '';
  if (dKm > pKm) {
    championText = '🔴 Líder: Mengão (Daniel)';
    if (badgeChamp) badgeChamp.textContent = 'Líder: Daniel (Fla)';
  } else if (pKm > dKm) {
    championText = '🔵 Líder: Tricolor (Patrícia)';
    if (badgeChamp) badgeChamp.textContent = 'Líder: Patrícia (Grêmio)';
  } else {
    championText = '🤝 Empate Perfeito no Casal!';
    if (badgeChamp) badgeChamp.textContent = 'Empate no Duelo';
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.03); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border-color);">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Status do Duelo da Semana</div>
          <div style="font-size: 15px; font-weight: 800; color: #fff; margin-top: 2px;">${championText}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: var(--text-muted);">Placar KM</div>
          <div style="font-size: 15px; font-weight: 800;">🔴 ${dKm.toFixed(1)}k <span style="color: var(--text-muted); font-weight: 400;">vs</span> 🔵 ${pKm.toFixed(1)}k</div>
        </div>
      </div>

      <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 14px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: #fbbf24;">🌟 Meta Casal: 1.500 km em 2026/2027</span>
          <span style="font-size: 13px; font-weight: 800; color: #fff;">${totalCasalKm} / 1500 km (${metaPct}%)</span>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); border-radius: 9999px; height: 10px; width: 100%; overflow: hidden;">
          <div style="background: linear-gradient(90deg, #e11d48, #f59e0b, #0284c7); height: 100%; width: ${metaPct}%; transition: width 0.6s ease;"></div>
        </div>
        <div style="font-size: 11px; color: #cbd5e1; margin-top: 8px;">
          🏃‍♂️ Daniel e Patrícia correndo juntos rumo aos grandes objetivos!
        </div>
      </div>
    </div>
  `;
}

// KPIs no topo
function renderKpisToday() {
  const kpiGrid = document.getElementById('kpi-grid-today');
  if (!dashboardStatsData) return;

  const dDone = dashboardStatsData.daniel.done;
  const dPlan = dashboardStatsData.daniel.planned;
  const pDone = dashboardStatsData.patricia.done;
  const pPlan = dashboardStatsData.patricia.planned;

  let totalKm = 0;
  let totalWorkouts = 0;
  let avgPace = 0;
  let totalLoad = 0;

  if (currentAthleteId === 'daniel') {
    totalKm = parseFloat(dDone.total_km_done || 0).toFixed(1);
    totalWorkouts = dDone.total_activities || 0;
    avgPace = formatPace(Number(dDone.avg_pace_sec));
    totalLoad = Math.round(Number(dDone.total_load || 0));
  } else if (currentAthleteId === 'patricia') {
    totalKm = parseFloat(pDone.total_km_done || 0).toFixed(1);
    totalWorkouts = pDone.total_activities || 0;
    avgPace = formatPace(Number(pDone.avg_pace_sec));
    totalLoad = Math.round(Number(pDone.total_load || 0));
  } else {
    // Casal somado
    totalKm = (parseFloat(dDone.total_km_done || 0) + parseFloat(pDone.total_km_done || 0)).toFixed(1);
    totalWorkouts = Number(dDone.total_activities || 0) + Number(pDone.total_activities || 0);
    avgPace = 'Casal';
    totalLoad = Math.round(Number(dDone.total_load || 0) + Number(pDone.total_load || 0));
  }

  kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Volume Realizado</div>
      <div class="kpi-val">${totalKm} <span style="font-size: 13px;">km</span></div>
      <div class="kpi-sub">Total acumulado</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Treinos Concluídos</div>
      <div class="kpi-val">${totalWorkouts}</div>
      <div class="kpi-sub">Sincronizados</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Pace Médio Geral</div>
      <div class="kpi-val" style="font-size: 17px;">${avgPace}</div>
      <div class="kpi-sub">Em movimento</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Carga Interna</div>
      <div class="kpi-val">${totalLoad}</div>
      <div class="kpi-sub">Training Load Total</div>
    </div>
  `;
}

// Barra de Comparação Casal
function renderCoupleMeter() {
  if (!dashboardStatsData) return;
  const dKm = parseFloat(dashboardStatsData.daniel.done.total_km_done || 0);
  const pKm = parseFloat(dashboardStatsData.patricia.done.total_km_done || 0);
  const total = dKm + pKm || 1;

  const dPct = ((dKm / total) * 100).toFixed(1);
  const pPct = ((pKm / total) * 100).toFixed(1);

  const meterD = document.getElementById('meter-daniel');
  const meterP = document.getElementById('meter-patricia');
  const statD = document.getElementById('stat-daniel-km');
  const statP = document.getElementById('stat-patricia-km');

  if (meterD) meterD.style.width = `${dPct}%`;
  if (meterP) meterP.style.width = `${pPct}%`;

  if (statD) statD.innerHTML = `🔴 Daniel (Fla): <strong>${dKm.toFixed(1)} km</strong> (${dPct}%)`;
  if (statP) statP.innerHTML = `🔵 Patrícia (Grêmio): <strong>${pKm.toFixed(1)} km</strong> (${pPct}%)`;
}

// Renderizar Gráficos e Tabelas do Hub de Relatórios
function renderReports() {
  if (!dashboardStatsData) return;

  // 1. Gráfico Chart.js
  renderVolumeChart();

  // 2. Tabela de Atividades Realizadas
  const tbodyActs = document.getElementById('table-activities-body');
  const filteredActs = currentAthleteId === 'casal'
    ? dashboardStatsData.recentActivities
    : dashboardStatsData.recentActivities.filter((a) => a.athlete_id === currentAthleteId);

  if (filteredActs.length === 0) {
    tbodyActs.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">Nenhuma atividade realizada encontrada para este filtro.</td></tr>`;
  } else {
    tbodyActs.innerHTML = filteredActs.map((act) => {
      const dist = act.distance_meters ? (Number(act.distance_meters) / 1000).toFixed(2) : '0.00';
      const pace = formatPace(act.avg_pace_sec_km ? Number(act.avg_pace_sec_km) : null);
      const time = formatDuration(act.moving_time_seconds ? Number(act.moving_time_seconds) : null);
      const athleteBadge = act.athlete_id === 'daniel' 
        ? '<span style="color: #e11d48; font-weight: 700;">🔴 Daniel</span>' 
        : '<span style="color: #0284c7; font-weight: 700;">🔵 Patrícia</span>';

      return `
        <tr>
          <td><strong>${act.date}</strong></td>
          <td>${athleteBadge}</td>
          <td>${act.name || act.type || 'Corrida'}</td>
          <td><strong>${dist} km</strong></td>
          <td>${pace}</td>
          <td>${time}</td>
          <td>${act.avg_hr ? Math.round(Number(act.avg_hr)) + ' bpm' : '-'} / ${act.load ? Math.round(Number(act.load)) : '-'}</td>
        </tr>
      `;
    }).join('');
  }

  // 3. Tabela de Próximos Treinos Planejados
  const tbodyWks = document.getElementById('table-workouts-body');
  const filteredWks = currentAthleteId === 'casal'
    ? dashboardStatsData.upcomingWorkouts
    : dashboardStatsData.upcomingWorkouts.filter((w) => w.athlete_id === currentAthleteId);

  if (filteredWks.length === 0) {
    tbodyWks.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">Nenhum treino programado nos próximos dias.</td></tr>`;
  } else {
    tbodyWks.innerHTML = filteredWks.map((w) => {
      const athleteBadge = w.athlete_id === 'daniel' 
        ? '<span style="color: #e11d48; font-weight: 700;">🔴 Daniel</span>' 
        : '<span style="color: #0284c7; font-weight: 700;">🔵 Patrícia</span>';
      const statusBadge = w.whatsapp_sent 
        ? '<span class="badge badge-success">Enviado</span>' 
        : '<span class="badge badge-theme">Agendado</span>';

      return `
        <tr>
          <td><strong>${w.date}</strong></td>
          <td>${athleteBadge}</td>
          <td>${w.focus || 'Treino'}</td>
          <td><strong>${w.target_km ? w.target_km + ' km' : '—'}</strong></td>
          <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${w.road_prescription || ''}">
            ${w.road_prescription || w.treadmill_prescription || w.strength_work || '—'}
          </td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  }
}

function renderVolumeChart() {
  const canvas = document.getElementById('volumeChart');
  if (!canvas || !window.Chart || !dashboardStatsData) return;

  const dPlan = parseFloat(dashboardStatsData.daniel.planned.total_km_planned || 0);
  const dDone = parseFloat(dashboardStatsData.daniel.done.total_km_done || 0);
  const pPlan = parseFloat(dashboardStatsData.patricia.planned.total_km_planned || 0);
  const pDone = parseFloat(dashboardStatsData.patricia.done.total_km_done || 0);

  let labels = [];
  let plannedData = [];
  let doneData = [];
  let colorsDone = [];

  if (currentAthleteId === 'daniel') {
    labels = ['Daniel (Flamengo)'];
    plannedData = [dPlan];
    doneData = [dDone];
    colorsDone = ['#e11d48'];
  } else if (currentAthleteId === 'patricia') {
    labels = ['Patrícia (Grêmio)'];
    plannedData = [pPlan];
    doneData = [pDone];
    colorsDone = ['#0284c7'];
  } else {
    labels = ['Daniel (Fla)', 'Patrícia (Grêmio)', 'Casal Total'];
    plannedData = [dPlan, pPlan, dPlan + pPlan];
    doneData = [dDone, pDone, dDone + pDone];
    colorsDone = ['#e11d48', '#0284c7', '#f59e0b'];
  }

  if (volumeChartInstance) {
    volumeChartInstance.destroy();
  }

  volumeChartInstance = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Planejado (Planilhas KM)',
          data: plannedData,
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          borderColor: 'rgba(255, 255, 255, 0.4)',
          borderWidth: 1,
          borderRadius: 8,
        },
        {
          label: 'Realizado (Intervals.icu KM)',
          data: doneData,
          backgroundColor: colorsDone,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 12, weight: '600' } },
        },
      },
      scales: {
        x: {
          ticks: { color: '#cbd5e1', font: { weight: '700' } },
          grid: { display: false },
        },
        y: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          title: { display: true, text: 'Quilômetros (KM)', color: '#64748b' },
        },
      },
    },
  });
}

// ==============================================
// GERADOR DE CARDS PARA INSTAGRAM STORIES (9:16)
// ==============================================
let uploadedBgImage = null;

function setupStoryModal() {
  const modal = document.getElementById('story-modal');
  const btnOpen = document.getElementById('btn-open-story-modal');
  const btnClose = document.getElementById('btn-close-story-modal');
  const btnDownload = document.getElementById('btn-download-story');

  const inputTemplate = document.getElementById('story-template');
  const inputRatio = document.getElementById('story-aspect-ratio');
  const inputQuote = document.getElementById('story-love-quote');
  const inputTitle = document.getElementById('story-title');
  const inputKm = document.getElementById('story-km');
  const inputPace = document.getElementById('story-pace');
  const inputTime = document.getElementById('story-time');
  const inputHr = document.getElementById('story-hr');
  const inputBg = document.getElementById('story-bg-file');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      // Auto-preenche com a atividade mais recente se houver
      if (dashboardStatsData && dashboardStatsData.recentActivities && dashboardStatsData.recentActivities.length > 0) {
        const lastAct = dashboardStatsData.recentActivities[0];
        inputTitle.value = lastAct.name || 'Treino Concluído! 🏃‍♂️';
        if (lastAct.distance_meters) inputKm.value = (Number(lastAct.distance_meters) / 1000).toFixed(2) + ' km';
        if (lastAct.avg_pace_sec_km) inputPace.value = formatPace(Number(lastAct.avg_pace_sec_km));
        if (lastAct.moving_time_seconds) inputTime.value = formatDuration(Number(lastAct.moving_time_seconds));
        if (lastAct.avg_hr) inputHr.value = Math.round(Number(lastAct.avg_hr)) + ' bpm' + (lastAct.load ? ' • Load ' + Math.round(Number(lastAct.load)) : '');
      }
      modal.style.display = 'flex';
      drawStoryCard();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  // Fecha clicando fora
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // Re-desenha ao alterar qualquer campo
  [inputTemplate, inputRatio, inputQuote, inputTitle, inputKm, inputPace, inputTime, inputHr].forEach((el) => {
    if (el) el.addEventListener('input', drawStoryCard);
  });

  // Upload de foto de fundo personalizada
  if (inputBg) {
    inputBg.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            uploadedBgImage = img;
            drawStoryCard();
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Download do Story
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      const canvas = document.getElementById('storyCanvas');
      const ratio = inputRatio ? inputRatio.value : '1:1';
      const link = document.createElement('a');
      link.download = `dani_pati_card_${ratio === '1:1' ? 'feed_square' : 'story'}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    });
  }
}

function drawStoryCard() {
  const canvas = document.getElementById('storyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const ratio = document.getElementById('story-aspect-ratio')?.value || '1:1';
  const width = 1080;
  const height = ratio === '1:1' ? 1080 : 1920;

  canvas.width = width;
  canvas.height = height;

  if (ratio === '1:1') {
    canvas.style.width = '280px';
    canvas.style.height = '280px';
  } else {
    canvas.style.width = '240px';
    canvas.style.height = '426px';
  }

  const template = document.getElementById('story-template')?.value || 'love_sunset';
  const quoteSelect = document.getElementById('story-love-quote')?.value || 'couple_1';
  const title = document.getElementById('story-title')?.value || 'Treino Concluído!';
  const km = document.getElementById('story-km')?.value || '10.0 km';
  const pace = document.getElementById('story-pace')?.value || '5:30 /km';
  const time = document.getElementById('story-time')?.value || '55m 00s';
  const hr = document.getElementById('story-hr')?.value || '150 bpm';

  // Frase selecionada
  let quote = '"Construindo nossa melhor versão lado a lado a cada KM! 👩‍❤️‍👨"';
  if (quoteSelect === 'couple_2') quote = '"Correndo juntos pelo mesmo destino: nossa felicidade! ❤️"';
  else if (quoteSelect === 'couple_3') quote = '"Você é o meu melhor ritmo e a minha melhor companhia! 💖"';
  else if (quoteSelect === 'couple_4') quote = '"O amor é a nossa maior linha de chegada! 🏅✨"';
  else if (quoteSelect === 'couple_5') quote = '"Parceria nos treinos, na vida e em todos os quilômetros! 💫"';

  // Configurações de cores e gradientes de acordo com o tema
  let badgeTxt = '❤️ DANI & PATÍCIA • LOVE';
  let badgeColor = '#f43f5e';
  let cardBorderColor = '#fb7185';
  let glowColor = 'rgba(244, 63, 94, 0.35)';

  if (template === 'love_sunset') {
    badgeTxt = '🌅 SUNSET LOVE • DANI & PATY';
    badgeColor = '#fb923c';
    cardBorderColor = '#f97316';
    glowColor = 'rgba(249, 115, 22, 0.35)';
  } else if (template === 'love_golden') {
    badgeTxt = '✨ GOLDEN ROMANCE • NOSSA HISTÓRIA';
    badgeColor = '#fbbf24';
    cardBorderColor = '#f59e0b';
    glowColor = 'rgba(245, 158, 11, 0.35)';
  } else if (template === 'love_rose') {
    badgeTxt = '🌸 DELICATE LOVE • DANI & PATI';
    badgeColor = '#f472b6';
    cardBorderColor = '#ec4899';
    glowColor = 'rgba(236, 72, 153, 0.35)';
  } else if (template === 'love_neon') {
    badgeTxt = '💖 NEON LOVE • JUNTOS SEMPRE';
    badgeColor = '#e11d48';
    cardBorderColor = '#ff0055';
    glowColor = 'rgba(255, 0, 85, 0.45)';
  } else if (template === 'daniel') {
    badgeTxt = '🔴⚫ DANIEL • MENGÃO';
    badgeColor = '#e11d48';
    cardBorderColor = '#991b1b';
    glowColor = 'rgba(225, 29, 72, 0.35)';
    quote = '"Raça, amor e paixão nos treinos diários! 🔴⚫"';
  } else if (template === 'patricia') {
    badgeTxt = '🔵⚪ PATRÍCIA • TRICOLOR';
    badgeColor = '#38bdf8';
    cardBorderColor = '#0284c7';
    glowColor = 'rgba(2, 132, 199, 0.35)';
    quote = '"Determinação e foco até a linha de chegada! 🔵⚪"';
  }

  // 1. Fundo (Imagem personalizada ou Degradê Temático)
  if (uploadedBgImage) {
    const hRatio = width / uploadedBgImage.width;
    const vRatio = height / uploadedBgImage.height;
    const imgScale = Math.max(hRatio, vRatio);
    const centerShiftX = (width - uploadedBgImage.width * imgScale) / 2;
    const centerShiftY = (height - uploadedBgImage.height * imgScale) / 2;
    ctx.drawImage(
      uploadedBgImage,
      0,
      0,
      uploadedBgImage.width,
      uploadedBgImage.height,
      centerShiftX,
      centerShiftY,
      uploadedBgImage.width * imgScale,
      uploadedBgImage.height * imgScale
    );

    // Overlay escuro com toque de cor do tema
    ctx.fillStyle = 'rgba(7, 9, 14, 0.68)';
    ctx.fillRect(0, 0, width, height);
  } else {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    if (template === 'love_sunset') {
      grad.addColorStop(0, '#431407');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#9a3412');
    } else if (template === 'love_golden') {
      grad.addColorStop(0, '#451a03');
      grad.addColorStop(0.5, '#090d16');
      grad.addColorStop(1, '#78350f');
    } else if (template === 'love_rose') {
      grad.addColorStop(0, '#500724');
      grad.addColorStop(0.5, '#090d16');
      grad.addColorStop(1, '#831843');
    } else if (template === 'love_neon') {
      grad.addColorStop(0, '#310022');
      grad.addColorStop(0.5, '#040508');
      grad.addColorStop(1, '#4c0519');
    } else if (template === 'daniel') {
      grad.addColorStop(0, '#1a0508');
      grad.addColorStop(0.5, '#07090e');
      grad.addColorStop(1, '#881337');
    } else if (template === 'patricia') {
      grad.addColorStop(0, '#041c2c');
      grad.addColorStop(0.5, '#07090e');
      grad.addColorStop(1, '#0369a1');
    } else {
      // Casal Clássico
      grad.addColorStop(0, '#2e1065');
      grad.addColorStop(0.5, '#07090e');
      grad.addColorStop(1, '#be185d');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Elementos Gráficos Românticos de Fundo (Glow / Efeito de Coração)
  ctx.save();
  ctx.beginPath();
  ctx.arc(width * 0.85, height * 0.15, 320, 0, Math.PI * 2);
  ctx.fillStyle = glowColor;
  ctx.filter = 'blur(85px)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(width * 0.15, height * 0.85, 320, 0, Math.PI * 2);
  ctx.fillStyle = glowColor;
  ctx.filter = 'blur(85px)';
  ctx.fill();
  ctx.restore();

  // 3. Renderização Específica para 1:1 (Feed Quadrado) vs 9:16 (Stories)
  if (ratio === '1:1') {
    // --- LAYOUT 1:1 QUADRADO ---
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 36px -apple-system, sans-serif';
    ctx.fillText('⚡ DANI & PATI RUN', width / 2, 75);

    ctx.font = '700 22px -apple-system, sans-serif';
    ctx.fillStyle = badgeColor;
    ctx.fillText(badgeTxt, width / 2, 115);

    const cardX = 60;
    const cardY = 155;
    const cardW = width - 120;
    const cardH = 830;
    const cardRadius = 36;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 45;
    ctx.shadowOffsetY = 15;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = cardBorderColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.stroke();

    // Título
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 38px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, cardY + 75);

    // Destaque KM
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 24px -apple-system, sans-serif';
    ctx.fillText('DISTÂNCIA CONCLUÍDA', width / 2, cardY + 155);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 110px -apple-system, sans-serif';
    ctx.fillText(km, width / 2, cardY + 270);

    // Grade de Métricas
    const col1X = cardX + cardW * 0.28;
    const col2X = cardX + cardW * 0.72;

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 22px -apple-system, sans-serif';
    ctx.fillText('PACE MÉDIO', col1X, cardY + 380);
    ctx.fillStyle = badgeColor;
    ctx.font = '900 52px -apple-system, sans-serif';
    ctx.fillText(pace, col1X, cardY + 445);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 22px -apple-system, sans-serif';
    ctx.fillText('TEMPO TOTAL', col2X, cardY + 380);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px -apple-system, sans-serif';
    ctx.fillText(time, col2X, cardY + 445);

    // Linha divisória
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 50, cardY + 520);
    ctx.lineTo(cardX + cardW - 50, cardY + 520);
    ctx.stroke();

    // FC / Load
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 22px -apple-system, sans-serif';
    ctx.fillText('INTENSIDADE & ESFORÇO', width / 2, cardY + 580);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 38px -apple-system, sans-serif';
    ctx.fillText(hr, width / 2, cardY + 635);

    // Frase Romântica
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'italic 500 24px -apple-system, sans-serif';
    ctx.fillText(quote, width / 2, cardY + 740);

    // Rodapé
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 22px -apple-system, sans-serif';
    ctx.fillText('@dani_pati_run • Nosso Ritmo, Nosso Amor ❤️', width / 2, height - 35);
  } else {
    // --- LAYOUT 9:16 STORIES ---
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 42px -apple-system, sans-serif';
    ctx.fillText('⚡ DANI & PATI RUN', width / 2, 180);

    ctx.font = '700 28px -apple-system, sans-serif';
    ctx.fillStyle = badgeColor;
    ctx.fillText(badgeTxt, width / 2, 235);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.2, 270);
    ctx.lineTo(width * 0.8, 270);
    ctx.stroke();

    const cardX = 90;
    const cardY = 380;
    const cardW = width - 180;
    const cardH = 1140;
    const cardRadius = 50;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 55;
    ctx.shadowOffsetY = 25;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = cardBorderColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 50px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, cardY + 130);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 32px -apple-system, sans-serif';
    ctx.fillText('DISTÂNCIA CONCLUÍDA', width / 2, cardY + 280);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 135px -apple-system, sans-serif';
    ctx.fillText(km, width / 2, cardY + 410);

    const col1X = cardX + cardW * 0.28;
    const col2X = cardX + cardW * 0.72;

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 28px -apple-system, sans-serif';
    ctx.fillText('PACE MÉDIO', col1X, cardY + 560);
    ctx.fillStyle = badgeColor;
    ctx.font = '900 64px -apple-system, sans-serif';
    ctx.fillText(pace, col1X, cardY + 640);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 28px -apple-system, sans-serif';
    ctx.fillText('TEMPO TOTAL', col2X, cardY + 560);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 64px -apple-system, sans-serif';
    ctx.fillText(time, col2X, cardY + 640);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 60, cardY + 730);
    ctx.lineTo(cardX + cardW - 60, cardY + 730);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 28px -apple-system, sans-serif';
    ctx.fillText('INTENSIDADE & ESFORÇO', width / 2, cardY + 800);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 48px -apple-system, sans-serif';
    ctx.fillText(hr, width / 2, cardY + 870);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'italic 500 30px -apple-system, sans-serif';
    ctx.fillText(quote, width / 2, cardY + 1020);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '600 30px -apple-system, sans-serif';
    ctx.fillText('@dani_pati_run • Nosso Ritmo, Nosso Amor ❤️', width / 2, height - 120);
  }
}

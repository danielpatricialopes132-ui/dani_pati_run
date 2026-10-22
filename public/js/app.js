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
  } catch (err) {
    console.error('Erro ao carregar estatísticas:', err);
  }
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

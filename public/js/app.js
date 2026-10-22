// Gerenciamento de Estado do PWA
let currentAthleteId = 'daniel';

// Registrar Service Worker
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
  setupActionButtons();
  loadData();
});

function setupAthleteTabs() {
  const tabs = document.querySelectorAll('.athlete-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentAthleteId = tab.dataset.id;
      loadData();
    });
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
      loadData();
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
      loadData();
    } catch (e) {
      alert('Erro ao enviar WhatsApp: ' + e.message);
    } finally {
      btnWhatsapp.disabled = false;
      btnWhatsapp.innerHTML = '<span>📲</span> Enviar WhatsApp';
    }
  });
}

async function loadData() {
  await Promise.all([loadTodayData(), loadWeekData()]);
}

async function loadTodayData() {
  const statusBadge = document.getElementById('workout-status-badge');
  const workoutContent = document.getElementById('workout-content');
  const activitiesContent = document.getElementById('activities-content');

  try {
    const res = await fetch(`/api/athletes/${currentAthleteId}/today`);
    const data = await res.json();

    // Renderizar Treino Prescrito
    if (data.workout) {
      statusBadge.textContent = data.workout.whatsapp_sent ? 'Enviado no WhatsApp' : 'Planejado';
      statusBadge.className = data.workout.whatsapp_sent ? 'badge badge-success' : 'badge badge-today';

      let html = '';
      if (data.workout.focus) {
        html += `
          <div class="focus-banner">
            <div class="focus-label">Foco Principal</div>
            <div class="focus-value">${data.workout.focus}</div>
            ${data.workout.target_km ? `<div class="target-km">Volume: ${data.workout.target_km} km</div>` : ''}
          </div>
        `;
      }

      html += '<div class="prescription-group">';

      if (data.workout.road_prescription) {
        html += `
          <div class="prescription-item">
            <div class="prescription-item-header"><span>🛣️</span> Opção Rua</div>
            <div class="prescription-item-content">${data.workout.road_prescription.replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }

      if (data.workout.treadmill_prescription) {
        html += `
          <div class="prescription-item">
            <div class="prescription-item-header"><span>🏃‍♂️</span> Opção Esteira</div>
            <div class="prescription-item-content">${data.workout.treadmill_prescription.replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }

      if (data.workout.strength_work) {
        html += `
          <div class="prescription-item">
            <div class="prescription-item-header"><span>🏋️</span> Fortalecimento / Musculação</div>
            <div class="prescription-item-content">${data.workout.strength_work.replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }

      if (data.workout.bike_work) {
        html += `
          <div class="prescription-item">
            <div class="prescription-item-header"><span>🚴</span> Bike / Cross-training</div>
            <div class="prescription-item-content">${data.workout.bike_work.replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }

      if (data.workout.clinical_notes) {
        html += `
          <div class="prescription-item">
            <div class="prescription-item-header"><span>🩺</span> Clínica & Notas</div>
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
        <div style="text-align: center; padding: 20px 0; color: #94a3b8;">
          <div style="font-size: 28px; margin-bottom: 6px;">🛌</div>
          Nenhum treino prescrito para hoje. Dia livre ou de recuperação ativa!
        </div>
      `;
    }

    // Renderizar Atividades Concluídas
    if (data.activities && data.activities.length > 0) {
      let actHtml = '';
      data.activities.forEach((act) => {
        const distKm = act.distance_meters ? (act.distance_meters / 1000).toFixed(2) : '0.00';
        actHtml += `
          <div class="activity-card">
            <div style="font-weight: 700; color: #10b981; font-size: 15px; margin-bottom: 8px;">
              ✓ ${act.name || act.type || 'Treino Concluído'}
            </div>
            <div class="activity-grid">
              <div class="stat-box">
                <div class="stat-label">Distância</div>
                <div class="stat-value">${distKm} km</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">Pace Médio</div>
                <div class="stat-value">${formatPace(act.avg_pace_sec_km)}</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">Duração</div>
                <div class="stat-value">${formatDuration(act.moving_time_seconds)}</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">FC Média / Load</div>
                <div class="stat-value">${act.avg_hr ? Math.round(act.avg_hr) + ' bpm' : '-'} / ${act.load ? Math.round(act.load) : '-'}</div>
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

async function loadWeekData() {
  const weekGrid = document.getElementById('week-grid');
  try {
    const res = await fetch(`/api/athletes/${currentAthleteId}/week`);
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

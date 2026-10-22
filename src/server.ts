import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { athleteManager } from './services/athleteManager';
import { runDailyDispatcher, getLocalDateString } from './jobs/dailyDispatcher';
import { runIntervalsSync } from './jobs/intervalsSync';
import { ScheduledWorkoutRecord } from './database';

export function createServer(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Servir arquivos estáticos do PWA
  const publicDir = path.resolve(process.cwd(), 'public');
  app.use(express.static(publicDir));

  // --- API Endpoints ---

  // Listar atletas
  app.get('/api/athletes', async (req: Request, res: Response) => {
    try {
      const athletes = await athleteManager.getAllAthletes(false);
      res.json(athletes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Obter detalhes de um atleta
  app.get('/api/athletes/:id', async (req: Request, res: Response) => {
    try {
      const athleteId = String(req.params.id);
      const athlete = await athleteManager.getAthleteById(athleteId);
      if (!athlete) {
        return res.status(404).json({ error: 'Atleta não encontrado' });
      }
      res.json(athlete);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Obter treino do dia e atividades concluídas para um atleta
  app.get('/api/athletes/:id/today', async (req: Request, res: Response) => {
    try {
      const athleteId = String(req.params.id);
      const date = typeof req.query.date === 'string' ? req.query.date : getLocalDateString();

      const workouts = await athleteManager.getScheduledWorkouts(athleteId, date);
      const activities = await athleteManager.getCompletedActivities(athleteId, date);

      res.json({
        date,
        athlete_id: athleteId,
        workout: workouts.length > 0 ? workouts[0] : null,
        activities,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Obter visão semanal de treinos (últimos 7 dias ou semana atual)
  app.get('/api/athletes/:id/week', async (req: Request, res: Response) => {
    try {
      const athleteId = String(req.params.id);
      const centerDate = new Date();

      const weekData = [];
      for (let i = -3; i <= 3; i++) {
        const d = new Date(centerDate);
        d.setDate(d.getDate() + i);
        const dateStr = getLocalDateString(d);

        const workouts = await athleteManager.getScheduledWorkouts(athleteId, dateStr);
        const activities = await athleteManager.getCompletedActivities(athleteId, dateStr);

        weekData.push({
          date: dateStr,
          dayOfWeek: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
          isToday: dateStr === getLocalDateString(),
          workout: workouts.length > 0 ? workouts[0] : null,
          activities,
          status: activities.length > 0 ? 'COMPLETED' : workouts.length > 0 ? 'PLANNED' : 'REST',
        });
      }

      res.json({ athlete_id: athleteId, week: weekData });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Obter estatísticas consolidadas para o dashboard (individual e casal)
  app.get('/api/dashboard-stats', async (req: Request, res: Response) => {
    try {
      const pool = athleteManager['pool'];

      // Estatísticas gerais Daniel
      const danielRes = await pool.query(`
        SELECT 
          COUNT(DISTINCT c.id) as total_activities,
          COALESCE(SUM(c.distance_meters), 0) / 1000.0 as total_km_done,
          COALESCE(SUM(c.moving_time_seconds), 0) as total_time_seconds,
          COALESCE(AVG(NULLIF(c.avg_hr, 0)), 0) as avg_hr,
          COALESCE(SUM(c.load), 0) as total_load,
          COALESCE(AVG(NULLIF(c.avg_pace_sec_km, 0)), 0) as avg_pace_sec
        FROM completed_activities c
        WHERE c.athlete_id = 'daniel'
      `);

      const danielPlannedRes = await pool.query(`
        SELECT 
          COUNT(id) as total_planned_workouts,
          COALESCE(SUM(target_km), 0) as total_km_planned
        FROM scheduled_workouts
        WHERE athlete_id = 'daniel'
      `);

      // Estatísticas gerais Patrícia
      const patriciaRes = await pool.query(`
        SELECT 
          COUNT(DISTINCT c.id) as total_activities,
          COALESCE(SUM(c.distance_meters), 0) / 1000.0 as total_km_done,
          COALESCE(SUM(c.moving_time_seconds), 0) as total_time_seconds,
          COALESCE(AVG(NULLIF(c.avg_hr, 0)), 0) as avg_hr,
          COALESCE(SUM(c.load), 0) as total_load,
          COALESCE(AVG(NULLIF(c.avg_pace_sec_km, 0)), 0) as avg_pace_sec
        FROM completed_activities c
        WHERE c.athlete_id = 'patricia'
      `);

      const patriciaPlannedRes = await pool.query(`
        SELECT 
          COUNT(id) as total_planned_workouts,
          COALESCE(SUM(target_km), 0) as total_km_planned
        FROM scheduled_workouts
        WHERE athlete_id = 'patricia'
      `);

      // Últimas 15 atividades recentes para tabela/relatório
      const recentActivities = await pool.query(`
        SELECT c.*, a.name as athlete_name
        FROM completed_activities c
        JOIN athletes a ON c.athlete_id = a.id
        ORDER BY c.date DESC, c.id DESC
        LIMIT 20
      `);

      // Próximos 15 treinos planejados para relatório
      const upcomingWorkouts = await pool.query(`
        SELECT w.*, a.name as athlete_name
        FROM scheduled_workouts w
        JOIN athletes a ON w.athlete_id = a.id
        WHERE w.date >= CURRENT_DATE - INTERVAL '1 day'
        ORDER BY w.date ASC, w.athlete_id ASC
        LIMIT 20
      `);

      res.json({
        daniel: {
          done: danielRes.rows[0],
          planned: danielPlannedRes.rows[0],
        },
        patricia: {
          done: patriciaRes.rows[0],
          planned: patriciaPlannedRes.rows[0],
        },
        recentActivities: recentActivities.rows,
        upcomingWorkouts: upcomingWorkouts.rows,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Criar ou atualizar treino agendado
  app.post('/api/workouts', async (req: Request, res: Response) => {
    try {
      const data = req.body;
      if (!data.athlete_id || !data.date) {
        return res.status(400).json({ error: 'athlete_id e date são obrigatórios' });
      }

      const workoutId = data.id || `wk_${data.athlete_id}_${data.date}_${Date.now()}`;
      const workout: ScheduledWorkoutRecord = {
        id: workoutId,
        athlete_id: data.athlete_id,
        date: data.date,
        focus: data.focus || null,
        target_km: data.target_km ? parseFloat(data.target_km) : null,
        road_prescription: data.road_prescription || null,
        treadmill_prescription: data.treadmill_prescription || null,
        strength_work: data.strength_work || null,
        bike_work: data.bike_work || null,
        clinical_notes: data.clinical_notes || null,
        whatsapp_sent: data.whatsapp_sent ?? 0,
      };

      await athleteManager.addScheduledWorkout(workout);
      res.status(201).json(workout);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Disparo manual do lembrete matinal do WhatsApp
  app.post('/api/actions/send-morning-reminder', async (req: Request, res: Response) => {
    try {
      const date = (req.body.date as string) || getLocalDateString();
      await runDailyDispatcher(date);
      res.json({ success: true, message: `Rotina matinal disparada para ${date}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Disparo manual da reconciliação noturna do Intervals.icu
  app.post('/api/actions/sync-intervals', async (req: Request, res: Response) => {
    try {
      const date = (req.body.date as string) || getLocalDateString();
      await runIntervalsSync(date);
      res.json({ success: true, message: `Reconciliação noturna disparada para ${date}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Redireciona qualquer rota não-API para o index.html do PWA
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

import { getDatabasePool, AthleteRecord, RaceRecord, ScheduledWorkoutRecord, CompletedActivityRecord } from '../database';

export class AthleteManager {
  private get pool() {
    return getDatabasePool();
  }

  // --- Atletas ---
  async getAllAthletes(onlyActive = true): Promise<AthleteRecord[]> {
    const query = onlyActive
      ? 'SELECT * FROM athletes WHERE active = 1 ORDER BY name ASC'
      : 'SELECT * FROM athletes ORDER BY name ASC';
    const res = await this.pool.query(query);
    return res.rows as AthleteRecord[];
  }

  async getAthleteById(id: string): Promise<AthleteRecord | undefined> {
    const res = await this.pool.query('SELECT * FROM athletes WHERE id = $1', [id]);
    return res.rows[0] as AthleteRecord | undefined;
  }

  async upsertAthlete(data: {
    id: string;
    name: string;
    whatsapp_number: string;
    intervals_athlete_id?: string | null;
    intervals_api_key?: string | null;
    notify_time?: string;
    active?: number;
  }): Promise<AthleteRecord> {
    const cleanId = data.id.toLowerCase().trim();
    const cleanPhone = data.whatsapp_number.replace(/\D/g, '');

    await this.pool.query(
      `
      INSERT INTO athletes (id, name, whatsapp_number, intervals_athlete_id, intervals_api_key, notify_time, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(id) DO UPDATE SET
        name = EXCLUDED.name,
        whatsapp_number = EXCLUDED.whatsapp_number,
        intervals_athlete_id = EXCLUDED.intervals_athlete_id,
        intervals_api_key = EXCLUDED.intervals_api_key,
        notify_time = EXCLUDED.notify_time,
        active = EXCLUDED.active
    `,
      [
        cleanId,
        data.name.trim(),
        cleanPhone,
        data.intervals_athlete_id ? data.intervals_athlete_id.trim() : null,
        data.intervals_api_key ? data.intervals_api_key.trim() : null,
        data.notify_time || '06:30',
        data.active ?? 1,
      ]
    );

    const updated = await this.getAthleteById(cleanId);
    return updated!;
  }

  async setAthleteActiveStatus(id: string, active: number): Promise<boolean> {
    const res = await this.pool.query('UPDATE athletes SET active = $1 WHERE id = $2', [active, id]);
    return (res.rowCount ?? 0) > 0;
  }

  // --- Provas / Races ---
  async getRacesByAthlete(athleteId: string): Promise<RaceRecord[]> {
    const res = await this.pool.query('SELECT * FROM races WHERE athlete_id = $1 ORDER BY race_date ASC', [athleteId]);
    return res.rows as RaceRecord[];
  }

  async addRace(race: RaceRecord): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO races (id, athlete_id, name, race_date, distance_km, target_time, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(id) DO UPDATE SET
        name = EXCLUDED.name,
        race_date = EXCLUDED.race_date,
        distance_km = EXCLUDED.distance_km,
        target_time = EXCLUDED.target_time,
        priority = EXCLUDED.priority
    `,
      [race.id, race.athlete_id, race.name, race.race_date, race.distance_km, race.target_time, race.priority]
    );
  }

  // --- Treinos Agendados / Scheduled Workouts ---
  async getScheduledWorkouts(athleteId: string, date: string): Promise<ScheduledWorkoutRecord[]> {
    const res = await this.pool.query('SELECT * FROM scheduled_workouts WHERE athlete_id = $1 AND date = $2', [
      athleteId,
      date,
    ]);
    return res.rows as ScheduledWorkoutRecord[];
  }

  async getPendingScheduledWorkoutsForDate(
    date: string
  ): Promise<(ScheduledWorkoutRecord & { athlete_name: string; whatsapp_number: string })[]> {
    const res = await this.pool.query(
      `
      SELECT w.*, a.name as athlete_name, a.whatsapp_number
      FROM scheduled_workouts w
      JOIN athletes a ON w.athlete_id = a.id
      WHERE w.date = $1 AND w.whatsapp_sent = 0 AND a.active = 1
    `,
      [date]
    );
    return res.rows as any[];
  }

  async markWorkoutAsSent(workoutId: string): Promise<void> {
    await this.pool.query('UPDATE scheduled_workouts SET whatsapp_sent = 1 WHERE id = $1', [workoutId]);
  }

  async addScheduledWorkout(workout: ScheduledWorkoutRecord): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO scheduled_workouts (
        id, athlete_id, date, focus, target_km, road_prescription,
        treadmill_prescription, strength_work, bike_work, clinical_notes, whatsapp_sent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT(id) DO UPDATE SET
        focus = EXCLUDED.focus,
        target_km = EXCLUDED.target_km,
        road_prescription = EXCLUDED.road_prescription,
        treadmill_prescription = EXCLUDED.treadmill_prescription,
        strength_work = EXCLUDED.strength_work,
        bike_work = EXCLUDED.bike_work,
        clinical_notes = EXCLUDED.clinical_notes,
        whatsapp_sent = EXCLUDED.whatsapp_sent
    `,
      [
        workout.id,
        workout.athlete_id,
        workout.date,
        workout.focus,
        workout.target_km,
        workout.road_prescription,
        workout.treadmill_prescription,
        workout.strength_work,
        workout.bike_work,
        workout.clinical_notes,
        workout.whatsapp_sent,
      ]
    );
  }

  // --- Atividades Concluídas / Completed Activities ---
  async getCompletedActivities(athleteId: string, date: string): Promise<CompletedActivityRecord[]> {
    const res = await this.pool.query(
      'SELECT * FROM completed_activities WHERE athlete_id = $1 AND date = $2 ORDER BY id ASC',
      [athleteId, date]
    );
    return res.rows as CompletedActivityRecord[];
  }

  async saveCompletedActivity(activity: CompletedActivityRecord): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO completed_activities (
        id, athlete_id, date, name, type, distance_meters,
        moving_time_seconds, avg_hr, avg_pace_sec_km, rpe, load
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT(id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        distance_meters = EXCLUDED.distance_meters,
        moving_time_seconds = EXCLUDED.moving_time_seconds,
        avg_hr = EXCLUDED.avg_hr,
        avg_pace_sec_km = EXCLUDED.avg_pace_sec_km,
        rpe = EXCLUDED.rpe,
        load = EXCLUDED.load
    `,
      [
        activity.id,
        activity.athlete_id,
        activity.date,
        activity.name,
        activity.type,
        activity.distance_meters,
        activity.moving_time_seconds,
        activity.avg_hr,
        activity.avg_pace_sec_km,
        activity.rpe,
        activity.load,
      ]
    );
  }
}

export const athleteManager = new AthleteManager();

import { getDatabase, AthleteRecord, RaceRecord, ScheduledWorkoutRecord, CompletedActivityRecord } from '../database';

export class AthleteManager {
  private get db() {
    return getDatabase();
  }

  // --- Atletas ---
  getAllAthletes(onlyActive = true): AthleteRecord[] {
    const query = onlyActive
      ? 'SELECT * FROM athletes WHERE active = 1 ORDER BY name ASC'
      : 'SELECT * FROM athletes ORDER BY name ASC';
    return this.db.prepare(query).all() as AthleteRecord[];
  }

  getAthleteById(id: string): AthleteRecord | undefined {
    return this.db.prepare('SELECT * FROM athletes WHERE id = ?').get(id) as AthleteRecord | undefined;
  }

  upsertAthlete(data: {
    id: string;
    name: string;
    whatsapp_number: string;
    intervals_athlete_id?: string | null;
    intervals_api_key?: string | null;
    notify_time?: string;
    active?: number;
  }): AthleteRecord {
    const stmt = this.db.prepare(`
      INSERT INTO athletes (id, name, whatsapp_number, intervals_athlete_id, intervals_api_key, notify_time, active)
      VALUES (@id, @name, @whatsapp_number, @intervals_athlete_id, @intervals_api_key, @notify_time, @active)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        whatsapp_number = excluded.whatsapp_number,
        intervals_athlete_id = excluded.intervals_athlete_id,
        intervals_api_key = excluded.intervals_api_key,
        notify_time = excluded.notify_time,
        active = excluded.active
    `);

    stmt.run({
      id: data.id.toLowerCase().trim(),
      name: data.name.trim(),
      whatsapp_number: data.whatsapp_number.replace(/\D/g, ''),
      intervals_athlete_id: data.intervals_athlete_id ? data.intervals_athlete_id.trim() : null,
      intervals_api_key: data.intervals_api_key ? data.intervals_api_key.trim() : null,
      notify_time: data.notify_time || '06:30',
      active: data.active ?? 1,
    });

    return this.getAthleteById(data.id.toLowerCase().trim())!;
  }

  setAthleteActiveStatus(id: string, active: number): boolean {
    const res = this.db.prepare('UPDATE athletes SET active = ? WHERE id = ?').run(active, id);
    return res.changes > 0;
  }

  // --- Provas / Races ---
  getRacesByAthlete(athleteId: string): RaceRecord[] {
    return this.db
      .prepare('SELECT * FROM races WHERE athlete_id = ? ORDER BY race_date ASC')
      .all(athleteId) as RaceRecord[];
  }

  addRace(race: RaceRecord): void {
    this.db
      .prepare(`
        INSERT INTO races (id, athlete_id, name, race_date, distance_km, target_time, priority)
        VALUES (@id, @athlete_id, @name, @race_date, @distance_km, @target_time, @priority)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          race_date = excluded.race_date,
          distance_km = excluded.distance_km,
          target_time = excluded.target_time,
          priority = excluded.priority
      `)
      .run(race);
  }

  // --- Treinos Agendados / Scheduled Workouts ---
  getScheduledWorkouts(athleteId: string, date: string): ScheduledWorkoutRecord[] {
    return this.db
      .prepare('SELECT * FROM scheduled_workouts WHERE athlete_id = ? AND date = ?')
      .all(athleteId, date) as ScheduledWorkoutRecord[];
  }

  getPendingScheduledWorkoutsForDate(date: string): (ScheduledWorkoutRecord & { athlete_name: string; whatsapp_number: string })[] {
    return this.db
      .prepare(`
        SELECT w.*, a.name as athlete_name, a.whatsapp_number
        FROM scheduled_workouts w
        JOIN athletes a ON w.athlete_id = a.id
        WHERE w.date = ? AND w.whatsapp_sent = 0 AND a.active = 1
      `)
      .all(date) as any[];
  }

  markWorkoutAsSent(workoutId: string): void {
    this.db.prepare('UPDATE scheduled_workouts SET whatsapp_sent = 1 WHERE id = ?').run(workoutId);
  }

  addScheduledWorkout(workout: ScheduledWorkoutRecord): void {
    this.db
      .prepare(`
        INSERT INTO scheduled_workouts (
          id, athlete_id, date, focus, target_km, road_prescription,
          treadmill_prescription, strength_work, bike_work, clinical_notes, whatsapp_sent
        ) VALUES (
          @id, @athlete_id, @date, @focus, @target_km, @road_prescription,
          @treadmill_prescription, @strength_work, @bike_work, @clinical_notes, @whatsapp_sent
        )
        ON CONFLICT(id) DO UPDATE SET
          focus = excluded.focus,
          target_km = excluded.target_km,
          road_prescription = excluded.road_prescription,
          treadmill_prescription = excluded.treadmill_prescription,
          strength_work = excluded.strength_work,
          bike_work = excluded.bike_work,
          clinical_notes = excluded.clinical_notes,
          whatsapp_sent = excluded.whatsapp_sent
      `)
      .run(workout);
  }

  // --- Atividades Concluídas / Completed Activities ---
  getCompletedActivities(athleteId: string, date: string): CompletedActivityRecord[] {
    return this.db
      .prepare('SELECT * FROM completed_activities WHERE athlete_id = ? AND date = ? ORDER BY id ASC')
      .all(athleteId, date) as CompletedActivityRecord[];
  }

  saveCompletedActivity(activity: CompletedActivityRecord): void {
    this.db
      .prepare(`
        INSERT INTO completed_activities (
          id, athlete_id, date, name, type, distance_meters,
          moving_time_seconds, avg_hr, avg_pace_sec_km, rpe, load
        ) VALUES (
          @id, @athlete_id, @date, @name, @type, @distance_meters,
          @moving_time_seconds, @avg_hr, @avg_pace_sec_km, @rpe, @load
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          distance_meters = excluded.distance_meters,
          moving_time_seconds = excluded.moving_time_seconds,
          avg_hr = excluded.avg_hr,
          avg_pace_sec_km = excluded.avg_pace_sec_km,
          rpe = excluded.rpe,
          load = excluded.load
      `)
      .run(activity);
  }

  hasCompletedActivity(activityId: string): boolean {
    const row = this.db.prepare('SELECT id FROM completed_activities WHERE id = ?').get(activityId);
    return !!row;
  }
}

export const athleteManager = new AthleteManager();

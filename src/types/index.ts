export interface Athlete {
  id: number;
  name: string;
  phone: string;
  intervals_athlete_id: string | null;
  intervals_api_key: string | null;
  active: number;
  created_at?: string;
  updated_at?: string;
}

export interface WorkoutPlan {
  id: number;
  athlete_id: number;
  date: string; // YYYY-MM-DD
  intervals_event_id: string | null;
  name: string;
  description: string | null;
  workout_type: string | null; // Run, Ride, Swim, WeightTraining, etc.
  distance_meters: number | null;
  duration_seconds: number | null;
  pace_target: string | null;
  status: 'PENDING' | 'SENT' | 'RECONCILED' | 'SKIPPED';
  sent_at: string | null;
  raw_payload?: string | null;
  created_at?: string;
}

export interface WorkoutExecution {
  id: number;
  athlete_id: number;
  plan_id: number | null;
  intervals_activity_id: string;
  date: string; // YYYY-MM-DD
  name: string;
  workout_type: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  average_hr: number | null;
  average_pace: string | null;
  calories: number | null;
  raw_payload?: string | null;
  reconciled_at: string;
  reconciliation_status: 'COMPLETED' | 'PARTIAL' | 'UNPLANNED';
  feedback_message: string | null;
  feedback_sent_at: string | null;
  created_at?: string;
}

export interface IntervalsEvent {
  id: number | string;
  start_date_local: string;
  name: string;
  description?: string;
  type?: string;
  category?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  pace?: number;
  icu_training_load?: number;
  [key: string]: any;
}

export interface IntervalsActivity {
  id: string;
  start_date_local: string;
  name: string;
  type: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number; // m/s
  calories?: number;
  icu_training_load?: number;
  [key: string]: any;
}

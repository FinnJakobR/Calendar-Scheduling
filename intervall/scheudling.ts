import moment from "moment";
import Intervall from "./intervall";
import Appointment from "../appointments/appointment";
import FixedAppointment from "../appointments/fixed_appointments";
import FlexibleAppointment from "../appointments/flexible_appointments";
import {
  endTime,
  intervalLength,
  startTime,
  weekDays,
} from "../settings/settings";
import ConstrainedAppointment from "../appointments/constrained_appointment";
import { generateIntervals } from "./generic";

function computeWeights(intervals: Intervall[]): number[] {
  return intervals.map((i) => i.weight);
}

function pickRandomSlotRandomDay(appointment: FlexibleAppointment): Intervall {
  // Wähle zufällig einen Tag
  const randomDayIndex = Math.floor(Math.random() * weekDays.length);
  const dayOffset = randomDayIndex;

  const dayStart = startTime.clone().add(dayOffset, "day");
  const dayEnd = endTime.clone().add(dayOffset, "day");

  const availableMinutes =
    dayEnd.diff(dayStart, "minutes") - appointment.duration.asMinutes();
  if (availableMinutes <= 0) {
    throw new Error("Appointment duration longer than available day time");
  }

  // Zufälliger Startpunkt innerhalb des Tages
  const randomOffset = Math.floor(Math.random() * availableMinutes);
  const start = dayStart.clone().add(randomOffset, "minutes");
  const end = start.clone().add(appointment.duration);

  return new Intervall(start, end, 1, appointment);
}
export function computeIntervals(
  appointments: ConstrainedAppointment[]
): Intervall[] {
  const intervals: Intervall[] = [];

  for (const appointment of appointments) {
    const availableDates = appointment.appointments;

    for (const date of availableDates) {
      const newInterval = new Intervall(
        date.start,
        date.end,
        date.priority,
        appointment
      );
      intervals.push(newInterval);
    }
  }

  return intervals;
}

function computeP(intervals: Intervall[]): number[] {
  const n = intervals.length;
  let p: number[] = new Array(n).fill(0);

  for (let j = 0; j < n; j++) {
    p[j] = -1;
    for (let i = j - 1; i >= 0; i--) {
      if (intervals[i].end.unix() <= intervals[j].start.unix()) {
        p[j] = i;
        break;
      }
    }
  }
  return p;
}

function computeM(weights: number[], p: number[]): number[] {
  const n = weights.length;
  let M: number[] = new Array(n).fill(0);

  for (let j = 0; j < n; j++) {
    const include = weights[j] + (p[j] >= 0 ? M[p[j]] : 0);
    const exclude = j > 0 ? M[j - 1] : 0;
    M[j] = Math.max(include, exclude);
  }
  return M;
}

function constructSchedule(
  j: number,
  intervals: Intervall[],
  weights: number[],
  p: number[],
  M: number[],
  schedule: Intervall[]
) {
  if (j < 0) return;

  const include = weights[j] + (p[j] >= 0 ? M[p[j]] : 0);
  const exclude = j > 0 ? M[j - 1] : 0;

  if (include >= exclude) {
    // Prüfe, ob flexibles Appointment schon benutzt
    if (
      !(intervals[j].appointment instanceof ConstrainedAppointment) ||
      !intervals[j].appointment.used
    ) {
      schedule.unshift(intervals[j]); // Intervall wird genommen

      if (intervals[j].appointment instanceof ConstrainedAppointment) {
        intervals[j].appointment.used = true;
      }

      constructSchedule(p[j], intervals, weights, p, M, schedule);
    } else {
      constructSchedule(j - 1, intervals, weights, p, M, schedule);
    }
  } else {
    constructSchedule(j - 1, intervals, weights, p, M, schedule);
  }
}

export default function scheduleContstrainedAppointment(
  appointments: ConstrainedAppointment[]
): FixedAppointment[] {
  // 1. Sortiere nach Endzeit
  const intervals = computeIntervals(appointments);
  intervals.sort((a, b) => a.end.unix() - b.end.unix());

  // 2. Generiere p
  const p = computeP(intervals);

  const weights = computeWeights(intervals);

  // 3. DP für M
  const M = computeM(weights, p);

  // 4. Rekonstruktion
  const finalSchedule: Intervall[] = [];
  constructSchedule(
    intervals.length - 1,
    intervals,
    weights,
    p,
    M,
    finalSchedule
  );

  const newFixedAppointments = [];

  for (const interval of finalSchedule) {
    const newFixedAppointment = new FixedAppointment(
      interval.appointment.name,
      interval.start,
      interval.end
    );
    newFixedAppointments.push(newFixedAppointment);
  }

  return newFixedAppointments;
}

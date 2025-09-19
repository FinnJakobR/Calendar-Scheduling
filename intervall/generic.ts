import moment from "moment";
import Appointment, {
  AppointmentPreferences,
} from "../appointments/appointment";
import FlexibleAppointment from "../appointments/flexible_appointments";
import FixedAppointment from "../appointments/fixed_appointments";
import Intervall from "./intervall";
import Calendar from "../calendar/calendar";
import { startTime, endTime, weekDays } from "../settings/settings";
import ConstrainedAppointment from "../appointments/constrained_appointment";
import scheduleContstrainedAppointment from "./scheudling";
import { fa } from "@faker-js/faker";

const MAX_ATTEMPTS = 2000; // maximale Versuche, einen Slot zu finden

// Prüft, ob ein neues Intervall mit bestehenden Intervallen des gleichen Tages überlappt
function checkIfOverlaps(dayIntervals: Intervall[], newInterval: Intervall) {
  return dayIntervals.some(
    (i) =>
      newInterval.start.isBetween(i.start, i.end, undefined, "[)") ||
      newInterval.end.isBetween(i.start, i.end, undefined, "(]")
  );
}

function calcHammingDistance(parentA: Calendar, parentB: Calendar): number {
  let distance = 0;

  const intervalsA = parentA.intervals;

  for (const weekDay of intervalsA) {
    for (const timeSlot of weekDay) {
      const slotB = parentB.findByDate(timeSlot.start);

      const apptA = timeSlot.appointment;
      const apptB = slotB;

      // Unterschied, wenn einer frei ist und der andere belegt
      if ((apptA && !apptB) || (!apptA && apptB)) {
        distance++;
      }
      // Unterschied, wenn beide belegt, aber unterschiedliche IDs
      else if (apptA && apptB && apptA.id !== apptB.id) {
        distance++;
      }
      // sonst: beide frei oder gleiche ID → kein Unterschied
    }
  }

  // Optional: Slots, die nur in parentB existieren
  // if parentB hat mehr Slots, die parentA nicht hat, distance += extra

  return distance;
}

function checkifAfterDeadline(slot: Intervall) {
  if (!(slot.appointment instanceof FlexibleAppointment)) return false;

  if (
    slot.appointment instanceof FlexibleAppointment &&
    !slot.appointment.deadline
  )
    return false;

  const deadline = slot.appointment.deadline;

  return slot.end.isAfter(deadline?.start);
}

function dontPassHardConstrains(dayIntervals: Intervall[], slot: Intervall) {
  return checkIfOverlaps(dayIntervals, slot) || checkifAfterDeadline(slot);
}
// Generiert einen zufälligen Slot für eine flexible Aufgabe an einem gegebenen Tag
function generateRandomSlot(
  appointment: FlexibleAppointment,
  dayOffset: number,
  dayIntervals: Intervall[]
) {
  const dayStart = startTime.clone().add(dayOffset, "day");
  const dayEnd = endTime.clone().add(dayOffset, "day");
  const availableMinutes =
    dayEnd.diff(dayStart, "minutes") - appointment.duration.asMinutes();

  if (availableMinutes <= 0) return null;

  let attempts = 0;
  let slot: Intervall;

  do {
    const randomOffset = Math.floor(Math.random() * availableMinutes);
    const start = dayStart.clone().add(randomOffset, "minutes");
    const end = start.clone().add(appointment.duration);
    slot = new Intervall(start, end, 1, appointment);
    attempts++;
  } while (
    dontPassHardConstrains(dayIntervals, slot) &&
    attempts < MAX_ATTEMPTS
  );

  if (attempts >= MAX_ATTEMPTS) {
    throw new Error(
      "Bro Rede mit mir: Das sind zu viele Termine, nichtmal ich als KI kann die Scheiße zuordnen!😢"
    );
  }
  return slot;
}

function computeFitness(c: Calendar) {
  const slotsPerDay = c.getSlotsPerDay(); // [2,1,3,2,2,0,1]
  const avg = slotsPerDay.reduce((a, b) => a + b, 0) / slotsPerDay.length;

  let fitness = 0;

  // Fitness = Summe der negativen Abweichungen vom Durchschnitt
  const slots = -slotsPerDay.reduce((sum, v) => sum + Math.abs(v - avg), 0);

  fitness += slots;

  const weekWorkTime = c
    .getWorkTimePerDayInMinute()
    .reduce((sum, v) => sum + v, 0);

  const workTimeAvg = weekWorkTime / slotsPerDay.length;

  const workTime = -c
    .getWorkTimePerDayInMinute()
    .reduce((sum, v) => sum + Math.abs(v - workTimeAvg), 0);

  fitness += workTime;

  const workTimeOnSunday = c.getWorkingTimeOnSunday();

  fitness -= workTimeOnSunday * 2;

  for (const dayIntervals of c.intervals) {
    for (const slot of dayIntervals) {
      // Je später, desto mehr Punkte
      fitness += slot.start.hour() + slot.start.minute() / 60;
    }
  }

  return fitness;
}

function mutate(c: Calendar, appointments: Appointment[]): Calendar {
  // Alle Intervalle kopieren
  const newIntervals: Intervall[] = [];
  for (const day of c.intervals) {
    newIntervals.push(...day);
  }

  // Anzahl der zu mutierenden Termine zufällig zwischen 1 und 20 (oder max vorhandene)
  const maxMutations = Math.min(1, 20);
  const numMutations = 1 + Math.floor(Math.random() * maxMutations);

  for (let i = 0; i < numMutations; i++) {
    const idx = Math.floor(Math.random() * newIntervals.length);
    const interval = newIntervals[idx];

    if (interval.appointment instanceof FlexibleAppointment) {
      // Zufälligen Tag auswählen
      const randomDay = Math.floor(Math.random() * 7);

      const shouldSplit = Math.random() < 0.5;

      if (shouldSplit && interval.appointment.allowSplitting) {
        const totalDuration = interval.appointment.duration.asMinutes();

        // Anzahl Stunden im Termin (z. B. 180 Min = 3 Stunden)
        const fullMinutes = Math.floor(totalDuration / 30);

        // Wenn der Termin kürzer als 2 Stunden ist → nicht splitten
        if (fullMinutes > 1) {
          // Mögliche Cuts: jede volle Stunde
          const possibleCuts = Array.from(
            { length: fullMinutes - 1 },
            (_, i) => (i + 1) * 30
          );

          const maxParts = Math.min(4, fullMinutes, possibleCuts.length + 1);
          const numParts = 2 + Math.floor(Math.random() * (maxParts - 1));

          // Zufällige Auswahl aus diesen Stunden
          const cutPoints = new Set<number>();
          while (cutPoints.size < numParts - 1) {
            const cut =
              possibleCuts[Math.floor(Math.random() * possibleCuts.length)];
            cutPoints.add(cut);
          }

          const sortedCuts = [...cutPoints].sort((a, b) => a - b);

          // Startzeit merken
          let currentStart = interval.start.clone();
          let lastPoint = 0;

          const splitted: Intervall[] = [];

          for (const cut of [...sortedCuts, totalDuration]) {
            const partDuration = cut - lastPoint;

            const newAppt = new FlexibleAppointment(
              interval.appointment.name,
              moment.duration(partDuration, "minutes"),
              interval.appointment.priority,
              interval.appointment.preference,
              interval.appointment.allowSplitting
            );

            const newInterval: Intervall = new Intervall(
              currentStart.clone(),
              currentStart.clone().add(partDuration, "minutes"),
              interval.appointment.priority,
              newAppt
            );

            splitted.push(newInterval);

            currentStart = newInterval.end.clone();
            lastPoint = cut;
          }

          // Ersetze das alte Intervall durch die Splits
          newIntervals.splice(idx, 1, ...splitted);
          continue; // fertig mit dieser Mutation
        }
      }

      // Alle Intervalle am neuen Tag filtern
      const dayIntervals = newIntervals.filter((int) =>
        int.start.isSame(
          interval.start
            .clone()
            .add(randomDay - interval.start.weekday(), "days"),
          "day"
        )
      );

      // Neuen Slot generieren
      const newSlot = generateRandomSlot(
        interval.appointment,
        randomDay,
        dayIntervals
      );

      if (newSlot) {
        newIntervals[idx] = newSlot;
      }
    }
  }

  return new Calendar(newIntervals);
}

function crossover(a: Calendar, b: Calendar): Calendar {
  const childIntervals: Intervall[] = [];
  const usedAppointments = new Set<string>();

  // Alle flexiblen und festen Appointments aus beiden Eltern sammeln
  const allAppointments: Intervall[] = [];
  for (const day of a.intervals) allAppointments.push(...day);
  for (const day of b.intervals) allAppointments.push(...day);

  // shuffle array, damit random Reihenfolge
  const shuffled = allAppointments.sort(() => Math.random() - 0.5);

  for (const inter of shuffled) {
    const key = inter.appointment.id; // besser: eindeutige ID
    if (usedAppointments.has(key)) continue; // nur einmal pro Appointment

    // zufälligen Parent wählen
    const parent = Math.random() < 0.5 ? a : b;

    // alle Intervalle des gewählten Parents für diesen Appointment filtern
    const candidateIntervals = parent.intervals
      .flat()
      .filter((i) => i.appointment.id === key);

    if (candidateIntervals.length === 0) continue;

    // zufälligen Slot aus dem Parent auswählen
    const slot =
      candidateIntervals[Math.floor(Math.random() * candidateIntervals.length)];

    // in Child einfügen
    childIntervals.push(slot);
    usedAppointments.add(key);
  }

  return new Calendar(childIntervals);
}

export function generateIntervals(appointments: Appointment[]): Intervall[] {
  const intervals: Intervall[] = [];

  for (const appointment of appointments) {
    if (appointment instanceof FixedAppointment) {
      // feste Termine direkt übernehmen
      intervals.push(
        new Intervall(appointment.start, appointment.end, Infinity, appointment)
      );
    } else if (appointment instanceof FlexibleAppointment) {
      // für flexible Termine random Day + Slot erzeugen
      const randomDay = Math.floor(Math.random() * weekDays.length);
      const dayIntervals = intervals.filter((i) =>
        i.start.isSame(startTime.clone().add(randomDay, "day"), "day")
      );

      const slot = generateRandomSlot(appointment, randomDay, dayIntervals);
      if (slot) {
        intervals.push(slot);
      }
    }
  }

  return intervals;
}

function generatePopulation(
  appointments: Appointment[],
  size: number
): Calendar[] {
  const population: Calendar[] = [];
  for (let i = 0; i < size; i++) {
    population.push(new Calendar(generateIntervals(appointments)));
  }
  return population;
}

//implementation of roulette based selection
export function selection(population: Calendar[], limit: number) {
  const fitnesses = population.map((ind) => computeFitness(ind));
  const sumOfFitness = fitnesses.reduce((a, b) => a + b, 0);

  // kumulative Wahrscheinlichkeit
  const cumulative: number[] = [];
  let acc = 0;
  for (const f of fitnesses) {
    acc += f / sumOfFitness;
    cumulative.push(acc);
  }

  const newPop: Calendar[] = [];
  for (let n = 0; n < limit; n++) {
    const r = Math.random();
    // finde das Individuum, dessen kumulative Wahrscheinlichkeit >= r ist
    const idx = cumulative.findIndex((c) => c >= r);
    newPop.push(population[idx]);
  }

  return newPop;
}

export function generateCalendar(
  appointments: Appointment[],
  generations = 1000,
  popSize = 300
) {
  const constrainedAppointments = appointments.filter(
    (a) => a instanceof ConstrainedAppointment
  );

  if (constrainedAppointments.length > 0) {
    const convertedConstrainedAppointments = scheduleContstrainedAppointment(
      constrainedAppointments
    );

    appointments = [
      ...appointments.filter((a) => !(a instanceof ConstrainedAppointment)),
      ...convertedConstrainedAppointments,
    ];
  }

  let population = generatePopulation(appointments, popSize);

  for (let gen = 0; gen < generations; gen++) {
    // Fitness berechnen
    const scored = population.map((ind) => ({
      ind,
      fitness: computeFitness(ind),
    }));
    scored.sort((a, b) => b.fitness - a.fitness);

    // Top 5 direkt behalten
    const elite = scored.slice(0, 4).map((s) => s.ind);

    // Rest mit Roulette-Selektion

    const offspring: Calendar[] = [];

    for (const individuum of population) {
      if (Math.random() < 0.4) {
        offspring.push(mutate(individuum, appointments));
      }

      if (Math.random() < 0.3) {
        const secondParent =
          population[Math.floor(Math.random() * population.length)];

        offspring.push(crossover(individuum, secondParent));
      }
    }

    const rest = selection(
      [...population, ...offspring],
      popSize - elite.length
    );
    const newPop: Calendar[] = [...elite, ...rest];
    population = newPop;

    console.log(
      "Generation",
      gen,
      population.map((ind) => computeFitness(ind))[0]
    );
  }

  // bestes Individuum zurückgeben
  return population.reduce((best, ind) =>
    computeFitness(ind) > computeFitness(best) ? ind : best
  );
}

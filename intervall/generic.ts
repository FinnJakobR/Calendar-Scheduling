import moment from "moment";
import Appointment from "../appointments/appointment";
import FlexibleAppointment from "../appointments/flexible_appointments";
import FixedAppointment from "../appointments/fixed_appointments";
import Intervall from "./intervall";
import Calendar from "../calendar/calendar";
import { startTime, endTime, weekDays } from "../settings/settings";
import ConstrainedAppointment from "../appointments/constrained_appointment";
import scheduleContstrainedAppointment from "./scheudling";

const MAX_ATTEMPTS = 100; // maximale Versuche, einen Slot zu finden

// Prüft, ob ein neues Intervall mit bestehenden Intervallen des gleichen Tages überlappt
function checkIfOverlaps(dayIntervals: Intervall[], newInterval: Intervall) {
  return dayIntervals.some(
    (i) =>
      newInterval.start.isBetween(i.start, i.end, undefined, "[)") ||
      newInterval.end.isBetween(i.start, i.end, undefined, "(]")
  );
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

  if (availableMinutes <= 0)
    throw new Error("Appointment longer than available day");

  let attempts = 0;
  let slot: Intervall;

  do {
    const randomOffset = Math.floor(Math.random() * availableMinutes);
    const start = dayStart.clone().add(randomOffset, "minutes");
    const end = start.clone().add(appointment.duration);
    slot = new Intervall(start, end, 1, appointment);
    attempts++;
  } while (checkIfOverlaps(dayIntervals, slot) && attempts < MAX_ATTEMPTS);

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

  // Anzahl der zu mutierenden Termine zufällig zwischen 1 und 3 (oder max vorhandene)
  const maxMutations = Math.min(1, 20);
  const numMutations = 1 + Math.floor(Math.random() * maxMutations);

  for (let i = 0; i < numMutations; i++) {
    const idx = Math.floor(Math.random() * newIntervals.length);
    const interval = newIntervals[idx];

    if (interval.appointment instanceof FlexibleAppointment) {
      // Zufälligen Tag auswählen
      const randomDay = Math.floor(Math.random() * 7);

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
    const elite = scored.slice(0, 2).map((s) => s.ind);

    // Rest mit Roulette-Selektion

    const offspring: Calendar[] = [];

    for (const individuum of population) {
      if (Math.random() < 0.05) {
        offspring.push(mutate(individuum, appointments));
      }

      if (Math.random() < 0.2) {
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

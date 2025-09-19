import ConstrainedAppointment, {
  ConstrainedInterval,
} from "../appointments/constrained_appointment";
import { faker } from "@faker-js/faker";
import FlexibleAppointment from "../appointments/flexible_appointments";
import moment from "moment";
import { AppointmentPreferences } from "../appointments/appointment";
/**
 * Generiert Dummy Appointments
 * @param numConstrained Anzahl ConstrainedAppointments
 * @param numFlexible Anzahl FlexibleAppointments
 */
export function generateFakeAppointments(
  numConstrained: number,
  numFlexible: number
) {
  const constrainedAppointments: ConstrainedAppointment[] = [];
  const flexibleAppointments: FlexibleAppointment[] = [];

  // --- ConstrainedAppointments ---
  for (let i = 0; i < numConstrained; i++) {
    const numIntervals = faker.number.int({ min: 1, max: 2 });
    const intervals: ConstrainedInterval[] = [];

    for (let j = 0; j < numIntervals; j++) {
      const weekday = faker.number.int({ min: 0, max: 6 }); // SU-SAT
      const startHour = faker.number.int({ min: 9, max: 16 });
      const durationHours = faker.number.int({ min: 1, max: 3 });
      const priority = faker.number.int({ min: 1, max: 100 });

      const start = moment().hour(startHour).minute(0).second(0);
      const end = start.clone().add(durationHours, "hours");

      intervals.push(new ConstrainedInterval(weekday, start, end, priority));
    }

    constrainedAppointments.push(
      new ConstrainedAppointment(faker.company.name(), intervals)
    );
  }

  // --- FlexibleAppointments ---
  for (let i = 0; i < numFlexible; i++) {
    const durationMinutes = faker.number.int({ min: 1, max: 45 });

    flexibleAppointments.push(
      new FlexibleAppointment(
        faker.person.firstName(),
        moment.duration(durationMinutes, "minute"),
        1,
        AppointmentPreferences.Unset
      )
    );
  }

  return [...constrainedAppointments, ...flexibleAppointments];
}

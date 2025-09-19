import Appointment from "./appointments/appointment";
import { generateCalendar } from "./intervall/generic";
import { generateFakeAppointments } from "./dummy/generate_dummy_appointments";

const dummyAppointments: Appointment[] = generateFakeAppointments(3, 15);

const main = () => {
  const scheduledList = generateCalendar(dummyAppointments);
  console.log(scheduledList.intervals);
};

main();

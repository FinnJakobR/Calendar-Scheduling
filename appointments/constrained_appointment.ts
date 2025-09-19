import moment, { Moment } from "moment";
import Appointment, {
  AppointmentWeekDays,
  ConstrainedInterval,
} from "./appointment";

export default class ConstrainedAppointment extends Appointment {
  public appointments: ConstrainedInterval[];
  public used: boolean = false;

  constructor(
    name: string,
    days: ConstrainedInterval[],
    allowSplitting: boolean
  ) {
    super(name, allowSplitting);
    this.appointments = days;
  }
}

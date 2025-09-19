import moment from "moment";
import Appointment, {
  AppointmentPreferences,
  ConstrainedInterval,
} from "./appointment";

export default class FlexibleAppointment extends Appointment {
  public duration: moment.Duration;
  public deadline?: ConstrainedInterval;
  public priority: number;
  public preference: AppointmentPreferences;
  public used: boolean = false;

  constructor(
    name: string,
    duration: moment.Duration,
    priority: number,
    preferences: AppointmentPreferences,
    allowSplitting: boolean
  ) {
    super(name, allowSplitting);
    this.duration = duration;
    this.priority = priority;
    this.preference = preferences;
  }
}

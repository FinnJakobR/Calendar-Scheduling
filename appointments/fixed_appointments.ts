import Appointment from "./appointment";
import moment from "moment";

export default class FixedAppointment extends Appointment {
  public start: moment.Moment;
  public end: moment.Moment;

  constructor(name: string, start: moment.Moment, end: moment.Moment) {
    super(name);
    this.start = start;
    this.end = end;
  }
}

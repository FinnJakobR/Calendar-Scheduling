import moment from "moment";
import Appointment from "../appointments/appointment";

export default class Intervall {
  public start: moment.Moment;
  public end: moment.Moment;
  public weight: number;
  public appointment: Appointment;

  constructor(
    start: moment.Moment,
    end: moment.Moment,
    weight: number,
    appointment: Appointment
  ) {
    this.start = start;
    this.end = end;
    this.weight = weight;
    this.appointment = appointment;
  }
}

import moment, { Moment } from "moment";
import Appointment, { AppointmentWeekDays } from "./appointment";

export class ConstrainedInterval {
  public weekDay: AppointmentWeekDays;
  public start: moment.Moment;
  public end: moment.Moment;
  public priority: number;

  constructor(
    weekday: AppointmentWeekDays,
    startTime: Moment,
    endTime: Moment,
    priority?: number
  ) {
    this.weekDay = weekday;
    this.start = this.getNextWeekdayDate(
      this.weekDay,
      startTime.format("HH:mm")
    );
    this.end = this.getNextWeekdayDate(this.weekDay, endTime.format("HH:mm"));
    this.priority = priority || 1;
  }

  private getNextWeekdayDate(
    weekday: AppointmentWeekDays,
    time: string
  ): Moment {
    const now = moment();
    // moment: 0=Sonntag, 1=Montag, … → gleiche Reihenfolge wie dein Enum!
    let target = moment()
      .day(weekday)
      .set({
        hour: parseInt(time.split(":")[0]),
        minute: parseInt(time.split(":")[1]),
        second: 0,
        millisecond: 0,
      });

    // falls der Zeitpunkt schon vorbei ist → nächste Woche
    if (target.isBefore(now)) {
      target.add(7, "days");
    }
    return target;
  }
}

export default class ConstrainedAppointment extends Appointment {
  public appointments: ConstrainedInterval[];
  public used: boolean = false;

  constructor(name: string, days: ConstrainedInterval[]) {
    super(name);
    this.appointments = days;
  }
}

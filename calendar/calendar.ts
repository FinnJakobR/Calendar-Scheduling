import moment from "moment";
import Intervall from "../intervall/intervall";
import Appointment from "../appointments/appointment";

export default class Calendar {
  public intervals: Intervall[][] = [[], [], [], [], [], [], []];

  constructor(intervalls: Intervall[]) {
    for (const inter of intervalls) {
      const weekDay = inter.start.weekday();
      this.intervals[weekDay].push(inter);
    }
  }

  getSlotsPerDay() {
    return this.intervals.map((i) => i.length + 1);
  }

  getWorkTimePerDayInMinute() {
    return this.intervals.map((i) =>
      i.reduce((sum, v) => sum + v.end.diff(v.start, "minute"), 0)
    );
  }

  findByDate(date: moment.Moment): Appointment | undefined {
    const weekDay = date.weekday();

    const appointments = this.intervals[weekDay];

    const foundAppointment = appointments.find((a) =>
      date.isBetween(a.start, a.end)
    );

    return foundAppointment?.appointment;
  }

  getWorkingTimeOnSunday() {
    const sundayIntervals = this.intervals[0];
    const saturdayIntervals = this.intervals[this.intervals.length - 1];

    return (
      saturdayIntervals.reduce(
        (sum, v) => sum + v.end.diff(v.start, "minute"),
        0
      ) +
      sundayIntervals.reduce((sum, v) => sum + v.end.diff(v.start, "minute"), 0)
    );
  }
}

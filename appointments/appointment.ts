import * as crypto from "crypto";

export enum AppointmentPreferences {
  Unset,
  Morning,
  Afternoon,
  Night,
}

export enum AppointmentWeekDays {
  SU,
  MO,
  DI,
  MI,
  DO,
  FR,
  SA,
}

export default class Appointment {
  public name: string;
  public id: string;

  constructor(name: string) {
    this.name = name;
    this.id = crypto.randomUUID();
  }
}

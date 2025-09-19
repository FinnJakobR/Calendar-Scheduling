import moment from "moment";

export const intervalLength = 30;
export const weekDays: string[] = moment.weekdays();
export const startTime: moment.Moment = moment("8:00", "HH:mm");
export const endTime: moment.Moment = moment("23:30", "HH:mm");

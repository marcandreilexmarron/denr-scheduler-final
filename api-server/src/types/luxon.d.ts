declare module "luxon" {
  export class DateTime {
    static now(): DateTime;
    static fromObject(obj: any): DateTime;
    hasSame(other: DateTime, unit: string): boolean;
    get day(): number;
    get month(): number;
    get year(): number;
    get daysInMonth(): number;
    toFormat(fmt: string): string;
    minus(obj: any): DateTime;
    plus(obj: any): DateTime;
    readonly weekday: number;
  }
}

import { describe, it, expect } from "vitest";
import {
  civilMinute,
  civilDate,
  addCivilDays,
  addCivilHours,
  spotLocalNow,
  toYyyymmdd,
  hourIsOpen,
  civilMidpoint,
  formatCivilClock,
  formatCivilWeekdayShort,
  formatCivilWindow,
} from "../civil-time";

describe("civilMinute", () => {
  it("truncates seconds", () => {
    expect(civilMinute("2026-02-14T12:00:00")).toBe("2026-02-14T12:00");
  });

  it("accepts a space separator from NOAA", () => {
    expect(civilMinute("2026-02-14 12:00")).toBe("2026-02-14T12:00");
  });

  it("promotes a date-only string to midnight", () => {
    expect(civilMinute("2026-02-14")).toBe("2026-02-14T00:00");
  });
});

describe("addCivilDays", () => {
  it("adds days on the calendar, including month rollover", () => {
    expect(addCivilDays("2026-02-14", 3)).toBe("2026-02-17");
    expect(addCivilDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("does not shift the date via host timezone", () => {
    // A UTC+12 host used to turn T00:00 into the previous UTC date.
    expect(addCivilDays("2026-08-16", 3)).toBe("2026-08-19");
  });
});

describe("addCivilHours / hourIsOpen", () => {
  it("rolls across midnight", () => {
    expect(addCivilHours("2026-02-14T23:00", 1)).toBe("2026-02-15T00:00");
  });

  it("treats an hour as open until the next hour", () => {
    expect(hourIsOpen("2026-02-14T11:00", "2026-02-14T11:30")).toBe(true);
    expect(hourIsOpen("2026-02-14T11:00", "2026-02-14T12:00")).toBe(false);
  });
});

describe("spotLocalNow", () => {
  const utc = new Date("2026-08-16T21:00:00.000Z");

  it("UTC−10 (Hawaii) afternoon", () => {
    expect(spotLocalNow(-10 * 3600, utc)).toBe("2026-08-16T11:00");
  });

  it("UTC+12 next calendar morning", () => {
    expect(spotLocalNow(12 * 3600, utc)).toBe("2026-08-17T09:00");
  });

  it("UTC itself", () => {
    expect(spotLocalNow(0, utc)).toBe("2026-08-16T21:00");
  });
});

describe("toYyyymmdd", () => {
  it("formats a civil date for NOAA", () => {
    expect(toYyyymmdd("2026-08-16T11:00")).toBe("20260816");
    expect(toYyyymmdd("2026-08-16")).toBe("20260816");
  });
});

describe("formatters", () => {
  it("formats clock and weekday from civil parts, not the host TZ", () => {
    expect(formatCivilClock("2026-02-14T09:30")).toBe("09:30");
    expect(formatCivilWeekdayShort("2026-02-14")).toBe("Sat");
    expect(formatCivilWindow("2026-02-14T10:00", "2026-02-14T13:00")).toBe(
      "Sat, Feb 14 10:00 – 13:00",
    );
  });
});

describe("civilMidpoint", () => {
  it("averages two civil times", () => {
    expect(civilMidpoint("2026-02-14T10:00", "2026-02-14T14:00")).toBe(
      "2026-02-14T12:00",
    );
  });
});

describe("civilDate", () => {
  it("returns the YYYY-MM-DD prefix", () => {
    expect(civilDate("2026-02-14T15:00")).toBe("2026-02-14");
  });
});

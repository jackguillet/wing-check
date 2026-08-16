import { describe, it, expect } from "vitest";
import {
  createSpotSchema,
  updateCriteriaSchema,
  updatePreferencesSchema,
  spotNotesSchema,
  updateSpotSchema,
  formDataToObject,
  kitPresetNameSchema,
} from "../validations";

describe("createSpotSchema", () => {
  it("accepts valid spot data", () => {
    const result = createSpotSchema.safeParse({
      name: "Test Spot",
      latitude: "37.7749",
      longitude: "-122.4194",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Test Spot");
      expect(result.data.latitude).toBe(37.7749);
      expect(result.data.longitude).toBe(-122.4194);
      expect(result.data.minWindSpeed).toBe(10); // default
    }
  });

  it("rejects empty name", () => {
    const result = createSpotSchema.safeParse({
      name: "",
      latitude: "37",
      longitude: "-122",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid latitude (> 90)", () => {
    const result = createSpotSchema.safeParse({
      name: "Test",
      latitude: "999",
      longitude: "-122",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid latitude (< -90)", () => {
    const result = createSpotSchema.safeParse({
      name: "Test",
      latitude: "-91",
      longitude: "-122",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid longitude (> 180)", () => {
    const result = createSpotSchema.safeParse({
      name: "Test",
      latitude: "37",
      longitude: "181",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric latitude", () => {
    const result = createSpotSchema.safeParse({
      name: "Test",
      latitude: "abc",
      longitude: "-122",
    });
    expect(result.success).toBe(false);
  });

  it("applies defaults for optional fields", () => {
    const result = createSpotSchema.safeParse({
      name: "Test",
      latitude: "37",
      longitude: "-122",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minWindSpeed).toBe(10);
      expect(result.data.maxWindSpeed).toBe(25);
      expect(result.data.maxGustFactor).toBe(2.5);
      expect(result.data.directionTolerance).toBe(45);
      expect(result.data.minConsecutiveHours).toBe(2);
    }
  });

  it("rejects name that is too long", () => {
    const result = createSpotSchema.safeParse({
      name: "a".repeat(101),
      latitude: "37",
      longitude: "-122",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative wind speed", () => {
    const result = createSpotSchema.safeParse({
      name: "Test",
      latitude: "37",
      longitude: "-122",
      minWindSpeed: "-5",
    });
    expect(result.success).toBe(false);
  });

  it("rejects gust factor below 1", () => {
    const result = createSpotSchema.safeParse({
      name: "Test",
      latitude: "37",
      longitude: "-122",
      maxGustFactor: "0.5",
    });
    expect(result.success).toBe(false);
  });

  it("rejects min wind greater than max wind", () => {
    const result = createSpotSchema.safeParse({
      name: "Test",
      latitude: "37",
      longitude: "-122",
      minWindSpeed: "30",
      maxWindSpeed: "10",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateCriteriaSchema", () => {
  it("accepts valid criteria", () => {
    const result = updateCriteriaSchema.safeParse({
      minWindSpeed: "12",
      maxWindSpeed: "30",
      maxGustFactor: "2.0",
      preferredDirections: "[270, 180]",
      directionTolerance: "60",
      minConsecutiveHours: "3",
      maxWaveHeight: "2.0",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minWindSpeed).toBe(12);
      expect(result.data.maxWaveHeight).toBe(2.0);
    }
  });

  it("applies defaults for missing fields", () => {
    const result = updateCriteriaSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minWindSpeed).toBe(10);
      expect(result.data.maxWindSpeed).toBe(25);
    }
  });

  it("rejects out-of-range direction tolerance", () => {
    const result = updateCriteriaSchema.safeParse({
      directionTolerance: "200",
    });
    expect(result.success).toBe(false);
  });

  it("rejects min wind greater than max wind", () => {
    const result = updateCriteriaSchema.safeParse({
      minWindSpeed: "40",
      maxWindSpeed: "12",
    });
    expect(result.success).toBe(false);
  });
});

describe("updatePreferencesSchema", () => {
  it("accepts valid preferences", () => {
    const result = updatePreferencesSchema.safeParse({
      email: "test@example.com",
      alertsEnabled: "on",
      checkIntervalHours: "12",
      windSpeedUnit: "knots",
      temperatureUnit: "celsius",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty email", () => {
    const result = updatePreferencesSchema.safeParse({
      email: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = updatePreferencesSchema.safeParse({
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid wind speed unit", () => {
    const result = updatePreferencesSchema.safeParse({
      windSpeedUnit: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects check interval too high", () => {
    const result = updatePreferencesSchema.safeParse({
      checkIntervalHours: "200",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateSpotSchema", () => {
  it("accepts a pin edit", () => {
    const result = updateSpotSchema.safeParse({
      name: "Local Beach",
      latitude: "18.1",
      longitude: "-63.0",
      noaaStationId: "1234567",
      notes: "launch south",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = updateSpotSchema.safeParse({
      name: "",
      latitude: "18",
      longitude: "-63",
    });
    expect(result.success).toBe(false);
  });
});

describe("spotNotesSchema", () => {
  it("accepts notes up to 500 characters", () => {
    expect(spotNotesSchema.safeParse("a".repeat(500)).success).toBe(true);
  });

  it("rejects notes longer than 500 characters", () => {
    const result = spotNotesSchema.safeParse("a".repeat(501));
    expect(result.success).toBe(false);
  });
});

describe("kitPresetNameSchema", () => {
  it("trims and accepts a short name", () => {
    const result = kitPresetNameSchema.safeParse("  Lake  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("Lake");
  });

  it("rejects an empty name", () => {
    expect(kitPresetNameSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects names longer than 40 characters", () => {
    expect(kitPresetNameSchema.safeParse("x".repeat(41)).success).toBe(false);
  });
});

describe("formDataToObject", () => {
  it("converts FormData to a plain object", () => {
    const fd = new FormData();
    fd.append("name", "Test");
    fd.append("latitude", "37.0");
    const obj = formDataToObject(fd);
    expect(obj).toEqual({ name: "Test", latitude: "37.0" });
  });

  it("skips non-string values", () => {
    const fd = new FormData();
    fd.append("name", "Test");
    fd.append("file", new Blob(["test"]), "test.txt");
    const obj = formDataToObject(fd);
    expect(obj).toEqual({ name: "Test" });
  });
});

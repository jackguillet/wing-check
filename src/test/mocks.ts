import type {
  Spot,
  AlertCriteria,
  Preferences,
  UserSpot,
} from "@/lib/db/schema";

export function mockSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 1,
    userId: "user-1",
    name: "Test Spot",
    slug: "test-spot",
    latitude: 37.7749,
    longitude: -122.4194,
    noaaStationId: "9414290",
    notes: null,
    visibility: "public",
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function mockCriteria(
  overrides: Partial<AlertCriteria> = {},
): AlertCriteria {
  return {
    id: 1,
    spotId: 1,
    minWindSpeed: 10,
    maxWindSpeed: 25,
    maxGustFactor: 2.5,
    preferredDirections: '["N","NW"]',
    directionTolerance: 45,
    minConsecutiveHours: 2,
    maxWaveHeight: 1.5,
    ...overrides,
  };
}

export function mockPreferences(
  overrides: Partial<Preferences> = {},
): Preferences {
  return {
    id: 1,
    userId: "user-1",
    email: "test@example.com",
    alertsEnabled: true,
    checkIntervalHours: 6,
    windSpeedUnit: "knots",
    temperatureUnit: "celsius",
    minWindSpeed: null,
    maxWindSpeed: null,
    maxGustFactor: null,
    preferredDirections: null,
    directionTolerance: null,
    minConsecutiveHours: null,
    maxWaveHeight: null,
    ...overrides,
  };
}

export function mockUserSpot(overrides: Partial<UserSpot> = {}): UserSpot {
  return {
    id: 1,
    userId: "user-1",
    spotId: 1,
    isFavorite: true,
    alertsEnabled: true,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function mockSession(
  overrides: { userId?: string; email?: string } = {},
) {
  return {
    user: {
      id: overrides.userId ?? "user-1",
      name: "Test User",
      email: overrides.email ?? "test@example.com",
      emailVerified: true,
      image: null,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
    session: {
      id: "session-1",
      token: "test-token",
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: "127.0.0.1",
      userAgent: "test",
      userId: overrides.userId ?? "user-1",
    },
  };
}

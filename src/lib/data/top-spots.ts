export const SYSTEM_USER_ID = "system-wingcheck";

export interface TopSpot {
  name: string;
  latitude: number;
  longitude: number;
  noaaStationId?: string;
  notes: string;
  alertCriteria?: {
    minWindSpeed?: number;
    maxWindSpeed?: number;
    maxGustFactor?: number;
    preferredDirections?: string;
    directionTolerance?: number;
    minConsecutiveHours?: number;
    maxWaveHeight?: number | null;
  };
}

export const TOP_SPOTS: TopSpot[] = [
  // ── Hawaii ──
  {
    name: "Kailua Beach",
    latitude: 21.3964,
    longitude: -157.7253,
    notes: "Oahu's windward side. Consistent NE trades, flat water inside reef. Great for all levels.",
    alertCriteria: { preferredDirections: "[45, 60, 75]", minWindSpeed: 12 },
  },
  {
    name: "Kanaha Beach",
    latitude: 20.8952,
    longitude: -156.4378,
    notes: "Maui north shore. Reliable afternoon trades. Flat water launch, chop further out.",
    alertCriteria: { preferredDirections: "[45, 60, 75, 90]", maxWindSpeed: 30 },
  },

  // ── US West Coast ──
  {
    name: "Sherman Island",
    latitude: 38.0394,
    longitude: -121.7985,
    noaaStationId: "9415020",
    notes: "Sacramento River Delta. Strong thermal winds, flat water. Can be very gusty.",
    alertCriteria: { preferredDirections: "[240, 260, 280]", minWindSpeed: 18, maxWindSpeed: 30 },
  },
  {
    name: "Alameda Beach",
    latitude: 37.7695,
    longitude: -122.2780,
    noaaStationId: "9414750",
    notes: "SF Bay. Protected from ocean swell. Afternoon westerlies.",
    alertCriteria: { preferredDirections: "[270, 290]" },
  },
  {
    name: "3rd Avenue Beach",
    latitude: 37.5934,
    longitude: -122.3971,
    noaaStationId: "9414523",
    notes: "San Mateo, SF Bay. Side-shore thermals, good for downwinders.",
    alertCriteria: { preferredDirections: "[270, 290, 310]" },
  },
  {
    name: "Waddell Creek Beach",
    latitude: 37.1157,
    longitude: -122.2774,
    noaaStationId: "9413450",
    notes: "Santa Cruz county. NW winds, ocean swell and waves. Advanced riders.",
    alertCriteria: { preferredDirections: "[290, 310, 330]", maxWindSpeed: 30, maxWaveHeight: 2.5 },
  },

  // ── US Pacific Northwest ──
  {
    name: "Hood River",
    latitude: 45.7168,
    longitude: -121.5122,
    notes: "Columbia River Gorge. World-famous thermal winds. Strong & consistent summer afternoons.",
    alertCriteria: { preferredDirections: "[270, 280, 290]", minWindSpeed: 18, maxWindSpeed: 35 },
  },
  {
    name: "Stevenson",
    latitude: 45.6946,
    longitude: -121.8856,
    notes: "Columbia River Gorge. Slightly less wind than Hood River, more beginner friendly.",
    alertCriteria: { preferredDirections: "[270, 280]" },
  },
  {
    name: "Quartermaster Harbor",
    latitude: 47.3950,
    longitude: -122.4630,
    notes: "South Vashon Island, Puget Sound. Sheltered harbor with S-SW wind exposure. Flat water.",
    alertCriteria: { preferredDirections: "[180, 200, 220]" },
  },

  // ── US East Coast ──
  {
    name: "Cape Hatteras",
    latitude: 35.2232,
    longitude: -75.6349,
    noaaStationId: "8654467",
    notes: "Outer Banks, NC. Flat-water sound side or ocean waves. Best fall & spring.",
    alertCriteria: { preferredDirections: "[200, 220, 240]", maxWindSpeed: 30 },
  },
  {
    name: "Nags Head",
    latitude: 35.9573,
    longitude: -75.6241,
    noaaStationId: "8651370",
    notes: "Outer Banks, NC. Sound-side flat water with thermal SW winds.",
    alertCriteria: { preferredDirections: "[200, 220, 240]" },
  },
  {
    name: "Cocoa Beach",
    latitude: 28.3200,
    longitude: -80.6076,
    noaaStationId: "8721604",
    notes: "Florida Space Coast. East swells with NE wind. Good for wave riding.",
    alertCriteria: { preferredDirections: "[45, 60, 75, 90]" },
  },
  {
    name: "South Padre Island",
    latitude: 26.1118,
    longitude: -97.1681,
    noaaStationId: "8779770",
    notes: "Texas. Consistent SE trades, flat bay water. Great for beginners & freestyle.",
    alertCriteria: { preferredDirections: "[135, 150, 165]" },
  },
  {
    name: "Montauk",
    latitude: 41.0431,
    longitude: -71.9457,
    noaaStationId: "8510560",
    notes: "Long Island, NY. SW thermals in summer, NW after cold fronts. Ocean waves.",
    alertCriteria: { preferredDirections: "[200, 220, 310, 330]" },
  },

  // ── US Great Lakes ──
  {
    name: "Traverse City",
    latitude: 44.7631,
    longitude: -85.6206,
    notes: "Lake Michigan. Fresh water, SW summer thermals. Best June–September.",
    alertCriteria: { preferredDirections: "[220, 240, 260]" },
  },

  // ── Caribbean ──
  {
    name: "Cabarete",
    latitude: 19.7589,
    longitude: -70.4158,
    notes: "Dominican Republic. Consistent E trades, reef-protected flat water. World-class spot.",
    alertCriteria: { preferredDirections: "[60, 75, 90, 105]", minWindSpeed: 14 },
  },
  {
    name: "Orient Bay",
    latitude: 18.0976,
    longitude: -63.0266,
    notes: "St. Martin. NE trades, turquoise flat water. Great winter escape.",
    alertCriteria: { preferredDirections: "[45, 60, 75, 90]" },
  },
  {
    name: "Bonaire",
    latitude: 12.1696,
    longitude: -68.2686,
    notes: "ABC Islands. Constant E trades, flat water lagoon at Lac Bay. Reliable year-round.",
    alertCriteria: { preferredDirections: "[75, 90, 105]", minWindSpeed: 14 },
  },

  // ── Central & South America ──
  {
    name: "Jericoacoara",
    latitude: -2.7947,
    longitude: -40.5117,
    notes: "Brazil. Strong & steady E trades Jul–Jan. Flat lagoons and ocean waves.",
    alertCriteria: { preferredDirections: "[75, 90, 105, 120]", minWindSpeed: 18, maxWindSpeed: 30 },
  },
  {
    name: "La Ventana",
    latitude: 24.0468,
    longitude: -109.9875,
    notes: "Baja, Mexico. Strong El Norte winds Nov–Mar, flat water. Amazing camping scene.",
    alertCriteria: { preferredDirections: "[330, 345, 0, 15]", minWindSpeed: 18, maxWindSpeed: 30 },
  },

  // ── Europe – Spain & Portugal ──
  {
    name: "Tarifa",
    latitude: 36.0143,
    longitude: -5.6044,
    notes: "Southern Spain. Levante (E) or Poniente (W) winds. Can be very strong. Mecca of European wind sports.",
    alertCriteria: { preferredDirections: "[90, 270]", minWindSpeed: 18, maxWindSpeed: 35 },
  },
  {
    name: "Fuerteventura – Sotavento",
    latitude: 28.0700,
    longitude: -14.2412,
    notes: "Canary Islands. NE trades year-round. Flat lagoon at low tide.",
    alertCriteria: { preferredDirections: "[30, 45, 60]", minWindSpeed: 16 },
  },
  {
    name: "Lanzarote – Famara",
    latitude: 29.1020,
    longitude: -13.5556,
    notes: "Canary Islands. NW wind and waves. Great for wave riding.",
    alertCriteria: { preferredDirections: "[300, 315, 330]", maxWaveHeight: 2.5 },
  },
  {
    name: "Gran Canaria – Pozo Izquierdo",
    latitude: 27.8259,
    longitude: -15.4258,
    notes: "Canary Islands. Strong NE-E side-shore wind. Renowned for wave riding.",
    alertCriteria: { preferredDirections: "[30, 45, 60]", minWindSpeed: 18, maxWindSpeed: 35 },
  },

  // ── Europe – France ──
  {
    name: "Leucate – La Franqui",
    latitude: 42.9234,
    longitude: 3.0367,
    notes: "South France. Strong Tramontane NW wind, flat lagoon. European hot spot.",
    alertCriteria: { preferredDirections: "[300, 315, 330]", minWindSpeed: 18, maxWindSpeed: 35 },
  },
  {
    name: "Hyères – Almanarre",
    latitude: 43.0601,
    longitude: 6.1348,
    notes: "French Riviera. Mistral NW wind, flat water lagoon side. Summer spot.",
    alertCriteria: { preferredDirections: "[300, 315, 330]" },
  },

  // ── Europe – Italy & Greece ──
  {
    name: "Lake Garda – Torbole",
    latitude: 45.8750,
    longitude: 10.8738,
    notes: "Northern Italy. Ora (S) afternoon thermal, Pelèr (N) morning wind. Freshwater & stunning scenery.",
    alertCriteria: { preferredDirections: "[0, 180]", minWindSpeed: 12 },
  },
  {
    name: "Sardinia – Porto Pollo",
    latitude: 41.1876,
    longitude: 9.3526,
    notes: "North Sardinia. Mistral (NW) funnels between Sardinia & Corsica. Flat water bay.",
    alertCriteria: { preferredDirections: "[290, 310, 330]", minWindSpeed: 16, maxWindSpeed: 30 },
  },
  {
    name: "Rhodes – Prasonisi",
    latitude: 35.8880,
    longitude: 27.7650,
    notes: "Greece. Meltemi NW winds Jun–Sep. Sand spit with flat water one side, waves the other.",
    alertCriteria: { preferredDirections: "[300, 315, 330]", minWindSpeed: 16 },
  },
  {
    name: "Naxos – Mikri Vigla",
    latitude: 37.0166,
    longitude: 25.4793,
    notes: "Greek Cyclades. Meltemi NW summer winds. Beautiful beach, turquoise water.",
    alertCriteria: { preferredDirections: "[300, 315, 330]" },
  },

  // ── Europe – Netherlands & Germany ──
  {
    name: "Brouwersdam",
    latitude: 51.7498,
    longitude: 3.8632,
    notes: "Netherlands. North Sea dam creates flat water. Windy year-round, best spring–fall.",
    alertCriteria: { preferredDirections: "[200, 220, 240, 260]" },
  },
  {
    name: "Fehmarn",
    latitude: 54.4500,
    longitude: 11.2000,
    notes: "Germany, Baltic Sea. Reliable wind, multiple launch spots for different directions.",
  },

  // ── Africa – Morocco ──
  {
    name: "Essaouira",
    latitude: 31.5085,
    longitude: -9.7595,
    notes: "Morocco. Strong NE alizé trades, ocean swell. Legendary wind sport destination.",
    alertCriteria: { preferredDirections: "[15, 30, 45]", minWindSpeed: 18, maxWindSpeed: 30 },
  },
  {
    name: "Dakhla",
    latitude: 23.7148,
    longitude: -15.9352,
    notes: "Western Sahara/Morocco. Flat-water lagoon, NE trades year-round. World-class flatwater spot.",
    alertCriteria: { preferredDirections: "[15, 30, 45, 60]", minWindSpeed: 16, maxWindSpeed: 30 },
  },

  // ── Africa – Egypt & South Africa ──
  {
    name: "Dahab",
    latitude: 28.5007,
    longitude: 34.5131,
    notes: "Egypt, Red Sea. NW thermal wind, flat water lagoon. Warm water year-round.",
    alertCriteria: { preferredDirections: "[300, 315, 330]", minWindSpeed: 14 },
  },
  {
    name: "El Gouna",
    latitude: 27.1827,
    longitude: 33.8547,
    notes: "Egypt, Red Sea. Consistent N-NW thermal wind, shallow flat lagoon. Great for beginners.",
    alertCriteria: { preferredDirections: "[330, 345, 0]", minWindSpeed: 14 },
  },
  {
    name: "Langebaan",
    latitude: -33.0892,
    longitude: 18.1578,
    notes: "South Africa. Strong SE summer thermals, flat lagoon. Cape Town's premier flat-water spot.",
    alertCriteria: { preferredDirections: "[135, 150, 165, 180]", minWindSpeed: 18, maxWindSpeed: 30 },
  },
  {
    name: "Big Bay – Blouberg",
    latitude: -33.7948,
    longitude: 18.4541,
    notes: "Cape Town, South Africa. SE summer winds, Table Mountain downwind sessions.",
    alertCriteria: { preferredDirections: "[150, 165, 180]", minWindSpeed: 18 },
  },

  // ── Indian Ocean ──
  {
    name: "Le Morne",
    latitude: -20.4486,
    longitude: 57.3172,
    notes: "Mauritius. SE trades Jun–Nov, reef-protected lagoon, One Eye wave spot. Bucket-list destination.",
    alertCriteria: { preferredDirections: "[120, 135, 150]", minWindSpeed: 16, maxWindSpeed: 30 },
  },
  {
    name: "Zanzibar – Paje",
    latitude: -6.2672,
    longitude: 39.5361,
    notes: "Tanzania. SE trades Jun–Oct, NE Dec–Feb. Shallow flat water at low tide.",
    alertCriteria: { preferredDirections: "[120, 135, 150]" },
  },

  // ── Middle East ──
  {
    name: "Ras Sudr",
    latitude: 29.6036,
    longitude: 32.7057,
    notes: "Egypt, Gulf of Suez. Strong NW thermal wind funnels through the gulf. Flat water.",
    alertCriteria: { preferredDirections: "[300, 315, 330]", minWindSpeed: 16, maxWindSpeed: 30 },
  },

  // ── Asia ──
  {
    name: "Mui Ne",
    latitude: 10.9478,
    longitude: 108.2872,
    notes: "Vietnam. NE monsoon Nov–Apr, strong & steady. Flat inside, waves outside.",
    alertCriteria: { preferredDirections: "[30, 45, 60]", minWindSpeed: 16, maxWindSpeed: 28 },
  },
  {
    name: "Boracay – Bulabog",
    latitude: 11.9689,
    longitude: 121.9310,
    notes: "Philippines. NE Amihan wind Nov–Apr, shallow reef-protected lagoon.",
    alertCriteria: { preferredDirections: "[30, 45, 60]" },
  },

  // ── Australia ──
  {
    name: "Lancelin",
    latitude: -31.0200,
    longitude: 115.3267,
    notes: "Western Australia. Strong S-SW sea breeze (Fremantle Doctor). Flat water & waves.",
    alertCriteria: { preferredDirections: "[180, 200, 220]", minWindSpeed: 18, maxWindSpeed: 30 },
  },
  {
    name: "Safety Bay",
    latitude: -32.3067,
    longitude: 115.7389,
    notes: "Perth, Western Australia. SW sea breeze, shallow bay. Popular local spot.",
    alertCriteria: { preferredDirections: "[200, 220, 240]" },
  },
  {
    name: "St Kilda Beach",
    latitude: -37.8596,
    longitude: 144.9683,
    notes: "Melbourne, Australia. SW sea breeze, flat water in Port Phillip Bay.",
    alertCriteria: { preferredDirections: "[200, 220, 240]" },
  },
  {
    name: "Noosa – Lake Cootharaba",
    latitude: -26.2821,
    longitude: 152.9726,
    notes: "Queensland, Australia. SE trades, large shallow freshwater lake. Ideal for foiling.",
    alertCriteria: { preferredDirections: "[120, 135, 150]" },
  },

  // ── New Zealand ──
  {
    name: "Takapuna Beach",
    latitude: -36.7853,
    longitude: 174.7733,
    notes: "Auckland, NZ. NE-E sea breeze, sheltered harbor. Good all-round spot.",
    alertCriteria: { preferredDirections: "[45, 60, 75, 90]" },
  },

  // ── Pacific ──
  {
    name: "Le Motu – Moorea",
    latitude: -17.4893,
    longitude: -149.8472,
    notes: "French Polynesia. E trades, turquoise lagoon, flat water. Paradise setting.",
    alertCriteria: { preferredDirections: "[75, 90, 105]" },
  },
];

interface SolarPositionProps {
  currentTime: Date;
  sunrise: Date;
  sunset: Date;
}

export function SolarPosition({
  currentTime,
  sunrise,
  sunset,
}: SolarPositionProps) {
  const totalDaylight = sunset.getTime() - sunrise.getTime();
  const elapsed = currentTime.getTime() - sunrise.getTime();
  const isDaytime = elapsed >= 0 && elapsed <= totalDaylight;
  const progress = isDaytime
    ? Math.max(0, Math.min(1, elapsed / totalDaylight))
    : 0;

  // Quadratic Bezier: P0=(5,20) P1=(40,−8) P2=(75,20)
  // B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
  const t = progress;
  const oneMinusT = 1 - t;
  const sx = oneMinusT * oneMinusT * 5 + 2 * oneMinusT * t * 40 + t * t * 75;
  const sy = oneMinusT * oneMinusT * 20 + 2 * oneMinusT * t * -8 + t * t * 20;

  // Night: park at bottom center
  const dotX = isDaytime ? sx : 40;
  const dotY = isDaytime ? sy : 23;

  return (
    <svg
      viewBox="0 0 80 24"
      className="w-16 h-5 shrink-0"
      aria-hidden="true"
    >
      {/* Horizon line */}
      <line
        x1="5"
        y1="20"
        x2="75"
        y2="20"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="0.8"
      />
      {/* Sky arc */}
      <path
        d="M5,20 Q40,-8 75,20"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="0.8"
        strokeDasharray="2 2"
      />
      {/* Sun dot */}
      {isDaytime ? (
        <>
          <circle cx={dotX} cy={dotY} r="4" fill="#f59e0b" opacity="0.25" />
          <circle cx={dotX} cy={dotY} r="2.5" fill="#f59e0b" />
        </>
      ) : (
        <circle cx={dotX} cy={dotY} r="2.5" fill="#78350f" opacity="0.4" />
      )}
    </svg>
  );
}

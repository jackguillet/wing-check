"use client";

import type { DayEvaluation } from "@/lib/alerts/evaluator";
import {
  addCivilDays,
  formatCivilWeekdayShort,
} from "@/lib/weather/civil-time";
import { useForecastControls } from "@/components/forecast-controls";
import { formatWingSize } from "@/lib/wings";

const goNoGoColors = {
  go: "bg-green-600/10 border-green-600 text-green-700 dark:text-green-400",
  marginal:
    "bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:text-yellow-400",
  "no-go": "bg-red-500/10 border-red-500 text-red-700 dark:text-red-400",
};

function dayLabel(dateStr: string, todayDate: string | null): string {
  if (todayDate && dateStr === todayDate) return "Today";
  return formatCivilWeekdayShort(dateStr);
}

export function SevenDayStrip({
  days,
  todayDate,
}: {
  days: DayEvaluation[];
  todayDate: string | null;
}) {
  const { selectedDate, setSelectedDate } = useForecastControls();
  const display = days.slice(0, 7);

  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
      {display.map((day) => {
        const color = goNoGoColors[day.goNoGo];
        const isToday = todayDate != null && day.date === todayDate;
        const selected = selectedDate === day.date;
        const window = day.bestWindow;
        const lowConfidence =
          todayDate != null && day.date >= addCivilDays(todayDate, 5);
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => setSelectedDate(day.date)}
            aria-pressed={selected}
            className={`rounded-lg border-2 p-2 text-left ${color} ${
              selected || isToday
                ? "ring-2 ring-offset-2 ring-offset-background ring-current"
                : ""
            } ${lowConfidence ? "opacity-60" : ""}`}
          >
            <p className="text-xs font-medium opacity-70">
              {dayLabel(day.date, todayDate)}
            </p>
            <p className="font-bold uppercase text-xs">{day.goNoGo}</p>
            <p className="font-bold text-lg leading-tight">
              {day.score}
              <span className="text-xs font-medium opacity-70">/100</span>
            </p>
            {window ? (
              <p className="text-[10px] opacity-80 mt-1">
                {window.start.slice(11, 16)}–{window.end.slice(11, 16)}
                {window.recommendedWing != null
                  ? ` · ${formatWingSize(window.recommendedWing)}`
                  : ""}
              </p>
            ) : day.suggestedWindow?.recommendedWing != null ? (
              <p className="text-[10px] opacity-80 mt-1">
                Need {formatWingSize(day.suggestedWindow.recommendedWing)}
              </p>
            ) : (
              <p className="text-[10px] opacity-60 mt-1">No window</p>
            )}
            {lowConfidence ? (
              <p className="text-[10px] opacity-70 mt-1">Lower confidence</p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

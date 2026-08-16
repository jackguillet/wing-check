"use client";

import { useState } from "react";
import { updatePreferences } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Preferences } from "@/lib/db/schema";

export function SettingsForm({
  prefs,
  accountEmail,
  emailVerified,
}: {
  prefs: Preferences;
  accountEmail: string;
  emailVerified: boolean;
}) {
  const [windSpeedUnit, setWindSpeedUnit] = useState(prefs.windSpeedUnit);
  const [temperatureUnit, setTemperatureUnit] = useState(
    prefs.temperatureUnit,
  );
  const [alertsEnabled, setAlertsEnabled] = useState(
    prefs.alertsEnabled && emailVerified,
  );

  return (
    <form action={updatePreferences} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Account email</Label>
            <p className="text-sm">{accountEmail}</p>
            <p className="text-xs text-muted-foreground">
              {emailVerified
                ? "Verified. GO emails are sent only to this address."
                : "Check your inbox and verify this address before alerts can be turned on."}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="alertsEnabled"
              checked={alertsEnabled}
              disabled={!emailVerified}
              onChange={(e) => setAlertsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="alertsEnabled">Enable email alerts</Label>
          </div>
          <input
            type="hidden"
            name="alertsEnabled"
            value={alertsEnabled ? "on" : "off"}
          />
          <p className="text-xs text-muted-foreground">
            Conditions are checked once a day at 14:00 UTC (6am Pacific in
            winter, 7am in summer). You get one email per upcoming GO window
            in the next 48 hours — not a leftover morning that already ended.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Units</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="windSpeedUnit">Wind Speed Unit</Label>
            <input type="hidden" name="windSpeedUnit" value={windSpeedUnit} />
            <Select value={windSpeedUnit} onValueChange={setWindSpeedUnit}>
              <SelectTrigger id="windSpeedUnit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="knots">Knots</SelectItem>
                <SelectItem value="kmh">km/h</SelectItem>
                <SelectItem value="mph">mph</SelectItem>
                <SelectItem value="ms">m/s</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="temperatureUnit">Temperature Unit</Label>
            <input
              type="hidden"
              name="temperatureUnit"
              value={temperatureUnit}
            />
            <Select
              value={temperatureUnit}
              onValueChange={setTemperatureUnit}
            >
              <SelectTrigger id="temperatureUnit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="celsius">Celsius</SelectItem>
                <SelectItem value="fahrenheit">Fahrenheit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full">
        Save Settings
      </Button>
    </form>
  );
}

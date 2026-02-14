import { getPreferences, updatePreferences } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prefs = await getPreferences();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <form action={updatePreferences} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@email.com"
                defaultValue={prefs.email ?? ""}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="alertsEnabled"
                name="alertsEnabled"
                defaultChecked={prefs.alertsEnabled}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="alertsEnabled">Enable email alerts</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkIntervalHours">
                Check Interval (hours)
              </Label>
              <Input
                id="checkIntervalHours"
                name="checkIntervalHours"
                type="number"
                min="1"
                max="24"
                defaultValue={prefs.checkIntervalHours}
              />
              <p className="text-xs text-muted-foreground">
                Minimum hours between alert emails for the same spot
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Units</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="windSpeedUnit">Wind Speed Unit</Label>
              <Select name="windSpeedUnit" defaultValue={prefs.windSpeedUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="knots">Knots</SelectItem>
                  <SelectItem value="kmh">km/h</SelectItem>
                  <SelectItem value="mph">mph</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperatureUnit">Temperature Unit</Label>
              <Select
                name="temperatureUnit"
                defaultValue={prefs.temperatureUnit}
              >
                <SelectTrigger>
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
    </div>
  );
}

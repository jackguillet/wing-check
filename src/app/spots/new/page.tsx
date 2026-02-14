import { createSpot } from "@/lib/actions/spots";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export default function NewSpotPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Add New Spot</h1>
      <form action={createSpot} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Spot Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Crissy Field"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="any"
                  placeholder="37.8045"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="any"
                  placeholder="-122.4654"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="noaaStationId">NOAA Station ID (optional)</Label>
              <Input
                id="noaaStationId"
                name="noaaStationId"
                placeholder="e.g. 9414290"
              />
              <p className="text-xs text-muted-foreground">
                For US coastal spots — provides tide data
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Best at mid-tide, watch for kiteboarders..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wind Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minWindSpeed">Min Wind Speed (kt)</Label>
                <Input
                  id="minWindSpeed"
                  name="minWindSpeed"
                  type="number"
                  step="0.5"
                  defaultValue="15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxWindSpeed">Max Wind Speed (kt)</Label>
                <Input
                  id="maxWindSpeed"
                  name="maxWindSpeed"
                  type="number"
                  step="0.5"
                  defaultValue="25"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxGustFactor">Max Gust Factor</Label>
                <Input
                  id="maxGustFactor"
                  name="maxGustFactor"
                  type="number"
                  step="0.1"
                  defaultValue="1.5"
                />
                <p className="text-xs text-muted-foreground">
                  Gusts must be below wind speed x this factor
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minConsecutiveHours">Min Session Hours</Label>
                <Input
                  id="minConsecutiveHours"
                  name="minConsecutiveHours"
                  type="number"
                  defaultValue="2"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="preferredDirections">
                Preferred Wind Directions (degrees, comma-separated)
              </Label>
              <Input
                id="preferredDirections"
                name="preferredDirections"
                placeholder="e.g. 270,290 for W to WNW"
                defaultValue="[]"
              />
              <p className="text-xs text-muted-foreground">
                Enter as JSON array like [270, 290] or leave as [] for any
                direction
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="directionTolerance">
                Direction Tolerance (degrees)
              </Label>
              <Input
                id="directionTolerance"
                name="directionTolerance"
                type="number"
                defaultValue="45"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxWaveHeight">
                Max Wave Height (m, optional)
              </Label>
              <Input
                id="maxWaveHeight"
                name="maxWaveHeight"
                type="number"
                step="0.1"
                placeholder="Leave empty for no limit"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full">
          Add Spot
        </Button>
      </form>
    </div>
  );
}

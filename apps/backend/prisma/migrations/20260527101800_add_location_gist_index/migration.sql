-- Add GIST spatial index on Location.geom for fast "within X km" queries.
-- Prisma doesn't auto-generate spatial indexes for Unsupported types, so we
-- add it manually here. The migration also adds a trigger to keep `geom` in
-- sync with the latitude/longitude columns automatically.

CREATE INDEX "locations_geom_gist_idx" ON "locations" USING GIST ("geom");

-- Keep geom in sync with lat/lng without requiring application code to set it
-- on every write. A simple before-insert/update trigger does the job.
CREATE OR REPLACE FUNCTION tahawash_sync_location_geom()
RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    NEW.geom := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tahawash_locations_geom_sync ON "locations";
CREATE TRIGGER tahawash_locations_geom_sync
  BEFORE INSERT OR UPDATE OF latitude, longitude ON "locations"
  FOR EACH ROW
  EXECUTE FUNCTION tahawash_sync_location_geom();

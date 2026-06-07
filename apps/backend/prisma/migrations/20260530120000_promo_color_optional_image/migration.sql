-- Promo banners: the image becomes optional and a color theme is added, so a
-- super-admin can publish a colored gradient banner with no photo.
ALTER TABLE "promos" ALTER COLUMN "imageUrl" DROP NOT NULL;
ALTER TABLE "promos" ADD COLUMN "theme" TEXT;

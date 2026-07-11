-- Patch: restrict organization-logos storage bucket to JPEG, PNG, WebP only.
-- Removes image/gif and image/svg+xml added in 20260723 (SVG can embed <script> tags).

UPDATE storage.buckets
SET    allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp']
WHERE  id = 'organization-logos';

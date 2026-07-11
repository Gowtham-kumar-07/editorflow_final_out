-- Sprint 14A Security Hardening
-- Tighten storage bucket MIME allowlist to match app-layer validation.
-- SVG allows arbitrary JavaScript execution when served outside <img> tags;
-- removing it at the bucket level prevents direct-Storage-API bypass.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'organization-logos';

-- Sprint 8A: Add project files URL (provider-neutral external link)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_files_url text NULL;

COMMENT ON COLUMN public.projects.project_files_url
  IS 'Optional external project file/folder link (e.g. Google Drive, Dropbox). Must be a valid HTTPS URL.';

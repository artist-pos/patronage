alter table project_updates
  add column if not exists image_width integer,
  add column if not exists image_height integer;

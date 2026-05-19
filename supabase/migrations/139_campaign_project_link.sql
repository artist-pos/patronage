alter table campaigns add column if not exists project_id uuid references projects(id) on delete set null;
create index if not exists campaigns_project_id_idx on campaigns(project_id);

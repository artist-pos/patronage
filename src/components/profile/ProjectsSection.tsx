import Link from "next/link";
import Image from "next/image";
import type { Project, ProjectUpdateWithArtist } from "@/types/database";

interface Props {
  projects: Project[];
  updates: ProjectUpdateWithArtist[];
  isOwner: boolean;
}

export function ProjectsSection({ projects, updates, isOwner }: Props) {
  if (projects.length === 0) {
    if (isOwner) {
      return (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Projects
          </h2>
          <p className="text-sm text-muted-foreground">
            No projects yet.{" "}
            <Link
              href="/profile/edit"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Create your first project →
            </Link>
          </p>
        </section>
      );
    }
    return null;
  }

  // Group updates by project_id for thumbnail previews
  const updatesByProject = updates.reduce<Record<string, ProjectUpdateWithArtist[]>>((acc, u) => {
    if (!u.project_id) return acc;
    if (!acc[u.project_id]) acc[u.project_id] = [];
    acc[u.project_id].push(u);
    return acc;
  }, {});

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Projects
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
        {projects.map((project) => {
          const projectUpdates = updatesByProject[project.id] ?? [];
          const thumbs = projectUpdates.slice(0, 3);
          const updateCount = projectUpdates.length;

          return (
            <Link
              key={project.id}
              href={`/threads/${project.id}`}
              className="flex-none w-56 border border-border hover:border-foreground transition-colors group"
            >
              {/* Thumbnail strip */}
              <div className="flex h-32 overflow-hidden bg-muted">
                {thumbs.length > 0 ? (
                  thumbs.map((u) => (
                    <div
                      key={u.id}
                      className="flex-1 relative overflow-hidden"
                      style={{ minWidth: 0 }}
                    >
                      {u.image_url ? (
                        <Image
                          src={u.image_url}
                          alt={u.caption ?? "Project update"}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[9px] uppercase text-muted-foreground">{u.content_type}</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">No updates</span>
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="p-3 space-y-0.5">
                <p className="text-sm font-semibold line-clamp-1 group-hover:underline underline-offset-2">
                  {project.title}
                </p>
                {project.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {project.description}
                  </p>
                )}
                {updateCount > 0 && (
                  <p className="text-[10px] font-mono text-muted-foreground pt-0.5">
                    {updateCount} update{updateCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

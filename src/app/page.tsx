import Link from "next/link";
import { Board } from "@/components/board/Board";
import { IssueDrawer } from "@/components/board/IssueDrawer";
import { UserSwitcher } from "@/components/board/UserSwitcher";
import { listUsers } from "@/lib/domain/currentUser";
import { getIssueDetail, listIssues, listProjects } from "@/lib/domain/issues";
import { getActiveSprint, getSprintSummary } from "@/lib/domain/sprint";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function Home({ searchParams }: { searchParams: Promise<{ project?: string; issue?: string }> }) {
  const { project: projectParam, issue: issueParam } = await searchParams;
  const now = new Date();
  const user = await getCurrentUser();
  const users = listUsers();
  const projects = listProjects();
  const project = projects.find((p) => p.key === projectParam?.toUpperCase()) ?? projects[0];
  const sprint = project ? getActiveSprint(project.id) : undefined;
  const issues = sprint ? listIssues({ sprintIds: [sprint.id] }) : [];
  const detail = issueParam ? getIssueDetail(issueParam, 10) : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-6 border-b px-4">
        <span className="font-semibold">PromptPM</span>
        <nav className="flex gap-1 text-sm">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/?project=${p.key}`}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                p.id === project?.id ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.name}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <UserSwitcher users={users.map(({ id, name, role }) => ({ id, name, role }))} currentId={user.id} />
          <Link href="/log" className="text-muted-foreground hover:text-foreground">
            Log
          </Link>
        </div>
      </header>
      <main className="flex min-h-0 flex-1">
        <section className="min-w-0 flex-1 overflow-auto p-4">
          <Board summary={sprint ? getSprintSummary(sprint, now) : null} issues={issues} projectKey={project?.key ?? ""} />
        </section>
        <aside className="flex w-[420px] shrink-0 flex-col border-l">
          <p className="p-4 text-sm text-muted-foreground">Chat goes here.</p>
        </aside>
      </main>
      <IssueDrawer issue={detail} users={users.map(({ id, name }) => ({ id, name }))} />
    </div>
  );
}

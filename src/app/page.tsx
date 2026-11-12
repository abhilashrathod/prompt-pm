import Link from "next/link";

export default function Home() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-6 border-b px-4">
        <span className="font-semibold">PromptPM</span>
        <nav className="flex gap-1 text-sm text-muted-foreground">{/* project tabs (step 5) */}</nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {/* user switcher (step 5) */}
          <Link href="/log" className="text-muted-foreground hover:text-foreground">
            Log
          </Link>
        </div>
      </header>
      <main className="flex min-h-0 flex-1">
        <section className="min-w-0 flex-1 overflow-auto p-4">
          <p className="text-sm text-muted-foreground">Board goes here.</p>
        </section>
        <aside className="flex w-[420px] shrink-0 flex-col border-l">
          <p className="p-4 text-sm text-muted-foreground">Chat goes here.</p>
        </aside>
      </main>
    </div>
  );
}

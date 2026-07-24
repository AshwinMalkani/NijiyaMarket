import { useRouter } from "../lib/router";

function FeedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5.5h16M4 12h16M4 18.5h9"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RankingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5.5 19.5V10M12 19.5V4.5M18.5 19.5v-7"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function YouIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="2.1" />
      <path
        d="M4.5 19.5c1.4-3.4 4.6-4.5 7.5-4.5s6.1 1.1 7.5 4.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TabBar() {
  const { path, navigate } = useRouter();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-line)] bg-[var(--color-paper)]/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[520px] items-center justify-around px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <TabButton
          label="Feed"
          icon={<FeedIcon />}
          active={path === "/"}
          onClick={() => navigate("/")}
        />
        <TabButton
          label="Rankings"
          icon={<RankingsIcon />}
          active={path.startsWith("/rankings")}
          onClick={() => navigate("/rankings")}
        />

        <button
          onClick={() => navigate("/add")}
          aria-label="Add an item"
          className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand)] text-white shadow-[0_4px_14px_rgba(192,57,43,0.4)] ring-4 ring-[var(--color-paper)] active:bg-[var(--color-brand-dark)]"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <TabButton
          label="You"
          icon={<YouIcon />}
          active={path.startsWith("/profile")}
          onClick={() => navigate("/profile")}
        />
        <div className="w-16" aria-hidden />
      </div>
    </nav>
  );
}

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[48px] w-16 flex-col items-center justify-center gap-0.5 rounded-lg text-[10.5px] font-semibold ${
        active ? "text-[var(--color-brand)]" : "text-[var(--color-muted)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

import { useRouter } from "../lib/router";

const tabs = [
  { path: "/", label: "Feed", icon: "🍥" },
  { path: "/rankings", label: "Rankings", icon: "🏅" },
  { path: "/profile", label: "You", icon: "🙂" },
];

export function TabBar() {
  const { path, navigate } = useRouter();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[520px] items-center justify-around px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <TabButton {...tabs[0]} active={path === "/"} onClick={() => navigate("/")} />
        <TabButton
          {...tabs[1]}
          active={path.startsWith("/rankings")}
          onClick={() => navigate("/rankings")}
        />

        <button
          onClick={() => navigate("/add")}
          aria-label="Add an item"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand)] text-3xl leading-none text-white shadow-lg shadow-black/15 active:bg-[var(--color-brand-dark)]"
        >
          <span className="-mt-0.5">+</span>
        </button>

        <TabButton
          {...tabs[2]}
          active={path.startsWith("/profile")}
          onClick={() => navigate("/profile")}
        />
        <div className="w-14" aria-hidden />
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
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[48px] w-16 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium ${
        active ? "text-[var(--color-brand)]" : "text-[var(--color-muted)]"
      }`}
    >
      <span className={`text-xl ${active ? "" : "opacity-60 grayscale"}`}>{icon}</span>
      {label}
    </button>
  );
}

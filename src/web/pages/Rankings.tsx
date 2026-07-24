import { useEffect, useMemo, useState } from "react";
import { api, type ItemSummary, type Section } from "../lib/api";
import { useRouter } from "../lib/router";
import { Chip, Empty, RowSkeleton, ScoreBadge, Screen, Thumb, inputClass } from "../components/ui";

/** Top three ranked spots get medal colors; everything else is a plain number. */
export function RankNumber({ rank, ranked = true }: { rank: number; ranked?: boolean }) {
  const medal =
    ranked && rank <= 3
      ? ["bg-[#d4a017] text-white", "bg-[#9aa0a6] text-white", "bg-[#ad6f3b] text-white"][rank - 1]
      : "text-[var(--color-muted)]";
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${medal}`}
    >
      {rank}
    </span>
  );
}

export function Rankings() {
  const { navigate } = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<ItemSummary[] | null>(null);
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.sections().then((r) => setSections(r.sections)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    api
      .items({ section: active })
      .then((r) => !cancelled && setItems(r.items))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [active]);

  const visible = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const tabs = [{ slug: "all", name: "All", emoji: "🗂" }, ...sections];

  return (
    <Screen title="Rankings" subtitle="Best of Nijiya, by our average score">
      <div className="px-4 pt-4">
        <input
          className={inputClass}
          type="search"
          placeholder="Search items…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-3">
        {tabs.map((tab) => (
          <Chip key={tab.slug} selected={active === tab.slug} onClick={() => setActive(tab.slug)}>
            {tab.emoji} {tab.name}
          </Chip>
        ))}
      </div>

      {visible === null ? (
        <RowSkeleton />
      ) : visible.length === 0 ? (
        <Empty
          emoji="🔍"
          title={query ? "Nothing matches that" : "No items here yet"}
          body={query ? undefined : "Tap + to add one."}
        />
      ) : (
        <ol className="space-y-2 px-4">
          {visible.map((item, index) => (
            <li key={item.id}>
              <button
                onClick={() => navigate(`/item/${item.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-3 text-left shadow-[0_1px_2px_rgba(33,28,23,0.04)] active:bg-[var(--color-line)]/30"
              >
                <RankNumber rank={index + 1} ranked={item.avg_score !== null} />
                <Thumb photoKey={item.photo_key} alt={item.name} emoji={item.section_emoji} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{item.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                    {item.section_emoji} {item.section_name} ·{" "}
                    {item.rating_count === 0
                      ? "no ratings yet"
                      : `${item.rating_count} rating${item.rating_count === 1 ? "" : "s"}`}
                    {item.my_score !== null && ` · you: ${item.my_score.toFixed(1)}`}
                  </p>
                </div>
                <ScoreBadge score={item.avg_score} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </Screen>
  );
}

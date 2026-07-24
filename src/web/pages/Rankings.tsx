import { useEffect, useMemo, useState } from "react";
import { api, type ItemSummary, type Section } from "../lib/api";
import { useRouter } from "../lib/router";
import { Empty, RowSkeleton, ScoreBadge, Screen, Thumb, inputClass } from "../components/ui";

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
          <button
            key={tab.slug}
            onClick={() => setActive(tab.slug)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium ${
              active === tab.slug
                ? "bg-[var(--color-brand)] text-white"
                : "border border-[var(--color-line)] bg-white text-[var(--color-muted)]"
            }`}
          >
            {tab.emoji} {tab.name}
          </button>
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
        <ol className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)] bg-white">
          {visible.map((item, index) => (
            <li key={item.id}>
              <button
                onClick={() => navigate(`/item/${item.id}`)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50"
              >
                <span className="w-5 shrink-0 text-center text-sm font-semibold text-[var(--color-muted)] tabular-nums">
                  {index + 1}
                </span>
                <Thumb photoKey={item.photo_key} alt={item.name} emoji={item.section_emoji} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">
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

import { useState, useEffect, useRef } from "react";
import { Search, X, Clock, TrendingUp, ArrowUpRight, Hash } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { allEvents, categoryMeta } from "../../data/mockData";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const RECENT_SEARCHES = ["Hackathon", "Career Fair", "IEEE", "Machine Learning"];

const QUICK_CATEGORIES = ["technology", "career", "competition", "cultural", "sports"];

export default function SearchModal() {
  const { searchOpen, closeSearch } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") closeSearch();
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchOpen ? closeSearch() : null;
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [searchOpen, closeSearch]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const q = query.toLowerCase();
    const found = allEvents.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        e.organizer.toLowerCase().includes(q)
    );
    setResults(found.slice(0, 6));
  }, [query]);

  return (
    <Dialog open={searchOpen} onOpenChange={(open) => { if (!open) closeSearch(); }}>
      <DialogContent
        showCloseButton={false}
        className="top-16 translate-y-0 sm:max-w-xl p-0 gap-0 overflow-hidden shadow-2xl shadow-black/60 ring-primary/10"
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
          <Search size={18} className="text-primary shrink-0" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search events, categories, channels..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 h-auto py-0 px-0"
          />
          <Button variant="ghost" size="icon-sm" onClick={closeSearch} aria-label="Close search">
            <X size={15} />
          </Button>
        </div>

        <ScrollArea className="max-h-96">
          <div className="p-3">
            {query.trim() === "" ? (
              <>
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-2 mb-2">
                    <Clock size={13} className="text-muted-foreground/60" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Recent
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {RECENT_SEARCHES.map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="cursor-pointer font-medium hover:bg-primary/15 hover:text-primary hover:border-primary/30"
                        onClick={() => setQuery(s)}
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 px-2 mb-2">
                    <Hash size={13} className="text-muted-foreground/60" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Browse by Category
                    </span>
                  </div>
                  <div className="space-y-1">
                    {QUICK_CATEGORIES.map((cat) => {
                      const meta = categoryMeta[cat];
                      return (
                        <Button
                          key={cat}
                          variant="ghost"
                          onClick={() => setQuery(cat)}
                          className="w-full justify-start gap-3 px-3 py-2.5 h-auto text-muted-foreground hover:text-foreground"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: meta.color }}
                          />
                          <span className="text-sm font-medium">{meta.label} Events</span>
                          <ArrowUpRight size={13} className="ml-auto opacity-40" />
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : results.length === 0 ? (
              <div className="py-10 text-center">
                <TrendingUp className="mx-auto mb-2 opacity-20 size-7 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No events found for &quot;{query}&quot;
                </p>
                <p className="text-xs mt-1 text-muted-foreground/70">
                  Try a different keyword or category
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((event) => {
                  const cat = categoryMeta[event.category];
                  return (
                    <a
                      key={event._id}
                      href="#"
                      onClick={closeSearch}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors group hover:bg-accent/50"
                    >
                      <img
                        src={event.coverImage.url}
                        alt={event.title}
                        className="w-10 h-10 rounded-xl object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate text-foreground">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-medium" style={{ color: cat.color }}>
                            {cat.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {event.organizer}
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight
                        size={15}
                        className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground"
                      />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />
        <div className="px-4 py-2.5 flex items-center gap-4">
          <span className="text-xs text-muted-foreground/70">
            <kbd className="px-1 py-0.5 rounded text-xs font-mono mr-1 bg-muted text-muted-foreground border border-border">
              ↵
            </kbd>
            to select
          </span>
          <span className="text-xs text-muted-foreground/70">
            <kbd className="px-1 py-0.5 rounded text-xs font-mono mr-1 bg-muted text-muted-foreground border border-border">
              Esc
            </kbd>
            to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

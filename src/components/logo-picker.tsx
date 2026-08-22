"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOGOS, LOGO_SETS, logoPath, type LogoId } from "@/lib/logos";
import type { ActionResult } from "@/server/actions";

/**
 * Choosing the app's mark.
 *
 * The selection is optimistic — the tile highlights the moment it is tapped —
 * because the round trip re-renders the sidebar and the tab icon, and waiting
 * for all that before acknowledging the tap feels broken.
 */
export function LogoPicker({
  current,
  save,
}: {
  current: LogoId;
  save: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<LogoId>(current);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (id: LogoId) => {
    if (id === chosen) return;
    const previous = chosen;
    setChosen(id);
    setMessage(null);
    startTransition(async () => {
      const result = await save(id);
      setMessage(result.message);
      if (!result.ok) setChosen(previous);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {/* Grouped by finish: twelve tiles in one grid is a wall of near
          identical squares, and the choice is really colour within a finish. */}
      {LOGO_SETS.map((set) => (
        <div key={set.id} className="space-y-2">
          <p className="text-xs font-medium text-[var(--ink)]">
            {set.label}{" "}
            <span className="font-normal text-[var(--ink-muted)]">
              · {set.note}
            </span>
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {LOGOS.filter((logo) => logo.set === set.id).map((logo) => {
              const selected = logo.id === chosen;
              return (
                <button
                  key={logo.id}
                  type="button"
                  onClick={() => pick(logo.id)}
                  disabled={pending}
                  aria-pressed={selected}
                  title={logo.label}
                  className="group flex flex-col items-center gap-1.5 disabled:opacity-60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- static
                  square art; the optimiser adds a round trip for no gain. */}
                  <img
                    src={logoPath(logo.id, "icon-192")}
                    alt={logo.label}
                    width={72}
                    height={72}
                    className="w-full rounded-xl transition-transform group-hover:scale-[1.03]"
                    style={{
                      outline: selected
                        ? `2px solid ${logo.accent}`
                        : "2px solid transparent",
                      outlineOffset: "2px",
                    }}
                  />
                  <span
                    className="text-[0.6875rem]"
                    style={{
                      color: selected ? logo.accent : "var(--ink-muted)",
                    }}
                  >
                    {logo.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
        {message ??
          "Changes the sidebar and browser tab straight away. The icon already on your home screen keeps the old art until you delete it and add it again — iOS copies the icon at install time."}
      </p>
    </div>
  );
}

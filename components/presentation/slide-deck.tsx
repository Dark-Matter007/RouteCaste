"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Printer } from "lucide-react"
import { slides } from "./slides"

export function SlideDeck() {
  const [index, setIndex] = useState(0)
  const total = slides.length

  const go = useCallback(
    (dir: number) => {
      setIndex((i) => Math.max(0, Math.min(total - 1, i + dir)))
    },
    [total],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault()
        go(1)
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault()
        go(-1)
      } else if (e.key === "Home") {
        setIndex(0)
      } else if (e.key === "End") {
        setIndex(total - 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, total])

  const slide = slides[index]

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border px-6 py-3 print:hidden">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            RouteCast · Capstone Deck
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Printer className="h-3.5 w-3.5" />
            PDF
          </button>
        </div>
      </header>

      {/* Slide area (screen) */}
      <section className="relative flex flex-1 items-center overflow-hidden px-8 py-10 md:px-20 print:hidden">
        <div className="mx-auto w-full max-w-5xl">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-primary">{slide.kicker}</p>
          <h1 className="mb-8 text-balance text-4xl font-semibold tracking-tight md:text-5xl">{slide.title}</h1>
          <div>{slide.body}</div>
        </div>

        {/* Nav arrows */}
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Previous slide"
          className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => go(1)}
          disabled={index === total - 1}
          aria-label="Next slide"
          className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </section>

      {/* Progress dots */}
      <footer className="flex items-center justify-center gap-1.5 border-t border-border py-3 print:hidden">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground"
            }`}
          />
        ))}
      </footer>

      {/* Print view: every slide stacked, one per page */}
      <div className="hidden print:block">
        {slides.map((s) => (
          <section key={s.id} className="flex min-h-screen flex-col justify-center break-after-page px-16 py-12">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-primary">{s.kicker}</p>
            <h1 className="mb-8 text-4xl font-semibold tracking-tight">{s.title}</h1>
            <div>{s.body}</div>
          </section>
        ))}
      </div>
    </main>
  )
}

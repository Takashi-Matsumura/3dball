"use client";

import { useI18n, Locale } from "@/lib/i18n";
import { HELP_CONTENTS } from "@/lib/guide-content";
import Link from "next/link";
import NfcWriter from "./NfcWriter";
import {
  IconGamepad,
  IconListOrdered,
  IconRepeat,
  IconGitBranch,
  IconKeyboard,
  IconCard,
  IconCode,
  IconBall,
  IconArrowLeft,
  IconSparkles,
  IconTarget,
  IconLightbulb,
} from "@/app/components/icons";

// ── Data ──

type LevelItem = {
  icon: (p: { className?: string }) => React.ReactElement;
  accent: string;
  ring: string;
  glow: string;
  badge: string;
  key: string;
  contentKey: string;
};

const LEVEL_ITEMS: LevelItem[] = [
  {
    icon: IconGamepad,
    accent: "text-emerald-600",
    ring: "from-emerald-400/30 to-emerald-500/10",
    glow: "shadow-emerald-200/50",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    key: "welcomePlayground",
    contentKey: "playground",
  },
  {
    icon: IconListOrdered,
    accent: "text-sky-600",
    ring: "from-sky-400/30 to-sky-500/10",
    glow: "shadow-sky-200/50",
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    key: "welcomeLv1Desc",
    contentKey: "lv1",
  },
  {
    icon: IconRepeat,
    accent: "text-amber-600",
    ring: "from-amber-400/30 to-amber-500/10",
    glow: "shadow-amber-200/50",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    key: "welcomeLv2Desc",
    contentKey: "lv2",
  },
  {
    icon: IconGitBranch,
    accent: "text-violet-600",
    ring: "from-violet-400/30 to-violet-500/10",
    glow: "shadow-violet-200/50",
    badge: "bg-violet-50 text-violet-700 ring-violet-200",
    key: "welcomeLv3Desc",
    contentKey: "lv3",
  },
];

const CONTROL_ITEMS: { icon: (p: { className?: string }) => React.ReactElement; accent: string; bg: string; key: string }[] = [
  { icon: IconKeyboard, accent: "text-slate-700", bg: "bg-slate-100", key: "welcomeControlKeys" },
  { icon: IconCard,     accent: "text-sky-700",   bg: "bg-sky-100",   key: "welcomeControlCards" },
  { icon: IconCode,     accent: "text-emerald-700", bg: "bg-emerald-100", key: "welcomeControlProg" },
];

const SHORTCUT_KEYS = [
  "shortcutArrows",
  "shortcutSpace",
  "shortcutP",
  "shortcutD",
  "shortcutF",
  "shortcutI",
  "shortcutEsc",
] as const;

// ── Page ──

export default function HelpPage() {
  const { locale, setLocale, td } = useI18n();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-slate-50 text-slate-800">
      {/* Decorative background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[620px] -z-0">
        <div className="absolute left-1/2 top-[-180px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-sky-200/60 via-violet-200/40 to-emerald-200/40 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/70 backdrop-blur-lg border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2 text-slate-500 hover:text-slate-900 transition text-sm">
            <IconArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>{td("backToApp")}</span>
          </Link>
          <div className="flex gap-1">
            {(["ja", "en", "es"] as Locale[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLocale(lang)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  locale === lang
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white/60 text-slate-600 hover:bg-white"
                }`}
              >
                {{ ja: "日本語", en: "English", es: "Español" }[lang]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-5 pb-24 pt-12 space-y-20">
        {/* Hero */}
        <section className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200 backdrop-blur mb-6">
            <IconSparkles className="w-3.5 h-3.5 text-amber-500" />
            3D Ball · STEAM Learning
          </div>
          <div className="relative mx-auto mb-6 w-20 h-20">
            <div aria-hidden className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 blur-xl opacity-40" />
            <div className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-lg shadow-violet-500/30">
              <IconBall className="w-11 h-11" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent">
            {td("welcomeTitle")}
          </h1>
          <p className="mt-5 mx-auto max-w-xl text-base sm:text-lg leading-relaxed whitespace-pre-line text-slate-600">
            {td("welcomeIntro")}
          </p>
        </section>

        {/* Courses */}
        <section>
          <SectionHeader label={td("welcomeLevels")} kicker="Courses" />
          <div className="grid gap-4 sm:grid-cols-2">
            {LEVEL_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.contentKey}
                  href={`#${item.contentKey}`}
                  className={`group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${item.glow}`}
                >
                  <div aria-hidden className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${item.ring} blur-2xl opacity-70 transition group-hover:opacity-100`} />
                  <div className={`relative flex-shrink-0 rounded-xl p-2.5 ring-1 ${item.badge}`}>
                    <Icon className={`w-5 h-5 ${item.accent}`} />
                  </div>
                  <div className="relative flex-1">
                    <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${item.accent}`}>
                      {idx === 0 ? "Free" : `Level ${idx}`}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{td(item.key)}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* Controls */}
        <section>
          <SectionHeader label={td("welcomeControls")} kicker="Controls" />
          <div className="grid gap-3 sm:grid-cols-3">
            {CONTROL_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className={`flex-shrink-0 rounded-lg p-2 ${item.bg}`}>
                    <Icon className={`w-5 h-5 ${item.accent}`} />
                  </div>
                  <span className="text-sm text-slate-700 leading-relaxed">{td(item.key)}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Level Guides */}
        {LEVEL_ITEMS.map((item, idx) => {
          const content = HELP_CONTENTS[item.contentKey];
          if (!content) return null;
          const Icon = item.icon;
          return (
            <section key={item.contentKey} id={item.contentKey} className="scroll-mt-20">
              <div className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm`}>
                <div aria-hidden className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${item.ring} opacity-100`} />
                <div aria-hidden className={`absolute -right-24 -top-24 h-60 w-60 rounded-full bg-gradient-to-br ${item.ring} blur-3xl`} />

                <div className="relative p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`rounded-xl p-2.5 ring-1 ${item.badge}`}>
                      <Icon className={`w-5 h-5 ${item.accent}`} />
                    </div>
                    <div>
                      <div className={`text-[11px] font-bold uppercase tracking-wider ${item.accent}`}>
                        {idx === 0 ? "Free Play" : `Level ${idx}`}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                        {td(content.titleKey)}
                      </h2>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
                    {/* Mission + Concept (left column) */}
                    <div className="space-y-5">
                      <div>
                        <SubLabel icon={<IconTarget className="w-3.5 h-3.5" />} color="text-sky-600">
                          {td("helpMission")}
                        </SubLabel>
                        <p className="mt-2 text-sm text-slate-700 leading-relaxed">{td(content.objectiveKey)}</p>
                      </div>

                      <div>
                        <SubLabel icon={<IconLightbulb className="w-3.5 h-3.5" />} color="text-emerald-600">
                          {td("helpConcept")}
                        </SubLabel>
                        <div className="mt-2 rounded-xl bg-emerald-50/70 ring-1 ring-emerald-100 px-4 py-3">
                          <p className="text-sm text-emerald-900/80 leading-relaxed">
                            {td(content.conceptKey)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Steps (right column) */}
                    <div>
                      <SubLabel icon={<IconListOrdered className="w-3.5 h-3.5" />} color="text-slate-500">
                        {td("helpSteps")}
                      </SubLabel>
                      <ol className="mt-2 space-y-2">
                        {content.steps.map((step, i) => (
                          <li
                            key={i}
                            className="flex gap-3 rounded-lg bg-slate-50/70 px-3 py-2.5 text-sm text-slate-700 leading-relaxed"
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full bg-white ring-1 ${item.badge} ${item.accent} font-bold flex items-center justify-center text-[11px]`}>
                              {i + 1}
                            </span>
                            <span>{td(step.textKey)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {/* Shortcuts */}
        <section>
          <SectionHeader label={td("helpShortcuts")} kicker="Shortcuts" />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {SHORTCUT_KEYS.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                >
                  {td(k)}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* NFC */}
        <section>
          <SectionHeader label={td("nfcCardSetup")} kicker="NFC Cards" />
          <NfcWriter />
        </section>
      </main>
    </div>
  );
}

function SectionHeader({ label, kicker }: { label: string; kicker: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-3">
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{label}</h2>
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{kicker}</span>
    </div>
  );
}

function SubLabel({ icon, color, children }: { icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${color}`}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

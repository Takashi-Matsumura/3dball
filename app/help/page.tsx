"use client";

import { useI18n, Locale } from "@/lib/i18n";
import { HELP_CONTENTS } from "@/lib/guide-content";
import Link from "next/link";
import NfcWriter from "./NfcWriter";

// ── SVG Icons ──

function IconGamepad({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 12h4M8 10v4" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <circle cx="18" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function IconListOrdered({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M3 14h2l-2 2h2" />
    </svg>
  );
}

function IconRepeat({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconGitBranch({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function IconKeyboard({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h0M10 8h0M14 8h0M18 8h0M8 12h0M12 12h0M16 12h0M8 16h8" />
    </svg>
  );
}

function IconCard({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 15h0M2 9.5h20" />
    </svg>
  );
}

function IconCode({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconBall({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10" />
      <path d="M12 2a15 15 0 0 0-4 10 15 15 0 0 0 4 10" />
      <path d="M2 12h20" />
    </svg>
  );
}

function IconArrowLeft({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// ── Data ──

const LEVEL_ITEMS: { icon: (p: { className?: string }) => React.ReactElement; color: string; bgColor: string; key: string; contentKey: string }[] = [
  { icon: IconGamepad, color: "text-green-600", bgColor: "bg-green-50 border-green-200", key: "welcomePlayground", contentKey: "playground" },
  { icon: IconListOrdered, color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", key: "welcomeLv1Desc", contentKey: "lv1" },
  { icon: IconRepeat, color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200", key: "welcomeLv2Desc", contentKey: "lv2" },
  { icon: IconGitBranch, color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200", key: "welcomeLv3Desc", contentKey: "lv3" },
];

const CONTROL_ITEMS: { icon: (p: { className?: string }) => React.ReactElement; color: string; key: string }[] = [
  { icon: IconKeyboard, color: "text-gray-600", key: "welcomeControlKeys" },
  { icon: IconCard, color: "text-blue-600", key: "welcomeControlCards" },
  { icon: IconCode, color: "text-green-600", key: "welcomeControlProg" },
];

const SHORTCUT_KEYS = [
  "shortcutArrows",
  "shortcutSpace",
  "shortcutP",
  "shortcutD",
  "shortcutF",
  "shortcutI",
  "shortcutLang",
] as const;

// ── Page ──

export default function HelpPage() {
  const { locale, setLocale, td } = useI18n();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition text-sm">
            <IconArrowLeft className="w-4 h-4" />
            <span>{td("backToApp")}</span>
          </Link>
          <div className="flex gap-1">
            {(["ja", "en", "es"] as Locale[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLocale(lang)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  locale === lang
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {{ ja: "日本語", en: "English", es: "Español" }[lang]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-3">
          <div className="flex justify-center text-blue-500">
            <IconBall className="w-14 h-14" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {td("welcomeTitle")}
          </h1>
          <p className="text-gray-600 whitespace-pre-line leading-relaxed max-w-md mx-auto">
            {td("welcomeIntro")}
          </p>
        </section>

        {/* Courses */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            {td("welcomeLevels")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {LEVEL_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.contentKey}
                  href={`#${item.contentKey}`}
                  className={`flex items-start gap-3 p-4 rounded-xl border ${item.bgColor} hover:shadow-md transition`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${item.color}`} />
                  <span className="text-sm text-gray-700">{td(item.key)}</span>
                </a>
              );
            })}
          </div>
        </section>

        {/* Controls */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            {td("welcomeControls")}
          </h2>
          <div className="space-y-2">
            {CONTROL_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <Icon className={`w-5 h-5 flex-shrink-0 ${item.color}`} />
                  <span className="text-sm text-gray-700">{td(item.key)}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Level Guides */}
        {LEVEL_ITEMS.map((item) => {
          const content = HELP_CONTENTS[item.contentKey];
          if (!content) return null;
          const Icon = item.icon;
          return (
            <section key={item.contentKey} id={item.contentKey} className="scroll-mt-16">
              <div className="flex items-center gap-2 mb-4">
                <Icon className={`w-5 h-5 ${item.color}`} />
                <h2 className="text-lg font-bold text-gray-800">
                  {td(content.titleKey)}
                </h2>
              </div>

              <div className="space-y-4 pl-1">
                {/* Mission */}
                <div>
                  <div className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">
                    {td("helpMission")}
                  </div>
                  <p className="text-sm text-gray-700">{td(content.objectiveKey)}</p>
                </div>

                {/* Steps */}
                <div>
                  <div className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">
                    {td("helpSteps")}
                  </div>
                  <ol className="space-y-1.5">
                    {content.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs">
                          {i + 1}
                        </span>
                        <span>{td(step.textKey)}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Concept */}
                <div>
                  <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">
                    {td("helpConcept")}
                  </div>
                  <p className="text-sm text-gray-700 bg-green-50 rounded-lg px-3 py-2">
                    {td(content.conceptKey)}
                  </p>
                </div>
              </div>
            </section>
          );
        })}

        {/* Shortcuts */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            {td("helpShortcuts")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {SHORTCUT_KEYS.map((k) => (
              <span
                key={k}
                className="text-xs bg-gray-100 text-gray-600 rounded px-2.5 py-1"
              >
                {td(k)}
              </span>
            ))}
          </div>
        </section>

        {/* NFC */}
        <section>
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3">
              {td("nfcCardSetup")}
            </h2>
            <NfcWriter />
          </div>
        </section>
      </main>
    </div>
  );
}

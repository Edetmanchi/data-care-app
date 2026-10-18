"use client";

import { motion } from "framer-motion";
import { LogoOrb } from "@/components/Logo";
import { ScrambleText } from "@/components/ScrambleText";
import { SearchConsole } from "@/components/SearchConsole";
import { useI18n } from "@/components/providers/language";

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.8, delay, ease: [0.2, 0.8, 0.2, 1] as const },
});

export default function Home() {
  const { t, lang } = useI18n();

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 pb-14 pt-24 sm:pt-28">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.7, rotate: -20 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
          className="mb-10 sm:mb-12"
        >
          <div className="sm:hidden">
            <LogoOrb size={150} />
          </div>
          <div className="hidden sm:block">
            <LogoOrb size={190} />
          </div>
        </motion.div>

        <motion.p {...rise(0.3)} className="mb-4 font-mono text-[11px] uppercase tracking-[0.35em] text-pulse">
          <span className="animate-blink mr-2 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-alarm align-middle" />
          <ScrambleText key={lang} text={t("hero.eyebrow")} />
        </motion.p>

        <motion.h1
          {...rise(0.45)}
          className="text-glow font-display text-[2.4rem] font-bold leading-[1.05] tracking-tight sm:text-6xl"
        >
          <span className="bg-gradient-to-b from-white via-[#dffaf5] to-[#7fd9cc] bg-clip-text text-transparent">
            {t("hero.title")}
          </span>
        </motion.h1>

        <motion.p {...rise(0.6)} className="mt-5 max-w-xl text-base leading-relaxed text-mist sm:text-lg">
          {t("hero.subtitle")}
        </motion.p>

        <motion.div {...rise(0.75)} className="mt-9 w-full">
          <SearchConsole />
        </motion.div>
      </div>
    </main>
  );
}

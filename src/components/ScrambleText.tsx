"use client";

import { useEffect, useState } from "react";

const GLYPHS = "▓▒░<>/\\[]{}#*+=01ΔΣΞ";

/** Text that "decrypts" itself into place — the cryptic signature of the brand. */
export function ScrambleText({ text, className, speed = 28 }: { text: string; className?: string; speed?: number }) {
  const [out, setOut] = useState(text);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOut(text);
      return;
    }
    let frame = 0;
    const total = text.length + 12;
    const id = setInterval(() => {
      frame++;
      setOut(
        Array.from(text, (ch, i) => {
          if (ch === " " || i < frame - 12) return ch;
          if (i < frame) return GLYPHS[(Math.random() * GLYPHS.length) | 0];
          return " ";
        }).join(""),
      );
      if (frame >= total) {
        clearInterval(id);
        setOut(text);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </span>
  );
}

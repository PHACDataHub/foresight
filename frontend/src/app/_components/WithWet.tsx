"use client";

import React, { useEffect } from "react";
import { WetProvider } from "@arcnovus/wet-boew-react";
import useWetLang from "~/app/_hooks/useWetLang";

declare global {
  interface Window {
    wet: object;
  }
}

export default function WithWet({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    window.wet = window.wet || {};
    let tries = 0;
    const findCanadaCaTitle = () => {
      setTimeout(() => {
        const old_t = document.getElementsByTagName("title");
        let found = false;
        tries += 1;
        if (old_t.length > 0) {
          for (let x = 0; x < old_t.length; x += 1) {
            const el = old_t.item(x);
            if (el && el.innerText === "Canada.ca") {
              found = true;
              el.remove();
              const t = document.createElement("title");
              t.innerHTML = "Signals - Signaux";
              document.head.appendChild(t);
            }
          }
        }
        if (!found && tries < 1000) findCanadaCaTitle();
      }, 100);
    };
    findCanadaCaTitle();
  }, []);
  const lang = useWetLang();
  return <WetProvider language={lang}>{children}</WetProvider>;
}

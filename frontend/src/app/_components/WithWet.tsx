"use client";

import { WetProvider } from "@arcnovus/wet-boew-react";
import React, { useEffect } from "react";
import useWetLang from "../_hooks/useWetLang";

declare global {
  interface Window {
    wet: object;
  }
}

export default function WithWet({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    window.wet = window.wet || {};
  }, []);
  const lang = useWetLang();
  return <WetProvider language={lang}>{children}</WetProvider>;
}

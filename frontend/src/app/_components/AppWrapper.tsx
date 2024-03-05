"use client";

import { useParams } from "next/navigation";
import React, { useRef } from "react";
import { AppTemplate, useLngLinks } from "@arcnovus/wet-boew-react";
import { useResizeObserver } from "usehooks-ts";

import useWetLang from "~/app/_hooks/useWetLang";
import useDelayedResizeObserver from "~/app/_hooks/useDelayedResizeObserver";

export default function AppWrapper({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { locale } = useParams();
  const lang = useWetLang();
  const { lngLinks } = useLngLinks({
    currentLanguage: lang,
    translatedPage: locale === "en-CA" ? "/fr-CA/1" : "/en-CA/1",
  });
  const ref = useRef<HTMLDivElement | null>(null);

  const { height = 0 } = useResizeObserver({
    ref,
    box: "border-box",
  });

  const headerHeight = useDelayedResizeObserver("def-appTop");
  const preFooterHeight = useDelayedResizeObserver("def-preFooter");
  const footerHeight = useDelayedResizeObserver("wb-info");

  return (
    <div className="h-full max-h-[100%] min-h-[100%] w-full" ref={ref}>
      <AppTemplate
        appName={[{ text: title, href: "/" }]}
        lngLinks={lngLinks}
        showShare={false}
        showFeedback={false}
        isApplication={true}
      >
        <div
          style={{
            height: height - headerHeight - preFooterHeight - footerHeight,
          }}
          className="flex flex-col"
        >
          {children}
        </div>
      </AppTemplate>
    </div>
  );
}

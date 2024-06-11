"use client";

import { SplashTemplate } from "@arcnovus/wet-boew-react";
import WithWet from "./_components/WithWet";

export default function SplashScreen() {
  return (
    <html className="no-js h-full">
      <head><title>Signals - Signaux</title></head>
      <body className="h-full">
        <WithWet>
          <SplashTemplate
            nameEng="Signals"
            nameFra="Signaux"
            indexEng="/en-CA/1"
            indexFra="/fr-CA/1"
          />
        </WithWet>
      </body>
    </html>
  );
}


import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "@mui/material/Link";

import Image from "next/image";
import ProductTour from "./ProductTour";

export default function GocTheme({ children }: { children: React.ReactNode }) {
  const { locale } = useParams();

  const lngLinks = useMemo(() => {
    if (locale === "en-CA")
      return [{ text: "Français", href: "/fr-CA/1", lang: "fr" }];
    return [{ text: "English", href: "/en-CA/1", lang: "en" }];
  }, [locale]);

  return (
    <>
      <div id="def-appTop" className="flex pl-[30px] pr-[30px]">
        <header className="flex flex-1 items-center justify-between">
          <div
            className=""
            property="publisher"
            typeof="GovernmentOrganization"
          >
            <Image
              src="https://www.canada.ca/etc/designs/canada/cdts/gcweb/v4_1_0/wet-boew/assets/sig-blk-en.svg"
              alt="Government of Canada"
              property="logo"
              width={431.22}
              height={39.98}
            />
            <span className="wb-inv">
              / <span lang="fr">Gouvernement du Canada</span>
            </span>
            <meta property="name" content="Government of Canada" />
            <meta property="areaServed" typeof="Country" content="Canada" />
            <link
              property="logo"
              href="https://www.canada.ca/etc/designs/canada/cdts/gcweb/v4_1_0/wet-boew/assets/wmms-blk.svg"
            />
          </div>

          <section className="flex space-x-2" style={{ fontSize: 18 }}>
            <h2 className="wb-inv">Application Menus</h2>
            <ul id="top-menu" className="flex space-x-2">
              <ProductTour />
            </ul>
            <ul className="flex space-x-2">
              {lngLinks.map((lng) => (
                <li key={`lng_${lng.lang}`}>
                  <Link lang={lng.lang} href={lng.href}>
                    {lng.text}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </header>
      </div>
      <main
        property="mainContentOfPage"
        resource="#wb-main"
        className="container"
        typeof="WebPageElement"
      >
        {children}
      </main>
      <div>
        <footer
          id="wb-info"
          className="flex items-center justify-end bg-gray-100 pr-[30px]"
        >
          <Image
            src="https://www.canada.ca/etc/designs/canada/cdts/gcweb/v4_1_0/wet-boew/assets/wmms-blk.svg"
            alt="Symbol of the Government of Canada"
            width={168.23}
            height={40}
          />
        </footer>
      </div>
    </>
  );
}

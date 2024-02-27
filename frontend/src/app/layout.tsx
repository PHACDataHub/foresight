import "~/styles/globals.css";

import WithWet from "./_components/WithWet";

export default function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const lang = locale || "en-CA";
  return (
    <WithWet>
      <html className="no-js h-full" lang={lang}>
        <body className="h-full">{children}</body>
      </html>
    </WithWet>
  );
}

import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";

type I18nMessages = {
  default: Record<string, Record<string, string>>;
};

export const locales = ["en-CA", "fr-CA"];

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale)) notFound();

  const messages = (
    (await import(`../messages/${locale}.json`)) as I18nMessages
  ).default;

  return { messages };
});

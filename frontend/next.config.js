/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin();

await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
    output: "standalone"
};

export default withNextIntl(config);
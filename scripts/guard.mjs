// Tests create throwaway accounts and items. Running them against production
// leaves that junk in the real database, so make it an explicit choice.
export function refuseProduction(base) {
  const isProd = /nijiya\.ashwinmalkani\.dev/.test(base);
  if (isProd && process.env.ALLOW_PROD !== "1") {
    console.error(
      `\nRefusing to run against production (${base}).\n` +
        `These tests sign up users and create items, which would pollute the real data.\n` +
        `Run them against a local dev server instead, or set ALLOW_PROD=1 if you\n` +
        `really mean it (and clean up afterwards).\n`,
    );
    process.exit(1);
  }
}

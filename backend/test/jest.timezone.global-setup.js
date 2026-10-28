// Runs once in the Jest parent process, before any worker starts: workers inherit
// this TZ. Setting process.env.TZ inside a test file has no effect on Date.
// Default Europe/Paris (DST, users' zone) so local-time bugs fail on every machine
// and in CI; `TEST_TZ` re-runs the date tests under another zone (test:tz:west).
module.exports = async () => {
  process.env.TZ = process.env.TEST_TZ || 'Europe/Paris';
};

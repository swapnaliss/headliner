// Root entry so `npx playwright test apps/web/tests/a11y apps/web/tests/keyboard` works from the repository root.
export { default, PICKER_PORT } from "./apps/web/playwright.config";

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * MSW worker for browser (used in Storybook).
 */
export const worker = setupWorker(...handlers);

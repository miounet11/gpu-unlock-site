import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

// "/" is deliberately absent: in a standalone build next-intl derives the redirect
// origin from the address the server listens on, so it answered `Location:
// https://localhost:3200/en`. The root is redirected to /en by next.config.ts instead,
// where the redirect is emitted as a path-relative Location.
export const config = {
  matcher: ["/(en|zh|ja|de|fr|es|pt)/:path*"],
};

import Link from "next/link";

// The 404 for paths outside any locale (the middleware matcher only covers locale-prefixed
// paths). Must carry its own <html>/<body>: the root layout renders no markup of its own.
// This file is also what Next prerenders as the static `_not-found` page, so it ships as
// plain HTML — visible without JavaScript, unlike the streaming 404 inside [locale].
export default function NotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1>404</h1>
        <p>That page does not exist.</p>
        <p>
          <Link href="/en">GPU Unlock — home</Link>
        </p>
      </body>
    </html>
  );
}

/** Vitest stand-in for `next/font/local`, which only exists inside the Next.js compiler. Returns the same shape with no CSS. */
export default function localFont(): { className: string; variable: string; style: { fontFamily: string } } {
  return { className: "", variable: "", style: { fontFamily: "" } };
}

/**
 * Email links. `mailto:` opens the OS default mail app (often not Gmail).
 * On desktop we open Gmail's compose window; on touch devices we keep mailto,
 * which the Gmail app handles. The mailto href stays on the <a> so it still
 * works without JS.
 */
export const CONTACT = {
  to: "dikhyantsatpathy@gmail.com",
  /** Optional CC address. Leave "" to omit. */
  cc: "",
  subject: "Project inquiry",
  body: "Hi Dikhyant,\n\nI came across your portfolio and wanted to talk about …\n\n",
};

const enc = encodeURIComponent; // %20, not '+': mailto does not decode '+'

export const gmailUrl = (m = CONTACT) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(m.to)}` +
  (m.cc ? `&cc=${enc(m.cc)}` : "") +
  `&su=${enc(m.subject)}&body=${enc(m.body)}`;

export const mailtoUrl = (m = CONTACT) =>
  `mailto:${m.to}?` +
  [m.cc && `cc=${enc(m.cc)}`, `subject=${enc(m.subject)}`, `body=${enc(m.body)}`]
    .filter(Boolean)
    .join("&");

const isTouch = () => matchMedia("(pointer: coarse)").matches;

/** onClick for every email link: Gmail web on desktop, native mailto on touch. */
export function openMail(e: { preventDefault(): void }) {
  if (isTouch()) return;
  e.preventDefault();
  window.open(gmailUrl(), "_blank", "noopener,noreferrer");
}

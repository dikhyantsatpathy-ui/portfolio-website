/**
 * Static content fallback.
 *
 * The canonical content lives in Firestore (edited via /admin). This file is the
 * cold-start state: it renders if Firestore is empty, unreachable, or blocked by
 * rules — and it keeps the site meaningful during a deploy or an outage.
 *
 * Once Firestore has documents, Firestore wins. Nothing here overwrites the DB.
 */

import type { Profile, Section } from "../types";

export const fallbackProfile: Profile = {
  id: "fallback",
  name: "Dikhyant Satapathy",
  subtitle: "Software Engineer",
  bio: "I build web systems that stay up and stay fast — interfaces that load fast on a bad connection, and backends that don't fall over when traffic spikes. Most of my work lives at the seam between frontend and infrastructure.",
  skills: [
    "TypeScript",
    "React",
    "Node.js",
    "Python",
    "Firebase",
    "PostgreSQL",
    "Tailwind CSS",
    "Vite",
    "C++",
    "Docker",
  ],
  email: "dikhyantsatpathy@gmail.com",
  github: "github.com/dikhyantsatpathy-ui",
  linkedin: "linkedin.com/in/dikhyant-satapathy",
  twitter: "",
  location: "Odisha, India",
  educationInfo: "B.Tech, Computer Science",
  institution: "ITER, SOA University",
  interests: [
    {
      id: "i1",
      title: "Systems & Infrastructure",
      description:
        "Docker, CI pipelines, and the unglamorous work of making a deploy boring and repeatable.",
      icon: "code",
    },
    {
      id: "i2",
      title: "Interface Engineering",
      description:
        "Accessible, fast-loading interfaces. Measured by Core Web Vitals, not by how it looks in a mockup.",
      icon: "sparkles",
    },
    {
      id: "i3",
      title: "Security",
      description:
        "Threat modelling, input validation, and keeping secrets on the server where they belong.",
      icon: "shield",
    },
    {
      id: "i4",
      title: "Reading",
      description:
        "Operating systems, compilers, and databases — mostly to find out why the abstraction above is lying.",
      icon: "book",
    },
  ],
  ownerId: "fallback",
  updatedAt: "",
};

export const fallbackSections: Section[] = [
  {
    id: "s1",
    title: "Selected Work",
    type: "projects",
    order: 1,
    visible: true,
    ownerId: "fallback",
    updatedAt: "",
    items: [
      {
        id: "p1",
        title: "Identity Document Screening System",
        description:
          "Offline-capable screening pipeline that validates travel and identity documents, scores forgery risk from physics-based signals, and logs every decision to a tamper-evident hash chain. Built to work with no network at border posts.",
        date: "2026",
        link: "https://github.com/dikhyantsatpathy-ui",
      },
      {
        id: "p2",
        title: "This Portfolio",
        description:
          "Rebuilt around a scroll-driven 3D journey: a WebGL starfield and a modelled gyro that descends through the viewport as you scroll, a pinned horizontal project track, GSAP ScrollTrigger and Lenis. No UI framework.",
        date: "2026",
        link: "https://github.com/dikhyantsatpathy-ui",
      },
      {
        id: "p3",
        title: "Full-Stack Web Platform",
        description:
          "Firebase-backed platform with server-side API routes, rule-enforced access control, and an admin console for live content management.",
        date: "2025",
        link: "https://github.com/dikhyantsatpathy-ui",
      },
    ],
  },
];

export const socialLinks = [
  {
    label: "GitHub",
    handle: "github",
    href: "https://github.com/dikhyantsatpathy-ui",
  },
  {
    label: "LinkedIn",
    handle: "linkedin",
    href: "https://linkedin.com/in/dikhyant-satapathy",
  },
] as const;
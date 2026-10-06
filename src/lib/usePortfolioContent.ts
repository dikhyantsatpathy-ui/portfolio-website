import { useEffect, useState } from "react";
import type { Profile, Section } from "../types";
import { fallbackProfile, fallbackSections } from "../data/content";

type State = {
  profile: Profile;
  sections: Section[];
  /** True once Firestore has answered, regardless of whether it had data. */
  live: boolean;
};

const initial: State = {
  profile: fallbackProfile,
  sections: fallbackSections,
  live: false,
};

export type ContactPayload = {
  name: string;
  email: string;
  message: string;
  /** Honeypot. If filled, the submission is silently dropped. */
  website?: string;
};

/**
 * Portfolio content: Firestore when available, static content always.
 *
 * Firebase is loaded via dynamic import, deliberately. The Firebase + Firestore
 * SDK is several hundred kB and it is not needed to render a first frame — the
 * local fallback in data/content.ts covers that. Deferring it keeps the critical
 * path small and means a blocked, slow, or failing Firestore degrades to static
 * content instead of an empty page.
 *
 * The listener is only attached after a successful initial read, so a rules-
 * blocked Firestore does not leave a permanently retrying listener behind.
 */
export function usePortfolioContent() {
  const [state, setState] = useState<State>(initial);

  useEffect(() => {
    let cancelled = false;
    const teardown: Array<() => void> = [];

    (async () => {
      // Local content is already in state. Everything below is an enhancement.
      const [fb, firestore] = await Promise.all([
        import("./firebase"),
        import("firebase/firestore"),
      ]);
      if (cancelled) return;

      const { db, handleFirestoreError, OperationType } = fb;
      const {
        collection,
        doc,
        getDocs,
        onSnapshot,
        query,
        where,
        addDoc,
        serverTimestamp,
      } = firestore;

      try {
        const [profileSnap, sectionSnap] = await Promise.all([
          getDocs(query(collection(db, "profiles"))),
          getDocs(query(collection(db, "sections"), where("visible", "==", true))),
        ]);

        if (cancelled) return;

        const liveProfile = profileSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Profile)
          .find((p) => p.id === "main") ??
          (profileSnap.docs[0]
            ? ({ id: profileSnap.docs[0].id, ...profileSnap.docs[0].data() } as Profile)
            : undefined);

        const liveSections = sectionSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Section)
          .sort((a, b) => a.order - b.order);

        setState({
          profile: liveProfile ?? fallbackProfile,
          sections: liveSections.length ? liveSections : fallbackSections,
          live: true,
        });

        teardown.push(
          onSnapshot(
            doc(db, "profiles", "main"),
            (snap) => {
              if (snap.exists()) {
                setState((s) => ({
                  ...s,
                  profile: { id: snap.id, ...snap.data() } as Profile,
                  live: true,
                }));
              }
            },
            (err) => handleFirestoreError(err, OperationType.GET, "profiles/main")
          )
        );

        teardown.push(
          onSnapshot(
            query(collection(db, "sections"), where("visible", "==", true)),
            (snap) => {
              const data = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }) as Section)
                .sort((a, b) => a.order - b.order);
              if (data.length) {
                setState((s) => ({ ...s, sections: data, live: true }));
              }
            },
            (err) => handleFirestoreError(err, OperationType.LIST, "sections")
          )
        );
      } catch (err) {
        if (cancelled) return;
        handleFirestoreError(err, OperationType.LIST, "portfolio");
        // Static content stays in place; `live` remains false.
      }
    })();

    return () => {
      cancelled = true;
      teardown.forEach((fn) => fn());
    };
  }, []);

  return state;
}

/**
 * Submits a contact message.
 *
 * Returns a discriminated result instead of throwing so the form can show a
 * precise state. The honeypot is checked here: a bot that fills a hidden field
 * gets a success response but nothing is written, which is quieter than a 400
 * and doesn't tell the bot it was caught.
 */
export async function submitContact(payload: ContactPayload) {
  const { name, email, message, website } = payload;

  if (website) return { ok: true as const, skipped: true as const };

  if (!name.trim() || !email.trim() || !message.trim()) {
    return { ok: false as const, error: "Please fill in every field." };
  }

  try {
    const [{ db, handleFirestoreError, OperationType }, { collection, addDoc, serverTimestamp }] =
      await Promise.all([import("./firebase"), import("firebase/firestore")]);

    await addDoc(collection(db, "messages"), {
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      read: false,
      createdAt: serverTimestamp(),
    });
    return { ok: true as const };
  } catch (err) {
    try {
      const { handleFirestoreError, OperationType } = await import("./firebase");
      handleFirestoreError(err, OperationType.CREATE, "messages");
    } catch {
      // Logging is best-effort; never let it mask the send failure.
    }
    return {
      ok: false as const,
      error: "That didn't send. Please email me directly instead.",
    };
  }
}
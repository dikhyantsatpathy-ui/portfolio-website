/**
 * Firestore security-rules tests.
 *
 * These need the Firestore emulator, which needs a JDK. If `java` is not on the
 * PATH this suite fails to connect and every test errors — the failure message
 * says so explicitly rather than looking like a rules problem.
 *
 * Run with: npm run test:rules
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

const OWNER = "dikhyantsatpathy@gmail.com";

const profile = (over: Record<string, unknown> = {}) => ({
  name: "Dikhyant Satapathy",
  subtitle: "Software engineer",
  bio: "b".repeat(50),
  skills: ["React"],
  email: "a@b.c",
  github: "github.com/x",
  linkedin: "linkedin.com/in/x",
  ownerId: "owner-uid",
  updatedAt: null, // patched to request.time by the rules' own check
  ...over,
});

const section = (over: Record<string, unknown> = {}) => ({
  title: "Work",
  type: "projects",
  items: [],
  order: 1,
  visible: true,
  ownerId: "owner-uid",
  updatedAt: null,
  ...over,
});

/** Firestore compares `updatedAt` to `request.time`; mirror that here. */
async function stamp<T extends Record<string, unknown>>(
  write: (data: T) => Promise<unknown>,
  data: T
) {
  // serverTimestamp() resolves to request.time server-side; the rules require
  // equality, so we set the sentinel the emulator substitutes.
  return write({ ...data, updatedAt: <any>"__serverTimestamp__" } as T);
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

describe("anonymous reads", () => {
  it("can read a profile", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "profiles", "main"), profile());
    });
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "profiles", "main")));
  });

  it("can read a visible section", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "sections", "work"), section({ visible: true }));
    });
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "sections", "work")));
  });

  it("cannot read a hidden section", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "sections", "secret"), section({ visible: false }));
    });
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "sections", "secret")));
  });
});

/* ------------------------------------------------------------------ *
 * Anonymous writes
 * ------------------------------------------------------------------ */

describe("anonymous writes", () => {
  it("cannot create a profile", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(stamp((d) => setDoc(doc(db, "profiles", "x"), d), profile()));
  });

  it("cannot create a section", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(stamp((d) => setDoc(doc(db, "sections", "x"), d), section()));
  });

  it("cannot write to the removed messages collection", async () => {
    // messages used to allow `create: if true` from anyone.
    const db = env.unauthenticatedContext().firestore();
    await assertFails(
      addDoc(collection(db, "messages"), { name: "x", email: "y", message: "z" })
    );
  });

  it("cannot write to the removed visitors collection", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "visitors", "1.2.3.4"), { hits: 1 }));
  });

  it("cannot write to blocked_ips", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "blocked_ips", "1.2.3.4"), { reason: "x" }));
  });
});

/* ------------------------------------------------------------------ *
 * Non-admin
 * ------------------------------------------------------------------ */

describe("signed-in non-admin", () => {
  const asUser = () =>
    env.authenticatedContext("someone-uid", { email: "other@example.com" }).firestore();

  it("cannot write a profile", async () => {
    const db = asUser();
    await assertFails(stamp((d) => setDoc(doc(db, "profiles", "x"), d), profile()));
  });

  it("cannot write a section", async () => {
    const db = asUser();
    await assertFails(stamp((d) => setDoc(doc(db, "sections", "x"), d), section()));
  });
});

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */

describe("admin", () => {
  const verified = () =>
    env.authenticatedContext("owner-uid", {
      email: OWNER,
      email_verified: true,
    }).firestore();

  const unverified = () =>
    env.authenticatedContext("owner-uid", {
      email: OWNER,
      email_verified: false,
    }).firestore();

  it("cannot write with an unverified email", async () => {
    // The address alone was enough before; an unverified account can be
    // registered for any address, which handed out write access.
    const db = unverified();
    await assertFails(stamp((d) => setDoc(doc(db, "profiles", "x"), d), profile()));
  });

  it("can write a valid profile", async () => {
    const db = verified();
    await assertSucceeds(stamp((d) => setDoc(doc(db, "profiles", "main"), d), profile()));
  });

  it("can write a valid section", async () => {
    const db = verified();
    await assertSucceeds(stamp((d) => setDoc(doc(db, "sections", "work"), d), section()));
  });

  it("cannot smuggle an unknown field into a profile", async () => {
    // hasOnly is the guard; without it arbitrary fields pass validation.
    const db = verified();
    await assertFails(
      stamp((d) => setDoc(doc(db, "profiles", "main"), d), profile({ sneaky: "value" }))
    );
  });

  it("cannot smuggle an unknown field into a section", async () => {
    const db = verified();
    await assertFails(
      stamp((d) => setDoc(doc(db, "sections", "work"), d), section({ sneaky: "value" }))
    );
  });

  it("rejects a section whose type is not in the allowed set", async () => {
    const db = verified();
    await assertFails(
      stamp((d) => setDoc(doc(db, "sections", "work"), d), section({ type: "not-a-type" }))
    );
  });

  it("rejects an over-long bio", async () => {
    const db = verified();
    await assertFails(
      stamp((d) => setDoc(doc(db, "profiles", "main"), d), profile({ bio: "x".repeat(2001) }))
    );
  });
});

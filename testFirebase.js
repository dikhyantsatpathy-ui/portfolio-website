import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, setDoc, doc } from "firebase/firestore";
import fs from "fs";

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId);

async function run() {
  try {
    await addDoc(collection(db, "messages"), {
      name: "test",
      email: "test@test.com",
      message: "hello",
      read: false
    });
    console.log("messages SUCCESS");
  } catch(e) {
    console.error("messages FAIL", e.message);
  }

  try {
    await setDoc(doc(db, "visitors", "test-ip"), {
      ip: "test-ip",
      location: "test",
    }, { merge: true });
    console.log("visitors SUCCESS");
  } catch(e) {
    console.error("visitors FAIL", e.message);
  }
}
run();

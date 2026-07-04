import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config.firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    await setDoc(doc(db, "visitors", "123_123_123"), {
      ip: "123.123.123",
      location: "Test Location",
      lastVisited: new Date().toISOString(),
      timestamp: serverTimestamp()
    }, { merge: true });
    console.log("Success");
  } catch (e) {
    console.error("Error", e);
  }
}
test();

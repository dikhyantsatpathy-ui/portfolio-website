import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, "ai-studio-1a02b748-12de-43f1-9044-c2c7ecdf480a");

async function test() {
  try {
    const cleanIp = "write_test_ip";
    await setDoc(doc(db, "visitors", cleanIp), {
      ip: cleanIp,
      location: "Test Location",
      lastVisited: new Date().toISOString(),
      timestamp: serverTimestamp()
    }, { merge: true });
    console.log("Success Write");
    process.exit(0);
  } catch (e) {
    console.error("Error Write", e);
    process.exit(1);
  }
}
test();

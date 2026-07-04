import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, "ai-studio-1a02b748-12de-43f1-9044-c2c7ecdf480a");

async function test() {
  try {
    const cleanIp = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
    await setDoc(doc(db, "visitors", cleanIp), {
      ip: cleanIp,
      location: "Test Location",
      lastVisited: new Date().toISOString(),
      timestamp: serverTimestamp()
    }, { merge: true });
    console.log("Success IPv6");
    process.exit(0);
  } catch (e) {
    console.error("Error IPv6", e);
    process.exit(1);
  }
}
test();

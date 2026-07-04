import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "ai-studio-1a02b748-12de-43f1-9044-c2c7ecdf480a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const docRef = doc(db, "profiles", "main");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    let interests = data.interests || [];
    if (!interests.find(i => i.title === 'Coding & Development')) {
      interests.push({
        id: '4',
        title: 'Coding & Development',
        icon: 'code',
        description: 'Building full-stack web applications, exploring new frameworks, and continuously learning software engineering principles.'
      });
      await setDoc(docRef, { interests }, { merge: true });
      console.log("Updated interests!");
    } else {
      console.log("Already has it.");
    }
  }
}
run();

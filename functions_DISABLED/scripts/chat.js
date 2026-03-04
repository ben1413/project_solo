const admin = require("firebase-admin");
const readline = require("readline");

const serviceAccount = require("../service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "project-solo-6b864"
});

const db = admin.firestore();
const TOPIC = "dev-session";
const CHAPTER = "night-shift-1";
const RUN = "run-1";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("\n🔴 --- PROJECT SOLO: SCRIBE UPLINK ---\n");

function ask() {
  rl.question("User > ", async (input) => {
    if (input.toLowerCase() === "exit") process.exit(0);

    const msgRef = await db.collection("projectSolo").doc("default")
      .collection("topics").doc(TOPIC)
      .collection("chapters").doc(CHAPTER)
      .collection("runs").doc(RUN)
      .collection("messages").add({
        role: "human",
        content: input,
        agentRequest: { scribe: "auto" },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    process.stdout.write("Scribe > (Thinking...)");

    const unsubscribe = db.collection("projectSolo").doc("default")
      .collection("topics").doc(TOPIC)
      .collection("chapters").doc(CHAPTER)
      .collection("runs").doc(RUN)
      .collection("messages")
      .where("replyToMessageId", "==", msgRef.id)
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === "added") {
            const data = change.doc.data();
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            console.log("Scribe > " + data.content + "\n");
            unsubscribe();
            ask();
          }
        });
      });
  });
}
ask();

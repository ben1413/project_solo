import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import OpenAI from "openai";
import { initializeBridge } from "../../p0/core/bridge";
import { AGENT_PROMPTS } from "../../p0/core/prompts";

admin.initializeApp();
const db = admin.firestore();
initializeBridge();

const OPENAI_MODEL = "gpt-4o-mini";

// 1. THE CHAT HANDLER (Scribe Uplink)
export const onMessageCreated = functions.firestore
  .document("projectSolo/default/topics/{topicId}/chapters/{chapterId}/runs/{runId}/messages/{messageId}")
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();
    const { topicId, chapterId, runId, messageId } = context.params;
    if (message.role !== "human" || !message.agentRequest?.scribe) return;

    const replyDocId = `${messageId}_scribe`;
    const replyRef = db.collection("projectSolo").doc("default")
      .collection("topics").doc(topicId)
      .collection("chapters").doc(chapterId)
      .collection("runs").doc(runId)
      .collection("messages").doc(replyDocId);

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const mode = AGENT_PROMPTS.scribe.getMode(message.content);
      
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
            { role: "system", content: AGENT_PROMPTS.scribe.system },
            { role: "user", content: `[MODE: ${mode}] Context: ${topicId}. Message: ${message.content}` }
        ],
      });

      await replyRef.set({
        id: replyDocId, topicId, chapterId, runId, role: "agent",
        content: completion.choices[0].message.content,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        agentId: "scribe", replyToMessageId: messageId,
        meta: { mode, provider: "openai" }
      });
    } catch (error) { console.error("Scribe Error:", error); }
  });

// 2. THE DAILY DASHBOARD (Scheduled at 8:00 AM)
export const dailyPriorityDashboard = functions.pubsub
  .schedule("0 8 * * *")
  .onRun(async (context) => {
    console.log("Generating Daily Priority Dashboard...");
    const topics = ["Runway", "Partner", "Kids", "Work", "Ideas", "Community Clubhouse", "Funding", "P0", "Health", "General", "Other"];
    
    // Logic to pull the latest message from each topic and summarize would go here.
    // For now, it logs the trigger to prove the 'Sanity Layer' is awake.
    return null;
  });

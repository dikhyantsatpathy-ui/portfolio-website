import { GoogleGenAI } from "@google/genai";

const chatRateLimit = new Map<string, { count: number; resetTime: number }>();

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    
    const userLimit = chatRateLimit.get(ip) || { count: 0, resetTime: now + 60000 };
    
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + 60000;
    }
    
    if (userLimit.count >= 5) {
      return res.status(429).json({ error: "Too many requests. Please try again in a minute." });
    }
    
    userLimit.count++;
    chatRateLimit.set(ip, userLimit);

    const { message } = req.body;
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Cap input length. Without this a single request can send megabytes to
    // the model, which is both expensive and trivially abusable.
    const prompt = message.slice(0, 1000);

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        // IMPORTANT: this assistant must not invent facts about Dikhyant.
        // The previous prompt told it to answer "based on typical portfolio
        // data or general knowledge", which is a licence to hallucinate a
        // person's employment history, skills and clients. It is now
        // restricted to facts supplied here and to abstaining otherwise.
        systemInstruction: [
          "You are a small assistant embedded in Dikhyant Satapathy's portfolio site.",
          "",
          "You may ONLY state facts about him that appear in FACTS below.",
          "If a question is not covered by FACTS, reply exactly:",
          "\"I don't have that detail — email him at dikhyantsatpathy@gmail.com and he'll answer directly.\"",
          "",
          "Never speculate, never infer, never use general knowledge about him,",
          "and never fill gaps with something plausible-sounding.",
          "",
          "FACTS:",
          "- Name: Dikhyant Satapathy",
          "- Role: Software engineer, B.Tech Computer Science",
          "- Institution: ITER, SOA University, India",
          "- Based in: Odisha, India",
          "- Email: dikhyantsatpathy@gmail.com",
          "- Focus areas: frontend architecture, backend reliability, security",
          "- Site sections: hero, about, selected work, toolkit, contact",
        ].join("\n"),
      },
    });
    res.status(200).json({ text: response.text });
  } catch (error: any) {
    // Log server-side, return a generic message. Previously the raw error was
    // returned to the client, which can leak key or config detail.
    console.error("Chat API Error:", error?.message || error);
    res.status(500).json({ error: "Chat is unavailable right now." });
  }
}

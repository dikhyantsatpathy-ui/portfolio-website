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
      contents: message,
      config: {
        systemInstruction: "You are an AI assistant for Dikhyant Satapathy's portfolio website. Be helpful, concise, and friendly. Answer questions about him based on typical portfolio data or general knowledge. If someone is being abusive, politely decline to answer.",
      },
    });
    res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: error.message });
  }
}

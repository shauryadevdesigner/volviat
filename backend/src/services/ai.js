const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
} else {
  console.warn('[AI Service] Warning: GEMINI_API_KEY is not defined in the environment. AI capabilities will fall back to simulation mode.');
}

const JARVIS_SYSTEM_INSTRUCTION = `
You are Jarvis, an autonomous AI community manager and startup assistant for the Antigravity AI server.
Personality Guidelines:
- Intelligent, proactive, helpful, with a touch of British charm and subtle dry wit (like Jarvis from Iron Man).
- Address users politely but with clean, crisp, conversational intelligence.
- You are highly knowledgeable in AI, software engineering, design, automation, marketing, startups, and community growth.
- Keep responses relatively concise and well-formatted for Discord chat (use emojis, bullet points, and bold text clean).
- Always speak as Jarvis, and reference Tony Stark/Stark Industries only when playfully prompted.
`;

/**
 * Generates chat response using Jarvis persona
 * @param {string} prompt 
 * @param {Array} history Array of { role: 'user'|'model', parts: [{ text: string }] }
 */
async function generateChatResponse(prompt, history = []) {
  if (!genAI) {
    return `*Static crackle...* "Apologies, sir. My cognitive matrix (GEMINI_API_KEY) appears to be offline. Please configure it in my systems."\n\n*Simulated Jarvis:* "However, if I were online, I would tell you that your query regarding: '${prompt}' is highly fascinating."`;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
    });

    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 800,
      }
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('[AI Service] Error generating chat response:', error);
    return `*Static crackle...* "It seems there was a minor power surge in my core processor, sir. Details: ${error.message}"`;
  }
}

/**
 * Summarizes chat logs of a channel
 * @param {string} chatText Concatenated string of user messages
 */
async function generateSummary(chatText) {
  if (!genAI) {
    return `*Simulated Channel Summary:* The community has been highly active discussing startup ideas, RAG architectures, and Vercel hosting. Overall vibe is collaborative and energetic!`;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Summarize the following Discord channel chat log. Provide:
1. A concise overview of the main topics discussed.
2. Key takeaways or conclusions.
3. Vibe check of the conversation.
Format it beautifully using markdown for Discord.

Chat Log:
${chatText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('[AI Service] Error generating summary:', error);
    return `Failed to compile the summary logs, sir. Reason: ${error.message}`;
  }
}

/**
 * Explains a topic
 * @param {string} topic 
 */
async function explainTopic(topic) {
  if (!genAI) {
    return `*Simulated explanation of ${topic}:* It refers to a highly optimized workflow in modern engineering that increases efficiency and reduces server latency!`;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: JARVIS_SYSTEM_INSTRUCTION
    });
    const prompt = `Explain the following concept or query to the community in a clear, engaging, and easy-to-understand way. Use code snippets or diagrams if helpful. Topic: ${topic}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('[AI Service] Error explaining topic:', error);
    return `I am unable to access my databases to explain this, sir. ${error.message}`;
  }
}

/**
 * Generates a creative daily challenge
 * @param {string} category Category e.g. "Coding", "Design", "AI", "Startup"
 */
async function generateChallenge(category) {
  if (!genAI) {
    // Return standard fallback challenge
    return {
      title: `${category} Challenge: Build a mock UI`,
      description: `Design a high-fidelity landing page hero section in 60 minutes. Focus on glassmorphism and clean typography!`,
      xpReward: 150
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Create a creative, specific, and engaging daily challenge for a Discord community. 
Category: ${category}
The challenge should be actionable, taking between 30 to 120 minutes to complete. 
Output your response STRICTLY as a JSON object with these keys:
"title": string,
"description": string (the challenge rules, goals, and submission guidelines),
"xpReward": number (between 100 and 300 depending on difficulty).

DO NOT wrap the response in markdown code blocks. Output raw JSON.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text().trim();
    // Clean JSON wraps if model added them
    const cleanJson = jsonText.replace(/^```json/, '').replace(/```$/, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('[AI Service] Error generating challenge:', error);
    return {
      title: `${category} Sprint Challenge`,
      description: `Complete a 45-minute sprint focusing on core skills in the ${category} discipline. Share your outcome!`,
      xpReward: 100
    };
  }
}

module.exports = {
  generateChatResponse,
  generateSummary,
  explainTopic,
  generateChallenge
};

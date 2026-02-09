
import { GoogleGenAI } from "@google/genai";
import { StatisticalSummary, Language } from "../types";

export const getAIInsight = async (stats: StatisticalSummary[], lang: Language): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const statsSummary = stats.map(s => 
    `${s.columnName}: Mean=${s.mean?.toFixed(2)}, Median=${s.median?.toFixed(2)}, StdDev=${s.stdDev?.toFixed(2)}, Range=${s.min}-${s.max}`
  ).join("\n");

  const prompt = lang === 'en' 
    ? `You are a professional data scientist. Analyze the following statistical data and provide 3 key business or analytical insights. Keep it concise, engaging, and professional.\n\nData:\n${statsSummary}`
    : `你是一位专业的数据科学家。请分析以下统计数据并提供3条关键的业务或分析见解。保持简洁、专业且富有洞察力。\n\n数据：\n${statsSummary}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || (lang === 'en' ? "Failed to get insight." : "获取见解失败。");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return lang === 'en' ? "Error connecting to AI service." : "连接 AI 服务出错。";
  }
};

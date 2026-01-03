import { GoogleGenerativeAI } from "@google/generative-ai"

export interface NotificationContent {
  title: string;
  body: string;
}

export class AiService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateMessage(itemName: string, stock: number, unit: string): Promise<NotificationContent> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        generationConfig: { responseMimeType: "application/json" } 
      });

      const prompt = `
        Berperanlah sebagai asisten gudang.
        Stok "${itemName}" sisa ${stock} ${unit} (Kritis).
        Buat notifikasi Android singkat, gaya bahasa Indonesia santai/pasar, panggil "Bos".
        Output JSON: { "title": "...", "body": "..." }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      return JSON.parse(text) as NotificationContent;

    } catch (error) {
      console.error("AI Error:", error);
      return { title: "ALERT STOCK", body: `Bos, ${itemName} sisa ${stock} ${unit}. Restock segera!` };
    }
  }
}
import { serve } from "std/http/server.ts"
import { GoogleGenerativeAI } from "@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { items, supplier_name } = await req.json()

    // Validasi Payload
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Daftar item belanja wajib ada.')
    }

    const apiKey = Deno.env.get('GOOGLE_API_KEY')
    if (!apiKey) throw new Error('API Key missing')

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        generationConfig: { responseMimeType: "application/json", temperature: 1.0 } 
    })

    const prompt = `
      Anda asisten toko. Buatkan chat WhatsApp order barang ke Supplier.
      
      Supplier: ${supplier_name || 'Bos Supplier'}
      Barang: ${JSON.stringify(items)}
      
      Gaya Bahasa:
      - Sopan, akrab, tapi profesional (Chat WA).
      - Pakai list strip (-) untuk barang.
      - Jangan kaku seperti surat resmi.
      
      Output JSON: { "message": "String pesan WA..." }
    `

    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json|```/g, '').trim()
    
    return new Response(text, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    const msg = (error instanceof Error) ? error.message : "Unknown Error"
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: corsHeaders })
  }
})
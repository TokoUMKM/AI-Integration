import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "npm:@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // 1. Preflight Check (CORS)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 2. Validasi Input
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) throw new Error('Content-Type must be multipart/form-data')

    const formData = await req.formData()
    const file = formData.get('file')

    // Validasi file
    if (!file || !(file instanceof File)) throw new Error('No file uploaded')
    if (file.size > 4 * 1024 * 1024) throw new Error('File too large (Max 4MB)')

    // 3. Setup AI (Temperature 0.0 untuk akurasi data)
    const apiKey = Deno.env.get('GOOGLE_API_KEY')
    if (!apiKey) throw new Error('API Key Gemini hilang. Cek file .env Anda.')
    
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json", temperature: 0.0 }
    })

    // 4. Convert Image to Base64
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // 5. Prompt Engineering (Strict Mode)
    const prompt = `
      Anda adalah mesin OCR struk belanja. Ekstrak data menjadi JSON murni.
      ATURAN:
      1. Abaikan baris diskon/pajak/total/kembalian. Hanya ambil ITEM BARANG.
      2. Jika Qty tidak ada, default = 1.
      3. Perbaiki typo nama barang (misal: "Mnyk" -> "Minyak").
      4. Price adalah harga SATUAN (bukan total). Format integer tanpa titik/koma.
      
      OUTPUT SCHEMA:
      {
        "success": true,
        "data": {
          "supplier_name": "String atau null",
          "transaction_date": "YYYY-MM-DD atau null",
          "items": [
            { "name": "Nama Barang (Title Case)", "qty": 1, "price": 10000 }
          ],
          "summary_text": "Ringkasan singkat (String)"
        }
      }
    `

    // 6. Execute AI
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: file.type } }
    ])

    // 7. Clean & Parse JSON
    const text = result.response.text().replace(/```json|```/g, '').trim()
    
    // Return Data Asli
    return new Response(text, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    // Error Handling
    const errorMessage = (error instanceof Error) ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
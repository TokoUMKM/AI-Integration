import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Validasi Input
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      throw new Error('Gunakan mode upload file (multipart/form-data).')
    }

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) throw new Error('File foto tidak ditemukan.')
    if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran foto max 10MB.')

    // 2.  API Key Groq
    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) throw new Error('GROQ_API_KEY belum diatur.')

    // 3. Konversi ke Base64
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    const base64Data = btoa(binary)
    const dataUrl = `data:${file.type};base64,${base64Data}`

    // 4. System Prompt & Request ke Groq
    const systemPrompt = `
      Anda adalah AI Scanner Struk Belanja (Receipt OCR).
      Tugas: Ekstrak item belanjaan dari gambar struk ke format JSON.
      
      Aturan:
      1. Validasi: Pastikan gambar adalah STRUK BELANJA fisik. Jika bukan, set "success": false.
      2. Ambil data: Nama Barang, Qty (default 1), Harga Satuan (angka saja).
      3. Format Output: JSON Murni.
      
      JSON Schema:
      {
        "success": true,
        "user_message": "Berhasil scan (jumlah) barang.",
        "data": {
          "supplier_name": "Nama Toko (atau null)",
          "transaction_date": "YYYY-MM-DD (atau null)",
          "items": [
             { "name": "Nama Barang", "qty": 1, "price": 5000 }
          ],
          "summary_text": "Ringkasan singkat"
        }
      }
    `

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct", 
        
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ],
        temperature: 0.1,
        stream: false,
        response_format: { type: "json_object" } 
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      if (response.status === 429) {
         throw new Error("Limit Groq Harian Tercapai (1000 request). Coba besok.")
      }
      throw new Error(`Groq Error (${response.status}): ${errText}`)
    }

    const json = await response.json()
    const content = json.choices[0].message.content

    // 6. Parsing & Cleaning
    let finalResult
    try {
        finalResult = JSON.parse(content)
    } catch (e) {
        console.error("JSON Parse Fail:", content)
        throw new Error("AI gagal format data. Coba foto ulang.")
    }

    // Fallback pesan user
    if (!finalResult.user_message) {
        finalResult.user_message = finalResult.success ? "Scan berhasil." : "Gagal membaca struk."
    }

    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    return new Response(JSON.stringify({
      success: false,
      user_message: msg,
      data: null
    }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
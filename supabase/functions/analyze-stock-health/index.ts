import { serve } from "std/http/server.ts"
import { createClient } from "@supabase/supabase-js"
import { GoogleGenerativeAI } from "@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Setup Clients & Environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey = Deno.env.get('GOOGLE_API_KEY')

    if (!supabaseUrl || !supabaseKey || !apiKey) {
      throw new Error('Server misconfiguration: Missing ENV variables.')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // 2. Auth Validation (Cek siapa yang login)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Authorization header missing')

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('User tidak valid atau token expired')

    // 3. Fetch Data Real dari Database
    const { data: products, error: dbError } = await supabase
      .from('products')
      .select('name, current_stock, avg_daily_sales')
      .eq('user_id', user.id) // Hanya ambil data milik user ini

    if (dbError) throw new Error(`Database Error: ${dbError.message}`)

    // 4. Logic Matematika (Burn Rate)
    const alerts: any[] = []

    if (products && products.length > 0) {
        products.forEach((p: any) => {
            // Hindari pembagian dengan nol
            const burnRate = p.avg_daily_sales > 0 ? p.avg_daily_sales : 0.1
            const daysRemaining = p.current_stock / burnRate
            
            // STATUS: DANGER (< 3 hari), WARNING (< 7 hari)
            if (daysRemaining < 3) {
                alerts.push({
                    name: p.name,
                    sisa: p.current_stock,
                    habis_dalam: Math.ceil(daysRemaining)
                })
            }
        })
    }

    // 5. Logic AI (Hanya bicara jika ada masalah)
    let agentMessage = "Stok aman terkendali, Bos. Toko siap tempur!"
    
    if (alerts.length > 0) {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", 
            generationConfig: { responseMimeType: "application/json", temperature: 0.8 } 
        })
        
        const prompt = `
          Berperanlah sebagai asisten toko yang cerewet, perhatian, dan agak panik.
          Data stok kritis user ini: ${JSON.stringify(alerts)}
          
          Tugas: 
          1. Lapor ke "Bos" (User).
          2. Highlight barang yang paling parah (habis_dalam terendah).
          3. Desak untuk belanja sekarang juga.
          4. Maksimal 2 kalimat pendek. Bahasa Indonesia santai/pasar.
          
          Output JSON: { "message": "teks..." }
        `
        
        const aiResult = await model.generateContent(prompt)
        const text = aiResult.response.text().replace(/```json|```/g, '').trim()
        
        // Safety parsing
        try {
            const json = JSON.parse(text)
            agentMessage = json.message
        } catch (e) {
            agentMessage = "Bos, ada stok menipis nih. Cek list di bawah ya!" // Fallback jika AI error
        }
    }

    return new Response(JSON.stringify({
      status: alerts.length > 0 ? 'WARNING' : 'SAFE',
      agent_message: agentMessage,
      alerts: alerts
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    const msg = (error instanceof Error) ? error.message : "Unknown Error"
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: corsHeaders })
  }
})
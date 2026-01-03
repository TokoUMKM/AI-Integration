import { serve } from "std/http/server.ts"
import { AiService } from "./ai-service.ts"

console.log("🚀 Analyzer Started")

serve(async (req) => {
  try {
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('MY_SERVICE_ROLE_KEY') 

    if (!googleApiKey || !supabaseUrl || !supabaseServiceRoleKey) {
        console.error("Missing vars:", { 
            google: !!googleApiKey, 
            url: !!supabaseUrl, 
            key: !!supabaseServiceRoleKey 
        })
        throw new Error('Missing Env Variables')
    }
    // 1. Terima Data Webhook
    const payload = await req.json()
    const record = payload.record 

    if (!record || record.current_stock === undefined) {
      return new Response(JSON.stringify({ message: "No data" }), { headers: { "Content-Type": "application/json" } })
    }

    // 2. Logika Cek Stok
    if (record.current_stock <= record.min_stock) {
      console.log(`⚠️ Critical: ${record.name}`)

      // 3. Panggil AI
      const ai = new AiService(googleApiKey)
      const message = await ai.generateMessage(record.name, record.current_stock, record.unit)

      // 4. Panggil Fungsi 'push-notification'
      const pushFunctionUrl = `${supabaseUrl}/functions/v1/push-notification`
      
      const pushResponse = await fetch(pushFunctionUrl, {
        method: 'POST',
        headers: {
          // [PERBAIKAN 2] Gunakan Service Role Key di sini
          'Authorization': `Bearer ${supabaseServiceRoleKey}`, 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: message.title,
          body: message.body,
          topic: "stock_alerts",
          data: { product_id: String(record.id), status: "CRITICAL" }
        })
      })

      // Cek apakah request berhasil
      if (!pushResponse.ok) {
        const errText = await pushResponse.text()
        console.error(`❌ Gagal memanggil Push Service: ${pushResponse.status} - ${errText}`)
      } else {
        const pushResult = await pushResponse.json()
        console.log("👉 Handed over to Push Service:", pushResult)
      }
    }

    return new Response(JSON.stringify({ message: "Analysis Done" }), { headers: { "Content-Type": "application/json" } })

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
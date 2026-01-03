import { serve } from "std/http/server.ts"
import { FirebaseService, ServiceAccount } from "./firebase-service.ts"

console.log("Push Service Ready")

serve(async (req) => {
  try {
    const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!serviceAccountStr) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT')

    // 1. Get 'analyze-stock-health'
    const { title, body, topic, data } = await req.json()

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "Title and Body required" }), { status: 400, headers: { "Content-Type": "application/json" } })
    }

    // 2. post ke Firebase
    const saJson = JSON.parse(serviceAccountStr) as ServiceAccount
    const firebase = new FirebaseService(saJson)
    
    // Fallback
    const targetTopic = topic || "stock_alerts"
    
    const result = await firebase.send(targetTopic, title, body, data)
    console.log("Notification Sent:", result)

    return new Response(JSON.stringify({ success: true, fcm_response: result }), { 
      headers: { "Content-Type": "application/json" } 
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
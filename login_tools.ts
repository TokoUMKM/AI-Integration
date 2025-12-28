import { createClient } from "@supabase/supabase-js"

// Ambil config dari .env (pastikan Anda menjalankan dengan flag --env-file)
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Pakai Service Role biar bisa akses Auth bebas

const supabase = createClient(supabaseUrl, supabaseKey)

// GANTI EMAIL/PASSWORD SESUAI YANG ANDA BUAT DI DASHBOARD TADI
const email = "admin@restock.com" 
const password = "password123" 

console.log(`Mencoba login sebagai: ${email}...`)

const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
})

if (error) {
  console.error("❌ LOGIN GAGAL:", error.message)
} else {
  console.log("\n✅ LOGIN SUKSES! Ini Token Anda (Copy semua teks di antara tanda kutip):")
  console.log("---------------------------------------------------")
  console.log(data.session.access_token)
  console.log("---------------------------------------------------")
}
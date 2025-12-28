# ⚡ Restock Backend

> **Stack:** Supabase Edge Functions (Deno) + Google Gemini 2.5 Flash
> **Status:** Production Ready
> **Documentation:** [Scalar API Reference](./openapi.yaml)

Backend ini adalah "Otak Cerdas" aplikasi. Mengelola OCR struk, analisa stok otomatis, dan asisten pembuat pesan WA menggunakan AI.

## 🛠️ Prerequisites
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Deno Runtime](https://deno.com/) (v1.40+)

## 📡 API Endpoints (Actual Implementation)

Base URL: `https://https://dutzgkygmvwmpqgddddn.supabase.co/functions/v1`

### 1. Scan Struk (`POST /parse-receipt`)
Mengekstrak item belanja dari foto struk fisik menjadi JSON.
- **Header:** `Content-Type: multipart/form-data`
- **Body:** `file` (Binary Image, Max 4MB)
- **Response Structure:**
  ```json
  {
    "success": true,
    "data": {
      "supplier_name": "Toko Makmur",
      "transaction_date": "2024-01-25",
      "items": [
        { "name": "Beras", "qty": 1, "price": 50000 }
      ],
      "summary_text": "Pembelian 1 item di Toko Makmur..."
    }
  }
(Note: Berbeda dari Blueprint awal. Field confidence_score dihapus untuk efisiensi token AI).

2. Analisa Stok (POST /analyze-stock-health)
Agent cerdas yang mengecek database user dan berteriak jika stok kritis.

Header: Authorization: Bearer [USER_TOKEN]

Body: {} (Kosong)

Response Structure:

```JSON

{
  "status": "WARNING",
  "agent_message": "Gawat Bos! Minyak Goreng tinggal 2!",
  "alerts": [
    { "name": "Minyak Goreng", "sisa": 2, "habis_dalam": 1 }
  ]
}
```
(Note: Menggunakan Edge Function, bukan RPC call).

3. Buat Pesan WA (POST /generate-order-text)
Membuat draft chat WhatsApp ke supplier.

Header: Content-Type: application/json

Body:

```JSON

{
  "supplier_name": "Ko Budi",
  "items": [{ "name": "Beras", "qty": "50kg" }]
}
Response: { "message": "Halo Ko Budi..." }

```

💻 Deployment
```Bash
supabase functions deploy parse-receipt --no-verify-jwt
supabase functions deploy analyze-stock-health
supabase functions deploy generate-order-text
```

API Contract 

https://registry.scalar.com/@default-team-vn4v7/apis/restock-ai-api/latest


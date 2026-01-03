
# ⚡ Restock Backend (Microservices)

> **Stack:** Supabase Edge Functions (Deno) + Google Gemini 2.5 Flash + Firebase FCM + LLama 4.0 Scout (OCR)
> **Architecture:** Event-Driven Microservices
> **Status:** Production Ready
> **Documentation:** [Scalar API Reference](https://registry.scalar.com/@default-team-vn4v7/apis/restock-ai-api/latest)

Backend ini bertindak sebagai "Otak Cerdas" aplikasi. Kini menggunakan arsitektur **Microservices** untuk memisahkan logika Analisa AI dan Pengiriman Notifikasi demi performa dan skalabilitas yang lebih baik.

## 🏗️ Architecture Flow

Sistem notifikasi stok berjalan secara otomatis menggunakan Database Webhooks:

1.  **Database Update:** Stok di tabel `products` berubah.
2.  **Webhook Trigger:** Memanggil fungsi `analyze-stock-health`.
3.  **AI Analysis:** Gemini mengecek stok & rata-rata penjualan (`avg_daily_sales`) untuk memprediksi kapan barang habis.
4.  **Inter-Service Call:** Jika kritis, fungsi Analyze memanggil `push-notification`.
5.  **Delivery:** FCM mengirim notifikasi ke HP User.

## 🛠️ Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Deno Runtime](https://deno.com/) (v1.40+)
- Firebase Project (untuk Service Account FCM)

## 🔐 Environment Variables (Secrets)

Sebelum deploy, pastikan secrets berikut sudah di-set di Dashboard Supabase:

| Secret Key | Description |
| :--- | :--- |
| `GOOGLE_API_KEY` | API Key untuk Google Gemini AI. |
| `FIREBASE_SERVICE_ACCOUNT` | JSON Service Account Firebase (Minified/One-line). |
| `MY_SERVICE_ROLE_KEY` | **PENTING:** Service Role Key Supabase untuk komunikasi antar fungsi (bypassing RLS/Auth). |

## 📡 API Endpoints

**Base URL:** `https://dutzgkygmvwmpqgddddn.supabase.co/functions/v1`

### 1. Scan Struk (`POST /parse-receipt`)
Mengekstrak item belanja dari foto struk fisik menjadi JSON terstruktur.

-   **Header:** `Content-Type: multipart/form-data`
-   **Body:** `file` (Binary Image, Max 4MB)
-   **Response:**
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
    ```

### 2. Analisa Stok (`POST /analyze-stock-health`)
**[Triggered by Webhook]**
Fungsi analisis cerdas. Mengecek stok, menghitung *burn rate* (kecepatan penjualan), dan menggunakan AI untuk membuat pesan peringatan yang personal.

-   **Header:** `Authorization: Bearer [ANON_KEY]` (Dipanggil oleh Supabase Hook)
-   **Body:** Payload Webhook Database (Record `products`).
-   **Logic:**
    -   Jika `current_stock > min_stock` -> Skip.
    -   Jika `current_stock <= min_stock` -> Hitung prediksi habis berdasarkan `avg_daily_sales` -> Panggil `push-notification`.

### 3. Push Notification (`POST /push-notification`)
**[Internal Service]**
Fungsi "Kurir" yang bertugas khusus menangani otentikasi ke Google FCM dan mengirim pesan.

-   **Header:** `Authorization: Bearer [MY_SERVICE_ROLE_KEY]`
-   **Body:**
    ```json
    {
      "topic": "stock_alerts",
      "title": "Gawat Bos! Telur Menipis",
      "body": "Stok sisa 10 butir. Dengan penjualan rata-rata 5/hari, besok lusa habis!",
      "data": { "product_id": "123", "status": "CRITICAL" }
    }
    ```

### 4. Buat Pesan WA (`POST /generate-order-text`)
Membuat draft chat WhatsApp profesional ke supplier berdasarkan list item.

-   **Header:** `Content-Type: application/json`
-   **Body:**
    ```json
    {
      "supplier_name": "Ko Budi",
      "items": [{ "name": "Beras", "qty": "50kg" }]
    }
    ```
-   **Response:**
    ```json
    { "message": "Halo Ko Budi, saya mau order Beras 50kg. Mohon info ketersediaannya ya. Terima kasih." }
    ```

## 💻 Deployment Commands

Karena menggunakan microservices dan custom secrets, gunakan perintah berikut:

```bash
# 1. Deploy OCR Service (Public access ok)
supabase functions deploy parse-receipt --no-verify-jwt

# 2. Deploy AI Analyzer (Webhook triggered)
supabase functions deploy analyze-stock-health

# 3. Deploy Push Service (Internal access only via Service Role)
supabase functions deploy push-notification

```

## 🔗 API Contract & Spec

Untuk detail skema Request/Response lengkap, silakan cek dokumentasi interaktif:
👉 **[Scalar API Reference](https://registry.scalar.com/@default-team-vn4v7/apis/restock-ai-api/latest)**

```
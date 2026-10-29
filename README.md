# Smart POS & Customer Ledger Calculator (Full-Stack Deployment Package)

A full-stack Point-of-Sale (POS) Calculator and Customer Ledger (Khata) web application with custom **Shop Name receipts**, **UPI / Cash / Card** payment modes, **Credit (+) / Debit (−)** recording, multi-page navigation (**POS Calculator** vs. **Collections & Customer History**), and 4 switchable themes.

## Project Structure

```text
smart-pos-ledger-fullstack/
├── public/
│   ├── index.html          # Multi-page POS & Ledger Frontend UI
│   ├── styles.css          # 4-Theme CSS Variables (Minimalist, Midnight, Retro Casio, Cyber Neon)
│   └── app.js              # Frontend Logic + REST API Sync & Offline LocalStorage Fallback
├── data/
│   └── seed_db.json        # Initial sample transactions & default shop settings
├── db.js                   # Atomic JSON persistence layer (zero native build dependencies)
├── server.js               # Node.js + Express REST API & Static File Server
├── package.json            # Dependencies & start scripts
├── .env.example            # Environment variable template
├── Dockerfile              # Production Docker image definition
├── docker-compose.yml      # One-command Docker Compose deployment with persistent volume
├── render.yaml             # 1-Click Render.com deployment blueprint
└── vercel.json             # Vercel serverless deployment config
```

## 1. Run Locally (Node.js)

1. Unzip the project folder and open a terminal inside it:
   ```bash
   npm install
   npm start
   ```
2. Open `http://localhost:3000` in your browser.

## 2. REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check status |
| `GET` | `/api/settings` | Get saved `shopName` and active `theme` |
| `PUT` | `/api/settings` | Update `shopName` and `theme` |
| `GET` | `/api/transactions` | Fetch transactions (supports `?type=`, `?paymentMode=`, `?search=`) |
| `POST` | `/api/transactions` | Record a new Credit or Debit transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction by ID |
| `DELETE` | `/api/transactions` | Clear all transactions (or `?restoreSample=true`) |
| `GET` | `/api/summary` | Get Total Collection, UPI/Cash/Card breakdown, Credit, Debit, and Net Balance |

## 3. Deploy to the Web

### Option A: Render.com / Railway.app (Recommended for Full-Stack Node.js)
1. Push this folder to a GitHub repository.
2. On **Render.com**, click **New + → Web Service** (or **Blueprint** to auto-detect `render.yaml`).
3. Set Build Command to `npm install` and Start Command to `npm start`.

### Option B: Docker / VPS Deployment
```bash
docker compose up -d --build
```
The app will be live on port `3000` with persistent storage mounted to the `pos_ledger_data` Docker volume.

### Option C: Static Hosting (Netlify / GitHub Pages / Cloudflare Pages)
Because `public/app.js` automatically falls back to `localStorage` when `/api` is unreachable, you can also drag-and-drop the `public/` folder directly onto **Netlify Drop** or **Cloudflare Pages** for instant zero-server static hosting.

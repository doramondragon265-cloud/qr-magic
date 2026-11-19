# QR Magic

A responsive QR generator and scanner for images, phone numbers, documents and text.

## Requirements
- Node.js 18 or newer
- npm
- A modern browser

## Run locally
1. Extract the ZIP.
2. Open a terminal in the `qr-magic` folder.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the website:
   ```bash
   npm start
   ```
5. Open http://localhost:3000

The camera scanner works on `localhost`. On a deployed website, camera access requires HTTPS.

## Features
- Image uploads: JPG, PNG, WEBP, GIF
- Documents: PDF, TXT, DOC, DOCX
- Phone numbers and text
- QR image download and link copy
- Camera scanner and QR-image scanner
- Random 256-bit unguessable sharing tokens
- 10 MB upload limit
- Basic request rate limits and security headers

## Important privacy and deployment notes
- This is a starter project, not a hardened document vault. A QR/link is a bearer secret: anyone who gets it can view the shared item.
- Do not upload identity documents, financial records, passwords, or other highly sensitive information.
- Files and metadata are stored on the server in `data/`. Back up this folder if you need to preserve items.
- The starter uses a local JSON file as its database. For multiple server instances or production scale, replace it with a database and private object storage.
- Add HTTPS before public deployment. Set `PUBLIC_BASE_URL` to your public HTTPS origin so generated QR codes use the correct address.
- Keep `data/` outside the public web directory and never expose it as static content.
- Set upload limits, backups, retention/deletion rules, monitoring, and stronger abuse controls before allowing public use.
- The scanner library is loaded from unpkg.com, so the scanner needs internet access. You can self-host the library for offline use.
- Uploaded documents are served as inline only for PDF and images; other document types are downloaded.

## Deploying
Deploy the app to a Node.js host that supports persistent disk storage. Set:
- `PORT` (usually supplied by the host)
- `PUBLIC_BASE_URL=https://your-domain.example`

If the host has an ephemeral filesystem, uploaded files may disappear after restarts. Use persistent storage or a private object-storage service.

## Project structure
- `server.js` — Express backend and upload/API routes
- `public/index.html` — main interface
- `public/app.js` — upload, QR generation display and scanner
- `public/view.html` / `public/view.js` — private shared-item page
- `public/styles.css` — responsive styling
- `data/uploads/` — uploaded files (created/used by server)
- `data/items.json` — item metadata (created automatically)

## Troubleshooting
- Camera not working: allow camera permission and use `localhost` or an HTTPS deployment.
- QR link opens a 404: make sure the server is still running and that `data/items.json` and `data/uploads/` have not been deleted.
- Scanner script not loading: check your internet connection or host `html5-qrcode` locally.

(() => {
  const token = location.pathname.split("/").filter(Boolean).pop();
  const root = document.getElementById("shared-content");
  const safe = (s) => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  fetch(`/api/items/${encodeURIComponent(token)}`, { cache: "no-store" })
    .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "This link is unavailable."); return d; })
    .then(item => {
      let body = "";
      if (item.type === "image") body = `<img class="shared-image" src="/api/items/${encodeURIComponent(token)}/file" alt="${safe(item.title)}">`;
      else if (item.type === "document") body = `<div class="document-card"><span class="document-icon">▤</span><div><strong>${safe(item.originalName || "Document")}</strong><small>Document file</small></div><a class="primary-btn small" href="/api/items/${encodeURIComponent(token)}/file">Download / Open</a></div>`;
      else if (item.type === "phone") body = `<div class="shared-text phone-text">${safe(item.text)}</div><a class="primary-btn small call-btn" href="tel:${encodeURIComponent(item.text.replace(/[^\d+]/g, ""))}">Call this number</a>`;
      else body = `<div class="shared-text">${safe(item.text).replace(/\n/g, "<br>")}</div>`;
      root.innerHTML = `<h1>${safe(item.title)}</h1><p class="shared-date">Shared using QR Magic</p>${body}`;
    })
    .catch(err => { root.innerHTML = `<div class="error-box"><h2>Link unavailable</h2><p>${safe(err.message)}</p><p>Check that the QR link is complete and try again.</p></div>`; });
})();

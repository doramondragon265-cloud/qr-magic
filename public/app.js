(() => {
  const $ = id => document.getElementById(id);
  let currentType = "image";
  let selectedFile = null;
  let scanner = null;

  const types = {
    image: { file: true, accept: "image/jpeg,image/png,image/webp,image/gif", label: "Choose an image", hint: "JPG, PNG, WEBP or GIF · Max 10 MB" },
    document: { file: true, accept: ".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Choose a document", hint: "PDF, TXT, DOC or DOCX · Max 10 MB" },
    phone: { file: false, label: "Phone number", placeholder: "+91 98765 43210", hint: "Include country code if needed." },
    text: { file: false, label: "Your text", placeholder: "Enter the information you want to share...", hint: "Up to 10,000 characters." }
  };

  document.querySelectorAll(".type-card").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".type-card").forEach(b => b.classList.toggle("active", b === btn));
    currentType = btn.dataset.type;
    $("type").value = currentType;
    const config = types[currentType];
    $("file-field").classList.toggle("hidden", !config.file);
    $("text-field").classList.toggle("hidden", config.file);
    if (config.file) {
      $("file").accept = config.accept;
      $("file-field").querySelector("label[for=file]").textContent = config.label;
      $("file-hint").textContent = config.hint;
    } else {
      $("text-label").textContent = config.label;
      $("content").placeholder = config.placeholder;
      $("text-hint").textContent = config.hint;
      $("content").inputMode = currentType === "phone" ? "tel" : "text";
    }
    selectedFile = null;
    $("file").value = "";
    $("file-name").textContent = "";
    $("create-status").textContent = "";
  }));

  $("file").addEventListener("change", e => {
    selectedFile = e.target.files[0] || null;
    $("file-name").textContent = selectedFile ? selectedFile.name : "";
  });

  $("create-form").addEventListener("submit", async e => {
    e.preventDefault();
    const status = $("create-status");
    const button = $("generate");
    if (["image", "document"].includes(currentType) && !selectedFile) {
      status.textContent = "Please choose a file first."; status.className = "status error"; return;
    }
    if (selectedFile && selectedFile.size > 10 * 1024 * 1024) {
      status.textContent = "File is too large. Maximum size is 10 MB."; status.className = "status error"; return;
    }
    const data = new FormData();
    data.append("type", currentType);
    data.append("title", $("title").value);
    if (selectedFile) data.append("file", selectedFile);
    else data.append("text", $("content").value);
    button.disabled = true; button.textContent = "Creating your QR code…";
    status.textContent = "Uploading securely to this website…"; status.className = "status";
    try {
      const response = await fetch("/api/items", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create QR code.");
      $("empty-result").classList.add("hidden");
      $("result").classList.remove("hidden");
      $("qr-image").src = result.qr;
      $("result-title").textContent = result.title;
      $("share-link").href = result.url;
      $("share-link").textContent = result.url;
      $("download-qr").onclick = () => {
        const a = document.createElement("a"); a.href = result.qr; a.download = "qr-magic-code.png"; a.click();
      };
      $("copy-link").onclick = async () => {
        try { await navigator.clipboard.writeText(result.url); $("copy-link").textContent = "Copied!"; }
        catch { $("copy-link").textContent = "Copy not available"; }
        setTimeout(() => $("copy-link").textContent = "Copy link", 1800);
      };
      status.textContent = "Your QR code is ready!"; status.className = "status success";
      $("result-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      status.textContent = err.message; status.className = "status error";
    } finally {
      button.disabled = false; button.innerHTML = 'Generate QR code <span>→</span>';
    }
  });

  function openScannedUrl(decoded) {
    let url;
    try { url = new URL(decoded); } catch { $("scan-status").textContent = "This QR code does not contain a valid web link."; return; }
    if (url.origin !== location.origin) {
      $("scan-status").textContent = "This QR code points to another website: " + url.href;
      const a = document.createElement("a"); a.href = url.href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = "Open scanned link"; a.className = "primary-btn small"; $("scan-status").appendChild(a); return;
    }
    location.href = url.href;
  }

  $("start-scan").addEventListener("click", async () => {
    const reader = $("reader");
    if (!window.Html5Qrcode) { $("scan-status").textContent = "Scanner library did not load. Check your internet connection and reload."; return; }
    reader.classList.remove("hidden");
    try {
      if (!scanner) scanner = new Html5Qrcode("reader");
      $("start-scan").disabled = true;
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 230, height: 230 } }, decoded => {
        scanner.stop().catch(() => {});
        $("start-scan").disabled = false;
        openScannedUrl(decoded);
      });
      $("scan-status").textContent = "Camera is active. Point it at a QR code.";
    } catch (err) {
      $("start-scan").disabled = false;
      $("scan-status").textContent = "Could not start camera. Allow camera permission and use HTTPS (or localhost).";
    }
  });

  $("scan-file").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    if (!window.Html5Qrcode) { $("scan-status").textContent = "Scanner library did not load. Check your internet connection."; return; }
    try {
      if (!scanner) scanner = new Html5Qrcode("reader");
      const decoded = await scanner.scanFile(file, true);
      openScannedUrl(decoded);
    } catch { $("scan-status").textContent = "No QR code found in that image. Try a clearer picture."; }
    e.target.value = "";
  });
})();

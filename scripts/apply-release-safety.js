const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "www", "index.html");
const commercePath = path.join(root, "www", "phase1-commerce.js");
const paywallPath = path.join(root, "www", "phase5-paywall.js");

for (const [file, label] of [[indexPath, "www/index.html"], [commercePath, "www/phase1-commerce.js"], [paywallPath, "www/phase5-paywall.js"]]) {
  if (!fs.existsSync(file)) throw new Error(`Missing generated ${label} for release safety pass.`);
}
let html = fs.readFileSync(indexPath, "utf8");
let commerce = fs.readFileSync(commercePath, "utf8");
let paywall = fs.readFileSync(paywallPath, "utf8");

for (const line of [
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n',
  '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n',
]) {
  html = html.replace(line, "");
}

const wellnessReplacements = new Map([
  ["Heart rate and blood pressure typically begin settling toward normal.", "Some people notice heart rate and blood pressure beginning to settle toward their usual range."],
  ["Nicotine levels in your body have dropped sharply. Cravings get loud here — that's withdrawal, and it's temporary.", "Nicotine levels have fallen substantially. Cravings may feel louder during early withdrawal, and experiences vary."],
  ["Nicotine is essentially out of your system. Cravings usually peak around now, then start easing.", "For many nicotine users, most nicotine has left the body by this point. Cravings can still be intense before easing."],
  ["For many people, cravings become shorter and less frequent. The hardest stretch is behind you.", "Some people notice cravings becoming shorter or less frequent after the first week."],
  ["Circulation and lung function are commonly improving. Stairs feel a little different.", "Circulation and breathing may begin to feel different over the following weeks."],
  ["Many people report clearer breathing, better taste and smell, and fewer coughing fits.", "Some people report easier breathing and changes in taste, smell, or coughing over the first month."],
  ["Dopamine signaling is rebalancing. Day-to-day life without nicotine starts feeling normal.", "Habit cues and reward patterns can keep adjusting over the first several months."],
  ["Most people who make it here report cravings are rare and manageable.", "Many people report that cravings become less frequent and easier to manage over time."],
  ["Crystal clear in here. Your doing.", "Crystal clear in here. You’re doing it."],
]);
for (const [before, after] of wellnessReplacements) {
  if (!html.includes(before)) throw new Error(`Release wellness copy marker changed: ${before}`);
  html = html.replace(before, after);
}

const paywallReplacements = new Map([
  ["Know the hard moment before it arrives — and what to do next.", "Spot the times cravings may be more likely — and what to do next."],
  ["Know when cravings are most likely to hit.", "See when cravings may be more likely."],
]);
for (const [before, after] of paywallReplacements) {
  if (!paywall.includes(before)) throw new Error(`Release paywall copy marker changed: ${before}`);
  paywall = paywall.replace(before, after);
}

const eraseBefore = `    onConfirm: () => {
     localStorage.removeItem(CONFIG.storageKey);
     location.reload();
     },`;
const eraseAfter = `    onConfirm: async () => {
       try { await window.Capacitor?.Plugins?.GilliePurchases?.clearDiagnostics?.(); } catch (_) {}
       try { localStorage.clear(); } catch (_) {}
       location.reload();
     },`;
if (!html.includes(eraseBefore)) throw new Error("Erase Everything marker changed; refusing to ship without native diagnostic deletion.");
html = html.replace(eraseBefore, eraseAfter);

const recoveryBefore = `    panel.querySelector("#gillie-reset-startup").onclick = () => {
       if (!confirm("Start fresh? This permanently deletes Gillie progress stored on this device.")) return;
       try { localStorage.removeItem("gillie_v1"); } catch (_) {}
       location.reload();
     };`;
const recoveryAfter = `    panel.querySelector("#gillie-reset-startup").onclick = async () => {
       if (!confirm("Start fresh? This permanently deletes Gillie progress and local diagnostics stored on this device.")) return;
       try { await window.Capacitor?.Plugins?.GilliePurchases?.clearDiagnostics?.(); } catch (_) {}
       try { localStorage.clear(); } catch (_) {}
       location.reload();
     };`;
if (!commerce.includes(recoveryBefore)) throw new Error("Startup recovery reset marker changed; refusing to ship with partial local deletion.");
commerce = commerce.replace(recoveryBefore, recoveryAfter);

for (const forbidden of ["fonts.googleapis.com", "fonts.gstatic.com", "Dopamine signaling is rebalancing", "localStorage.removeItem(CONFIG.storageKey)"]) {
  if (html.includes(forbidden)) throw new Error(`Generated native bundle still contains forbidden release marker: ${forbidden}`);
}
for (const forbidden of ["Know the hard moment before it arrives", "Know when cravings are most likely to hit"]) {
  if (paywall.includes(forbidden)) throw new Error(`Generated paywall still contains an overly certain wellness claim: ${forbidden}`);
}
if (commerce.includes('localStorage.removeItem("gillie_v1")')) throw new Error("Startup recovery still performs a partial reset.");
for (const required of ["clearDiagnostics", "localStorage.clear()", "experiences vary", "general wellness information, not medical advice"]) {
  if (!html.includes(required)) throw new Error(`Generated native bundle is missing release marker: ${required}`);
}
for (const required of ["clearDiagnostics", "localStorage.clear()", "local diagnostics stored on this device"]) {
  if (!commerce.includes(required)) throw new Error(`Generated startup recovery is missing release marker: ${required}`);
}
for (const required of ["Spot the times cravings may be more likely", "See when cravings may be more likely"]) {
  if (!paywall.includes(required)) throw new Error(`Generated paywall is missing safer launch copy: ${required}`);
}

fs.writeFileSync(indexPath, html, "utf8");
fs.writeFileSync(commercePath, commerce, "utf8");
fs.writeFileSync(paywallPath, paywall, "utf8");
console.log("Applied release safety pass: no remote fonts, softer wellness and paywall copy, and complete local diagnostic erase.");

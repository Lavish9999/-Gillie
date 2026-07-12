const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "www", "index.html");

if (!fs.existsSync(indexPath)) throw new Error("Missing generated www/index.html for release safety pass.");
let html = fs.readFileSync(indexPath, "utf8");

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

for (const forbidden of ["fonts.googleapis.com", "fonts.gstatic.com", "Dopamine signaling is rebalancing", "localStorage.removeItem(CONFIG.storageKey)"]) {
  if (html.includes(forbidden)) throw new Error(`Generated native bundle still contains forbidden release marker: ${forbidden}`);
}
for (const required of ["clearDiagnostics", "localStorage.clear()", "experiences vary", "general wellness information, not medical advice"]) {
  if (!html.includes(required)) throw new Error(`Generated native bundle is missing release marker: ${required}`);
}

fs.writeFileSync(indexPath, html, "utf8");
console.log("Applied release safety pass: no remote fonts, softer wellness copy, and complete local diagnostic erase.");

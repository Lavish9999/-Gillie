const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");
const entries = ["index.html", "manifest.webmanifest", "privacy.html", "support.html", "assets"];
const plusPaywallPatch = path.join(root, "scripts", "gillie-plus-paywall.patch");

const pricingReplacements = [
  ["monthlyLabel: \"$4.99 / month\"", "monthlyLabel: \"$3.99 / month\""],
  ["yearlyLabel: \"$39.99 / year — best value\"", "yearlyLabel: \"$29.99 / year — best value\""],
  ["$4.99 / month", "$3.99 / month"],
  ["$39.99 / year", "$29.99 / year"],
  ["$4.99/mo", "$3.99/mo"],
  ["$39.99/yr", "$29.99/yr"],
];

const appBehaviorReplacements = [
  [
    "position:fixed;top:calc(14px + env(safe-area-inset-top));left:50%;transform:translateX(-50%) translateY(-140%);",
    "position:fixed;top:calc(52px + env(safe-area-inset-top));left:50%;transform:translateX(-50%) translateY(-160%);",
  ],
  [
    "transition:transform .45s cubic-bezier(.2,.9,.3,1);display:flex;gap:12px;align-items:center;",
    "opacity:0;pointer-events:none;\n  transition:transform .35s cubic-bezier(.2,.9,.3,1), opacity .25s ease;display:flex;gap:12px;align-items:center;",
  ],
  [
    "#toast.show{transform:translateX(-50%) translateY(0)}",
    "#toast.show{transform:translateX(-50%) translateY(0);opacity:1}",
  ],
  [
    "toastHandle = setTimeout(() => $(\"#toast\").classList.remove(\"show\"), 3800);",
    "toastHandle = setTimeout(() => $(\"#toast\").classList.remove(\"show\"), 2800);",
  ],
  [
    '<meta name="theme-color" content="#075E5A">',
    '<meta name="theme-color" content="#E8F2EF">',
  ],
  [
    "html{height:100%}",
    "html{height:100%;background:var(--bg)}",
  ],
  [
    "  enterMain();\n  toast(\"🐣\", `${state.petName} hatched. Your quit is officially live.`);\n};",
    "  enterMain();\n};",
  ],
  [
    "  document.body.classList.toggle(\"sheet-open\", anyOpen);\n}",
    "  document.body.classList.toggle(\"sheet-open\", anyOpen);\n  if (anyOpen) dismissToast();\n}",
  ],
  [
    "let toastHandle = null;\nfunction toast(em, msg) {",
    "let toastHandle = null;\nfunction dismissToast() {\n  clearTimeout(toastHandle);\n  $(\"#toast\").classList.remove(\"show\");\n}\nfunction toast(em, msg) {",
  ],
  [
    "function toast(em, msg) {\n  $(\"#toast .em\").textContent = em;",
    "function toast(em, msg) {\n  if (!state.onboarded || document.body.classList.contains(\"sheet-open\")) return;\n  $(\"#toast .em\").textContent = em;",
  ],
  [
    "$(\"#plus-soft-close\").onclick = () => closeSheetOverlay($(\"#plus-overlay\"), true);",
    "$(\"#plus-soft-close\").onclick = (e) => {\n  e.stopPropagation();\n  closeSheetOverlay($(\"#plus-overlay\"), true);\n};",
  ],
  [
    "return (onPlusTop || (nearTop && !interactive)) && sheet.scrollTop <= 1;",
    "return !interactive && (onPlusTop || nearTop) && sheet.scrollTop <= 1;",
  ],
  [
    "async function requestPlusPurchase(productId) {\n  const bridge = purchaseBridge();\n  if (!bridge?.purchase) {\n    toast(\"👑\", \"Gillie Plus purchases connect in the iOS App Store build.\");\n    return;\n  }\n  try {\n    const result = await bridge.purchase({ productId });\n    if (applyEntitlementStatus(result)) {\n      $(\"#plus-overlay\").hidden = true;\n      toast(\"👑\", \"Gillie Plus active. Your Coach plan is unlocked.\");\n    } else {\n      toast(\"👑\", \"Gillie Plus is not active yet.\");\n    }\n  } catch (e) {\n    toast(\"👑\", \"Purchase was not completed.\");\n  }\n}",
    "async function requestPlusPurchase(productId) {\n  const legal = $(\"#plus-legal\");\n  const selectedPlan = Object.values(CONFIG.plus.products).find((plan) => plan.id === productId);\n  const bridge = purchaseBridge();\n  legal.textContent = `Opening Apple purchase sheet for ${selectedPlan?.name || \"Gillie Plus\"}...`;\n  if (!bridge?.purchase) {\n    legal.textContent = \"Purchases are not connected in this build yet. Install the newest TestFlight build and try again.\";\n    return;\n  }\n  try {\n    const result = await bridge.purchase({ productId });\n    if (applyEntitlementStatus(result)) {\n      legal.textContent = \"Gillie Plus is active.\";\n      $(\"#plus-overlay\").hidden = true;\n      toast(\"👑\", \"Gillie Plus active. Your Coach plan is unlocked.\");\n    } else if (result?.pending) {\n      legal.textContent = \"Purchase is pending with Apple. Gillie will unlock after Apple approves it.\";\n    } else {\n      legal.textContent = \"Apple returned without an active Gillie Plus subscription. Try Restore Purchase or try again.\";\n    }\n  } catch (e) {\n    const message = e?.message || \"Purchase was not completed.\";\n    legal.textContent = message.includes(\"cancel\") ? \"Purchase cancelled.\" : message;\n  }\n}",
  ],
  [
    "async function restorePlusPurchase() {\n  const bridge = purchaseBridge();\n  if (!bridge?.restorePurchases) {\n    toast(\"👑\", \"Restore purchases is available in the iOS App Store build.\");\n    return;\n  }\n  try {\n    const result = await bridge.restorePurchases();\n    if (applyEntitlementStatus(result)) {\n      $(\"#plus-overlay\").hidden = true;\n      toast(\"👑\", \"Gillie Plus restored.\");\n    } else {\n      toast(\"👑\", \"No active Gillie Plus purchase found.\");\n    }\n  } catch (e) {\n    toast(\"👑\", \"Could not restore purchases right now.\");\n  }\n}",
    "async function restorePlusPurchase() {\n  const legal = $(\"#plus-legal\");\n  const bridge = purchaseBridge();\n  legal.textContent = \"Checking Apple purchases...\";\n  if (!bridge?.restorePurchases) {\n    legal.textContent = \"Restore is not connected in this build yet. Install the newest TestFlight build and try again.\";\n    return;\n  }\n  try {\n    const result = await bridge.restorePurchases();\n    if (applyEntitlementStatus(result)) {\n      legal.textContent = \"Gillie Plus restored.\";\n      $(\"#plus-overlay\").hidden = true;\n      toast(\"👑\", \"Gillie Plus restored.\");\n    } else {\n      legal.textContent = \"No active Gillie Plus purchase was found for this Apple ID.\";\n    }\n  } catch (e) {\n    legal.textContent = e?.message || \"Could not restore purchases right now.\";\n  }\n}",
  ],
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function applyBuildPatches(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const [from, to] of [...pricingReplacements, ...appBehaviorReplacements]) {
    if (html.includes(from)) {
      html = html.split(from).join(to);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, html, "utf8");
    console.log(`Applied Gillie build patches to ${path.relative(root, filePath) || "index.html"}`);
  }
}

// Keep the source preview and native copy aligned when this prep step runs.
if (fs.existsSync(plusPaywallPatch) && fs.existsSync(path.join(root, "index.html"))) {
  const sourceHTML = fs.readFileSync(path.join(root, "index.html"), "utf8");
  if (!sourceHTML.includes("plus-tank-hero")) {
    execFileSync("git", ["apply", "--whitespace=nowarn", plusPaywallPatch], { cwd: root, stdio: "inherit" });
    console.log("Applied Gillie Plus paywall patch to index.html");
  }
}
applyBuildPatches(path.join(root, "index.html"));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const entry of entries) {
  const src = path.join(root, entry);
  if (fs.existsSync(src)) copyRecursive(src, path.join(out, entry));
}

applyBuildPatches(path.join(out, "index.html"));

console.log("Prepared Capacitor web assets in www/");

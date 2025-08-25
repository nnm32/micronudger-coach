/* micronudger-coach: password-lock, local memory, guardrails, time-aware greetings */
const STORAGE_KEY = "mn_data_v1";
const SESSION_KEY = "mn_unlocked";

const defaultData = {
  profile: { name: null, tzOffsetMin: null, nudgeTime: null },
  pref: { passHash: null },
  history: []
};

const EL = {
  transcript: document.getElementById("transcript"),
  input: document.getElementById("userInput"),
  send: document.getElementById("sendBtn"),
  banner: document.getElementById("banner"),
  gate: document.getElementById("gate"),
  gateTitle: document.getElementById("gateTitle"),
  gateDesc: document.getElementById("gateDesc"),
  pw: document.getElementById("pw"),
  pw2: document.getElementById("pw2"),
  unlockBtn: document.getElementById("unlockBtn"),
  onboard: document.getElementById("onboard"),
  who: document.getElementById("who"),
  nudgetime: document.getElementById("nudgetime"),
  tzoffset: document.getElementById("tzoffset"),
  saveOnboardBtn: document.getElementById("saveOnboardBtn"),
  settings: document.getElementById("settings"),
  s_name: document.getElementById("s_name"),
  s_time: document.getElementById("s_time"),
  s_tz: document.getElementById("s_tz"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  btnWipe: document.getElementById("btnWipe"),
  btnLock: document.getElementById("btnLock"),
  btnSettings: document.getElementById("btnSettings")
};

function loadData(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(defaultData); }
  catch(err){ return structuredClone(defaultData); }
}
function saveData(d){ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
function wipeAll(){
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

btnWipe.onclick = () => { if(confirm("Wipe profile and history?")) wipeAll(); };
btnLock.onclick = () => { sessionStorage.removeItem(SESSION_KEY); showGate(); };
btnSettings.onclick = () => {
  const d = loadData();
  s_name.value = d.profile.name || "";
  s_time.value = d.profile.nudgeTime || "";
  s_tz.value = d.profile.tzOffsetMin ?? "";
  settings.style.display = "grid";
};
saveSettingsBtn.onclick = () => {
  const d = loadData();
  d.profile.name = s_name.value.trim() || null;
  d.profile.nudgeTime = s_time.value || null;
  d.profile.tzOffsetMin = s_tz.value === "" ? null : Number(s_tz.value);
  saveData(d);
  settings.style.display = "none";
  renderBanner();
  greetIfNeeded(true);
};

/* Password gate */
async function sha256(text){
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

function showGate(){
  const d = loadData();
  const hasPass = !!d.pref.passHash;
  gateTitle.textContent = hasPass ? "Unlock" : "Welcome";
  gateDesc.textContent = hasPass ? "Enter your passphrase to unlock." : "Create a passphrase to lock your coach.";
  document.getElementById("pw2label").style.display = hasPass ? "none" : "block";
  pw2.style.display = hasPass ? "none" : "block";
  unlockBtn.textContent = hasPass ? "Unlock" : "Save & Continue";
  gate.style.display = "grid";
  pw.value = ""; pw2.value = ""; pw.focus();
  unlockBtn.onclick = async () => {
    const pass = pw.value;
    if(!pass) return alert("Please enter a passphrase.");
    const passHash = await sha256(pass);
    if(hasPass){
      if(passHash === d.pref.passHash){
        sessionStorage.setItem(SESSION_KEY, "1");
        gate.style.display = "none";
        afterUnlock();
      } else alert("Incorrect passphrase.");
    } else {
      if(pw2.value !== pass) return alert("Passphrases do not match.");
      d.pref.passHash = passHash;
      saveData(d);
      sessionStorage.setItem(SESSION_KEY, "1");
      gate.style.display = "none";
      afterUnlock(true);
    }
  };
}

/* Onboarding */
function showOnboard(){
  onboard.style.display = "grid";
  saveOnboardBtn.onclick = () => {
    const name = who.value.trim();
    if(!name) return alert("Please enter your name.");
    const d = loadData();
    d.profile.name = name;
    d.profile.nudgeTime = nudgetime.value || null;
    const autoOffset = -new Date().getTimezoneOffset(); // minutes east of UTC
    d.profile.tzOffsetMin = tzoffset.value === "" ? autoOffset : Number(tzoffset.value);
    saveData(d);
    onboard.style.display = "none";
    initialGreeting();
  };
}

function renderBanner(){
  const d = loadData();
  const name = d.profile.name || "friend";
  const now = new Date();
  const tzOffset = d.profile.tzOffsetMin ?? -now.getTimezoneOffset();
  const local = new Date(now.getTime() + (tzOffset - (-now.getTimezoneOffset()))*60000);
  const hour = local.getHours();
  const tod = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const t = d.profile.nudgeTime ? ` • Daily nudge at ${d.profile.nudgeTime}` : "";
  banner.textContent = `${tod}, ${name}!${t}`;
}

/* Guardrails */
const crisisKeywords = [
  "kill myself","suicide","end my life","hurt myself","self harm","self-harm",
  "overdose","take more pills","took too many","i want to die","i don't want to live"
];
const medicalAdviceKeywords = [
  "change my dose","increase my dose","decrease my dose","stop my medication",
  "start medication","prescribe","contraindication","side effect severe","drug interaction"
];

function checkGuardrails(text){
  const t = text.toLowerCase();
  if(crisisKeywords.some(k => t.includes(k))){
    return { type: "crisis", msg:
      "I’m really glad you told me. I can’t help with crises, but you deserve support right now. Please contact your primary care clinician immediately, or for urgent help call 911. In the U.S., you can call or text 988 for the Suicide & Crisis Lifeline." };
  }
  if(medicalAdviceKeywords.some(k => t.includes(k)) || /medicat(e|ion)|dose|prescription/.test(t)){
    return { type: "medical", msg:
      "I can’t give medical advice about medications. Please talk to your primary care clinician or pharmacist for guidance tailored to you." };
  }
  return null;
}

/* Coaching (non-medical) */
const COACH = {
  topics: {
    welcome: [
      "We’ll keep things practical and kind. What’s one small win you want this week?",
      "We use SMART goals. For example: “Walk 10 minutes after dinner on Mon/Wed/Fri.” What could work for you?"
    ],
    nutrition: [
      "Try the 50/25/25 plate: half veggies, a quarter lean protein, a quarter high-fiber carbs.",
      "Keep easy wins on hand: pre-cut veggies, fruit, Greek yogurt, nuts. Convenience helps."
    ],
    movement: [
      "Aim for ‘movement snacks’: 5–10 minutes, 2–3 times per day. Walk, stretch, or climb stairs.",
      "Pair activity with cues you already do: after coffee, take a 10-minute walk."
    ],
    sleep: [
      "Protect a regular sleep window. Dim lights 60 minutes before bed, and keep devices out of bed.",
      "If you can’t sleep after ~20 minutes, get up for a calm activity and try again."
    ],
    mindset: [
      "Self-talk matters: speak to yourself like you would to a good friend—firm, kind, and specific.",
      "Set up your space for success: visible water bottle, fruit bowl, shoes by the door."
    ]
  },
  respond(name, text){
    const t = text.toLowerCase();
    if(/hello|hi|hey/.test(t)) return `Hi ${name}! What’s one small health win you’d like this week?`;
    if(/nutri|food|diet|meal|eat/.test(t)) return `${name}, here are two ideas:\n• ${this.topics.nutrition[0]}\n• ${this.topics.nutrition[1]}`;
    if(/walk|move|exercise|activity/.test(t)) return `${name}, try this:\n• ${this.topics.movement[0]}\n• ${this.topics.movement[1]}`;
    if(/sleep|insomnia|tired/.test(t)) return `${name}, sleep supports weight goals:\n• ${this.topics.sleep[0]}\n• ${this.topics.sleep[1]}`;
    if(/stress|motivat|mind|habit|goal/.test(t)) return `${name}, quick mindset nudges:\n• ${this.topics.mindset[0]}\n• ${this.topics.mindset[1]}`;
    return `${name}, I’m here to coach on habits—nutrition, movement, sleep, and mindset. What would you like to focus on?`;
  }
};

/* UI */
function addMsg(text, who="bot"){
  const wrap = document.createElement("div");
  wrap.className = `msg ${who}`;
  wrap.innerText = text;
  transcript.appendChild(wrap);
  transcript.scrollTop = transcript.scrollHeight;
}
function addYou(text){
  addMsg(text, "you");
  const d = loadData();
  d.history.push({ who:"you", text, ts: Date.now() });
  saveData(d);
}
function addBot(text){
  addMsg(text, "bot");
  const d = loadData();
  d.history.push({ who:"bot", text, ts: Date.now() });
  saveData(d);
}
function renderHistory(){
  const d = loadData();
  transcript.innerHTML = "";
  for(const m of d.history){ addMsg(m.text, m.who === "you" ? "you" : "bot"); }
}

/* Greetings */
function initialGreeting(){
  const d = loadData();
  renderBanner();
  const name = d.profile.name || "friend";
  addBot(`Hello ${name}! I’m your micronudger coach. I’ll remember our chats unless you tap Wipe. I can’t give medical advice, but I can help with small, steady habit nudges.`);
  addBot(COACH.topics.welcome[0]);
}
function greetIfNeeded(force=false){ renderBanner(); if(force) return; }

/* Main send */
sendBtn.onclick = onSend;
userInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ onSend(); }});
function onSend(){
  const txt = userInput.value.trim();
  if(!txt) return;
  userInput.value = "";
  const d = loadData();
  const name = d.profile.name || "friend";

  addYou(txt);

  const safety = checkGuardrails(txt);
  if(safety){ addBot(safety.msg); return; }

  const reply = COACH.respond(name, txt);
  addBot(reply);
}

/* Boot */
function afterUnlock(isNew=false){
  gate.style.display = "none";
  sessionStorage.setItem(SESSION_KEY, "1");
  const d = loadData();
  if(isNew || !d.profile.name){ showOnboard(); }
  else { renderHistory(); greetIfNeeded(); renderBanner(); }
}

(function init(){
  const d = loadData();
  const unlocked = sessionStorage.getItem(SESSION_KEY) === "1";
  if(!d.pref.passHash || !unlocked){ showGate(); }
  else { afterUnlock(); }
})();

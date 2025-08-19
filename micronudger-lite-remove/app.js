/* Micronudger with one-click removal ICS (METHOD:CANCEL) for last generated batch */
const STORAGE_HABITS = "micronudger_custom_habits_v3";
const STORAGE_LAST_BATCH = "micronudger_last_batch_v1"; // stores [{uid, title, desc, startISO, durationMin, tzid, repeatDaily}]

function escapeHTML(s){ return (s || "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function makeUID(){ return (Date.now().toString(36) + Math.random().toString(36).slice(2)) + "@micronudger"; }

function formatLocalRangeICS(start, end, tzid) {
  const fmt = (dt) => {
    const y = dt.getFullYear();
    const m = ('0' + (dt.getMonth()+1)).slice(-2);
    const d = ('0' + dt.getDate()).slice(-2);
    const hh = ('0' + dt.getHours()).slice(-2);
    const mm = ('0' + dt.getMinutes()).slice(-2);
    const ss = ('0' + dt.getSeconds()).slice(-2);
    return `${y}${m}${d}T${hh}${mm}${ss}`;
  };
  return `DTSTART;TZID=${tzid}:${fmt(start)}\nDTEND;TZID=${tzid}:${fmt(end)}\n`;
}

function buildICS(events, calName, tzid, addAlert15, repeatDaily) {
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\nPRODID:-//Micronudger//EN\nMETHOD:PUBLISH\n";
  ics += `X-WR-CALNAME:${calName}\nX-WR-TIMEZONE:${tzid}\n`;
  const dtstamp = new Date().toISOString().replace(/[-:]/g,"").split(".")[0] + "Z";
  const batch = [];
  events.forEach(ev => {
    const uid = makeUID();
    const start = new Date(ev.start);
    const end = new Date(start.getTime() + ev.durationMin*60000);
    ics += "BEGIN:VEVENT\n";
    ics += `UID:${uid}\nDTSTAMP:${dtstamp}\n`;
    ics += formatLocalRangeICS(start, end, tzid);
    ics += `SUMMARY:${ev.title}\nDESCRIPTION:${ev.desc}\n`;
    if (repeatDaily) ics += "RRULE:FREQ=DAILY\n";
    if (addAlert15) ics += `BEGIN:VALARM\nTRIGGER:-PT15M\nACTION:DISPLAY\nDESCRIPTION:Reminder - ${ev.title}\nEND:VALARM\n`;
    ics += "END:VEVENT\n";
    batch.push({ uid, title: ev.title, desc: ev.desc, startISO: ev.start, durationMin: ev.durationMin, tzid, repeatDaily });
  });
  ics += "END:VCALENDAR\n";
  // Save last batch for removal
  localStorage.setItem(STORAGE_LAST_BATCH, JSON.stringify(batch));
  return ics;
}

function buildRemovalICS(calName) {
  const batch = JSON.parse(localStorage.getItem(STORAGE_LAST_BATCH) || "[]");
  if (!batch.length) { alert("No recently created events found. Generate your calendar first, then you can export a removal file."); return null; }
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\nPRODID:-//Micronudger//EN\nMETHOD:CANCEL\n";
  ics += `X-WR-CALNAME:${calName} (Removal)\n`;
  const dtstamp = new Date().toISOString().replace(/[-:]/g,"").split(".")[0] + "Z";
  batch.forEach(ev => {
    const start = new Date(ev.startISO);
    const end = new Date(start.getTime() + ev.durationMin*60000);
    ics += "BEGIN:VEVENT\n";
    ics += `UID:${ev.uid}\nDTSTAMP:${dtstamp}\nSEQUENCE:2\nSTATUS:CANCELLED\n`;
    ics += formatLocalRangeICS(start, end, ev.tzid);
    ics += `SUMMARY:${ev.title}\nDESCRIPTION:${ev.desc}\n`;
    if (ev.repeatDaily) ics += "RRULE:FREQ=DAILY\n";
    ics += "END:VEVENT\n";
  });
  ics += "END:VCALENDAR\n";
  return ics;
}

/* ---- Custom habits persistence ---- */
function loadCustom(){ try{ return JSON.parse(localStorage.getItem(STORAGE_HABITS) || "[]"); }catch{return [];} }
function saveCustom(list){ localStorage.setItem(STORAGE_HABITS, JSON.stringify(list)); }
function renderCustom(){
  const ul = document.getElementById("customList"); ul.innerHTML = "";
  const list = loadCustom();
  if (!list.length) { ul.innerHTML = '<li class="custom-item" style="opacity:.8;"><div class="meta"><span class="item-title">No custom habits yet</span><span class="item-desc">Add a title, description and time, then press “Add habit”.</span></div></li>'; return; }
  list.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "custom-item";
    li.innerHTML = `
      <div class="meta">
        <span class="item-title">${escapeHTML(item.title)}</span>
        <span class="item-desc">${escapeHTML(item.desc || "")}</span>
      </div>
      <div class="item-time">${escapeHTML(item.time)}</div>
      <div class="item-actions">
        <button class="icon-btn" data-action="edit" data-idx="${idx}" aria-label="Edit habit">✏️ Edit</button>
        <button class="icon-btn" data-action="delete" data-idx="${idx}" aria-label="Delete habit">🗑️ Delete</button>
      </div>`;
    ul.appendChild(li);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderCustom();

  document.getElementById("addCustomBtn").addEventListener("click", () => {
    const title = (document.getElementById("customTitle").value || "").trim();
    const desc  = (document.getElementById("customDesc").value || "").trim();
    const time  = document.getElementById("customTime").value || "09:00";
    if (!title) { alert("Please enter a habit title."); return; }
    if (!/^\d{2}:\d{2}$/.test(time)) { alert("Time must be HH:MM (24h)."); return; }
    const list = loadCustom(); list.push({ title, desc, time }); saveCustom(list);
    document.getElementById("customTitle").value = ""; document.getElementById("customDesc").value = ""; document.getElementById("customTime").value = "19:00";
    renderCustom();
  });

  document.getElementById("customList").addEventListener("click", (e) => {
    const btn = e.target.closest("button.icon-btn"); if (!btn) return;
    const idx = parseInt(btn.getAttribute("data-idx"), 10);
    const list = loadCustom();
    if (btn.getAttribute("data-action")==="delete") {
      if (confirm("Delete this habit?")) { list.splice(idx,1); saveCustom(list); renderCustom(); }
    } else if (btn.getAttribute("data-action")==="edit") {
      const it = list[idx];
      const t = prompt("Edit title:", it.title); if (t===null) return;
      const d = prompt("Edit description:", it.desc ?? ""); if (d===null) return;
      const tm = prompt("Edit time (HH:MM):", it.time); if (tm===null) return;
      if (!/^\d{2}:\d{2}$/.test(tm)) { alert("Time must be HH:MM (24h)."); return; }
      list[idx] = { title: (t||"").trim()||it.title, desc: (d||"").trim(), time: tm };
      saveCustom(list); renderCustom();
    }
  });

  document.getElementById("clearAll").addEventListener("click", () => {
    if (confirm("Clear all custom habits?")) { saveCustom([]); renderCustom(); }
  });

  document.getElementById("nudgeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const calName = document.getElementById("calName").value.trim() || "Micronudger – Wellness";
    const tzid = document.getElementById("tz").value;
    const startDateStr = document.getElementById("startDate").value;
    const repeatDaily = document.getElementById("repeatDaily").checked;
    const addAlert15 = document.getElementById("alert15").checked;
    const durationMin = parseInt(document.getElementById("duration").value || "30", 10);

    if (!startDateStr) { alert("Please choose a start date."); return; }
    const [Y, M, D] = startDateStr.split("-").map(Number);

    // Built-ins
    const builtins = Array.from(document.querySelectorAll(".habit-card")).map(label => {
      const cb = label.querySelector(".builtin-nudge");
      const timeInput = label.querySelector(".builtin-time");
      if (!cb.checked) return null;
      const title = cb.getAttribute("data-title");
      const desc = cb.getAttribute("data-desc");
      const time = timeInput.value || cb.getAttribute("data-time") || "09:00";
      return { title, desc, time };
    }).filter(Boolean);

    // Custom
    const customs = loadCustom();

    if (!builtins.length && !customs.length) { alert("Please pick a built‑in habit or add your own."); return; }

    const events = [];
    function pushEvent(title, desc, time){
      const [hh, mm] = time.split(":").map(Number);
      const start = new Date(Y, (M-1), D, hh, mm, 0);
      events.push({ title, desc, start: start.toISOString(), durationMin });
    }
    builtins.forEach(b => pushEvent(b.title, b.desc, b.time));
    customs.forEach(c => pushEvent(c.title, c.desc||"", c.time));

    const ics = buildICS(events, calName, tzid, addAlert15, repeatDaily);
    const blob = new Blob([ics], {type: "text/calendar;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = (calName.replace(/\s+/g,"_")) + ".ics";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("Calendar created. Tip: add as a NEW calendar called “Micronudger – Wellness” so removal is easy later.");
  });

  document.getElementById("exportRemoval").addEventListener("click", () => {
    const calName = document.getElementById("calName").value.trim() || "Micronudger – Wellness";
    const ics = buildRemovalICS(calName);
    if (!ics) return;
    const blob = new Blob([ics], {type: "text/calendar;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = (calName.replace(/\s+/g,"_")) + "_REMOVE.ics";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

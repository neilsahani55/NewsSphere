// ===== NewsSphere — Today in History Script (Gemini) =====
// Fetches 10 historical events for today's calendar date via Gemini and
// stores them in the Supabase `today_history` table.
//
// ── SETUP ────────────────────────────────────────────────────────────────
// 1. Create the Supabase table by running this SQL in the Supabase SQL editor:
//
//    CREATE TABLE IF NOT EXISTS today_history (
//      id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
//      history_date date        NOT NULL,
//      event_year   text        NOT NULL,
//      title        text        NOT NULL,
//      description  text        NOT NULL,
//      category     text        NOT NULL DEFAULT 'History',
//      created_at   timestamptz NOT NULL DEFAULT now()
//    );
//    CREATE INDEX IF NOT EXISTS idx_today_history_date ON today_history (history_date);
//    ALTER TABLE today_history ENABLE ROW LEVEL SECURITY;
//    CREATE POLICY "Public read history" ON today_history
//      FOR SELECT TO anon USING (true);
//
// 2. Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, and GEMINI_API_KEY below.
//    - SUPABASE_URL:         Supabase project Settings → API → Project URL
//    - SUPABASE_SERVICE_KEY: Supabase project Settings → API → service_role key
//    - GEMINI_API_KEY:       https://aistudio.google.com/app/apikey
//
// 3. Run setupHistoryTriggers() once from the Apps Script editor.
//    It sets up a daily midnight trigger and fetches today's events immediately.
// ─────────────────────────────────────────────────────────────────────────

const SUPABASE_URL         = "https://vnmozbcnbscllwewerle.supabase.co";
const SUPABASE_SERVICE_KEY = "YOUR_SUPABASE_SERVICE_ROLE_KEY"; // Settings → API → service_role
const GEMINI_API_KEY       = "YOUR_GEMINI_API_KEY";            // aistudio.google.com/app/apikey
const HISTORY_TABLE        = "today_history";
const HISTORY_KEEP_DAYS    = 30;

// ── Date helpers ──────────────────────────────────────────────────────────

function getISTDate() {
  return Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
}

function getISTDisplayDate() {
  // e.g. "May 30"
  return Utilities.formatDate(new Date(), "Asia/Kolkata", "MMMM d");
}

// ── Supabase REST helpers ─────────────────────────────────────────────────

function sbHeaders() {
  return {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
    "Content-Type": "application/json",
  };
}

function sbGet(table, qs) {
  var url = SUPABASE_URL + "/rest/v1/" + table + (qs ? "?" + qs : "");
  var resp = UrlFetchApp.fetch(url, { headers: sbHeaders(), muteHttpExceptions: true });
  return { code: resp.getResponseCode(), body: resp.getContentText() };
}

function sbInsert(table, rows) {
  var url = SUPABASE_URL + "/rest/v1/" + table;
  var h = sbHeaders();
  h["Prefer"] = "return=minimal";
  var resp = UrlFetchApp.fetch(url, {
    method: "post",
    headers: h,
    payload: JSON.stringify(rows),
    muteHttpExceptions: true,
  });
  return resp.getResponseCode();
}

function sbDelete(table, qs) {
  var url = SUPABASE_URL + "/rest/v1/" + table + "?" + qs;
  var h = sbHeaders();
  h["Prefer"] = "return=minimal";
  var resp = UrlFetchApp.fetch(url, { method: "delete", headers: h, muteHttpExceptions: true });
  return resp.getResponseCode();
}

// ── Main: fetch today's history from Gemini and store ────────────────────

function fetchTodayHistory() {
  var today       = getISTDate();
  var displayDate = getISTDisplayDate();

  // Skip if already fetched for today
  var check = sbGet(HISTORY_TABLE, "history_date=eq." + today + "&limit=1");
  try {
    var existing = JSON.parse(check.body);
    if (Array.isArray(existing) && existing.length > 0) {
      Logger.log("History for " + today + " already exists — skipping.");
      return;
    }
  } catch (e) {
    Logger.log("Check query parse error: " + e);
  }

  // ── Gemini prompt ──────────────────────────────────────────────────────
  var prompt =
    "You are a historian and educator. List exactly 10 significant and fascinating historical events " +
    "that happened on " + displayDate + " across different years of world and Indian history.\n\n" +
    "Return ONLY a valid JSON array with no markdown fences, no explanation, no extra text.\n" +
    "Each element must have exactly these four string fields:\n" +
    '  "event_year"   — the year as a string, e.g. "1969"\n' +
    '  "title"        — a concise title, max 12 words\n' +
    '  "description"  — exactly 2-3 sentences with historical context and significance\n' +
    '  "category"     — exactly one of: Science, Politics, Sports, Technology, Art, World, India, Achievement, Disaster, History\n\n' +
    "Requirements:\n" +
    "- Exactly 10 events, each with a unique event_year\n" +
    "- Span ancient history through 2020\n" +
    "- At least 2 events related to India if historically possible\n" +
    "- Mix categories broadly — no more than 2 events per category\n" +
    "- Descriptions must be factual, educational, and specific\n" +
    "- Sort by event_year ascending\n\n" +
    "Example element:\n" +
    '{"event_year":"1969","title":"Apollo 11 Launched Toward the Moon","description":"NASA launched the Apollo 11 mission from Kennedy Space Center on July 16, 1969, carrying astronauts Neil Armstrong, Buzz Aldrin, and Michael Collins. Four days later, Armstrong and Aldrin became the first humans to walk on the lunar surface, fulfilling President Kennedy\'s 1961 goal.","category":"Science"}';

  var geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY;
  var geminiPayload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4000,
      responseMimeType: "application/json",
    },
  });

  var geminiResp;
  try {
    geminiResp = UrlFetchApp.fetch(geminiUrl, {
      method: "post",
      contentType: "application/json",
      payload: geminiPayload,
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log("Gemini fetch failed: " + e);
    return;
  }

  if (geminiResp.getResponseCode() !== 200) {
    Logger.log("Gemini error " + geminiResp.getResponseCode() + ": " + geminiResp.getContentText().slice(0, 300));
    return;
  }

  var rawText = "";
  try {
    var gData = JSON.parse(geminiResp.getContentText());
    rawText = (gData.candidates &&
               gData.candidates[0] &&
               gData.candidates[0].content &&
               gData.candidates[0].content.parts &&
               gData.candidates[0].content.parts[0] &&
               gData.candidates[0].content.parts[0].text) || "";
    rawText = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  } catch (e) {
    Logger.log("Gemini response parse failed: " + e);
    return;
  }

  var events;
  try {
    events = JSON.parse(rawText);
  } catch (e) {
    // Try to extract JSON array from anywhere in the text
    var m = rawText.match(/\[[\s\S]*\]/);
    if (m) {
      try { events = JSON.parse(m[0]); }
      catch (e2) {
        Logger.log("Could not parse JSON from Gemini output: " + rawText.slice(0, 400));
        return;
      }
    } else {
      Logger.log("No JSON array found in Gemini output: " + rawText.slice(0, 400));
      return;
    }
  }

  if (!Array.isArray(events) || events.length === 0) {
    Logger.log("Empty events array from Gemini");
    return;
  }

  // Build and validate rows
  var rows = [];
  for (var i = 0; i < events.length && rows.length < 12; i++) {
    var ev = events[i];
    var yr    = String(ev.event_year  || "").trim().slice(0, 10);
    var title = String(ev.title       || "").trim().slice(0, 200);
    var desc  = String(ev.description || "").trim().slice(0, 1500);
    var cat   = String(ev.category    || "History").trim().slice(0, 50);
    if (!yr || !title || !desc) continue;
    rows.push({ history_date: today, event_year: yr, title: title, description: desc, category: cat });
  }

  if (rows.length === 0) {
    Logger.log("No valid rows to insert after validation");
    return;
  }

  var code = sbInsert(HISTORY_TABLE, rows);
  Logger.log("Inserted " + rows.length + " history events for " + today + " | Supabase HTTP " + code);
}

// ── Cleanup: delete records older than 30 days ────────────────────────────

function cleanupOldHistory() {
  var cutoff    = new Date(Date.now() - HISTORY_KEEP_DAYS * 24 * 60 * 60 * 1000);
  var cutoffStr = Utilities.formatDate(cutoff, "Asia/Kolkata", "yyyy-MM-dd");
  var code = sbDelete(HISTORY_TABLE, "history_date=lt." + cutoffStr);
  Logger.log("Cleaned history older than " + cutoffStr + " | HTTP " + code);
}

// ── Trigger setup (run once) ──────────────────────────────────────────────

function setupHistoryTriggers() {
  // Remove any existing history triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === "fetchTodayHistory" || fn === "cleanupOldHistory") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Daily at 00:05 IST — fetch history for the new day
  ScriptApp.newTrigger("fetchTodayHistory")
    .timeBased()
    .atHour(0)
    .nearMinute(5)
    .everyDays(1)
    .inTimezone("Asia/Kolkata")
    .create();

  // Daily at 01:00 IST — purge records older than 30 days
  ScriptApp.newTrigger("cleanupOldHistory")
    .timeBased()
    .atHour(1)
    .everyDays(1)
    .inTimezone("Asia/Kolkata")
    .create();

  // Immediately fetch today's events so the UI shows data right away
  fetchTodayHistory();

  Logger.log("History triggers configured. Fetching today (" + getISTDate() + ")...");
}

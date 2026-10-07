# CivicPulse: AI that prioritizes city problems

CivicPulse lets citizens report civic issues (potholes, garbage, water leaks, broken streetlights) and helps authorities act on the most urgent ones first. Built for **Webathon / Webnova**.

**Demo link:** _add your hosted link here (GitHub Pages works)_

## Features

- **Complaint submission** with text, voice (Web Speech API, English / Hindi / Kannada / Tamil) with keywords in all four languages and an optional photo, plus a map pin or "Use my location"
- **Issue detection:** classifies the complaint into a category from the text and photo file name
- **Severity detection:** Low, Medium, High or Critical, based on danger words, urgency words and the number of reports, with a plain-language "Why" shown for every decision
- **Duplicate detection:** same category, still open and within 100 m (haversine distance, nearest match wins) are merged into one case
- **Department routing:** each category maps to a department
- **Live map and heatmap** of all cases, with marker size by report count
- **Dashboard:** total, active, resolved, high-priority and category/priority charts
- **Complaint tracking:** Reported → Assigned → In Progress → Resolved
- **Department view** to update statuses and see them reflected in tracking

## Demo video

Watch the demo: https://youtu.be/YbZmSD741A8 (also embedded on the **How to use** tab of the site).

To change it, set `DEMO_VIDEO` at the top of `app.js` to a YouTube link or a file such as `assets/demo.mp4`.

## How it works

Citizen report → category detected → severity calculated → duplicates merged → routed to department → shown on map → status tracked.

The analysis is an explainable, rule-based triage engine (whole-word keyword matching, so "hospital" never triggers "pit") and runs in the browser, so the demo works offline. The rules live in `app.js` (`classify`, `severity`, `dist`) and can be swapped for a real ML or vision API later.

## Setup

1. Clone the repo: `git clone <your-repo-url>`
2. Open `index.html` in a browser, or run a local server: `python -m http.server 8000` and visit `http://localhost:8000`
3. An internet connection is needed for the map tiles and libraries.

No build step or API keys required. Data is stored in the browser's `localStorage`; use "Reset demo data" in the Department tab to restore the sample cases.

## Tech stack

HTML, CSS, JavaScript, Leaflet, leaflet.heat, Esri map tiles

## Screenshots

_Add screenshots of the Report, Map, Dashboard and Track pages here._

## Team

| Name | Role |
|------|------|
| _Name 1_ | _e.g. Frontend_ |
| _Name 2_ | _e.g. Logic_ |

## Credits

- [Leaflet](https://leafletjs.com) (BSD-2) and [leaflet.heat](https://github.com/Leaflet/Leaflet.heat) (MIT)
- Map tiles © [Esri](https://www.esri.com) (World Street Map)
- Font: Atkinson Hyperlegible (Braille Institute) via Google Fonts
- AI assistance was used for guidance and learning while building this project.

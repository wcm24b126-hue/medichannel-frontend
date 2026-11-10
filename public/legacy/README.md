# MediChannel · Lanka Care Hospital

## Run locally
**Option A (recommended):** `python server.py` then open http://localhost:8000  (Python 3 required)

**Option B:** double-click `index.html` (works in demo mode too).

## Notes
- Needs internet on first load: Tailwind CSS and Google Fonts load from CDNs.
- No backend is included. Login/register fall back to built-in **demo mode**;
  demo accounts are listed in `DEMO_USERS` in `js/app.js`.
- Data is saved in your browser (localStorage, key `mc-db5`). Clear site data to reset.

## Structure
- `index.html` – page markup
- `css/style.css` – styles
- `js/tailwind-config.js` – Tailwind theme
- `js/app.js` – app shell, auth, translations
- `js/medichannel.js` – booking/queue system
- `server.py` – local static server

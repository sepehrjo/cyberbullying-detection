# Cyberbully Detector
A browser extension + moderator dashboard that detects abusive language on Reddit using a BERT + BiLSTM classifier. Moderators can review flagged items, label them (approve/reject), and retrain the model with moderator feedback.

---

## Repo layout (important folders)

- `backend/` - FastAPI backend, ML model code, training & retraining scripts
  - `api.py` - main FastAPI app & endpoints (detect, queue, action, history, retrain)
  - `model.py` - PyTorch model definition (BERT + BiLSTM classifier)
  - `dataset.py` - PyTorch Dataset wrapper for CSV data
  - `retrain_model.py` - retraining script (streams progress as SSE)
  - `train.py` - standalone training script (plots + final report)
  - `moderator_db.py`, `models.py`, `database.py` - DB helpers and ORM models
- `frontend/moderator-ui/` - React moderator dashboard (login, queue, history, retrain UI)
- `chrome-extension/` - Chrome extension (content.js, background.js, popup)
- `docker-compose.yml` - optional: starts postgres for local testing
- `docs/` - architecture images, screenshots, poster (optional)

---

## Quick start (development)

### Prereqs
- Python 3.9+ (or 3.10)
- Node.js (16+) and npm or yarn
- Docker (optional, for running Postgres easily)
- Chrome (for loading the extension locally)

### 1) Clone repo
```bash
git clone <your-repo-url>.git
cd <repo-root>


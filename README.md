# Cyberbully Detector (developed as my Final Year Project (graded A+))
A comprehensive system to detect and manage cyberbullying on social media (specifically Reddit). This project includes a browser extension for real-time detection, a moderator dashboard for reviewing flagged content, and a FastAPI backend powered by a BERT + BiLSTM machine learning model.

## Why this project exists
Cyberbullying is a significant issue in online communities. This tool empowers moderators by automatically flagging abusive language and providing an interface to review, label, and even retrain the detection model based on human feedback.

## Project Structure
- `backend/`: FastAPI server, ML model definitions, and database logic.
- `frontend/moderator-ui/`: React-based dashboard for moderators.
- `chrome-extension/`: Browser extension that scans Reddit comments.
- `.env.example`: Template for required environment variables.

## Quick Start

### 1. Prerequisites
- **Python 3.9+**
- **Node.js 16+**
- **PostgreSQL** (running locally or via Docker)
- **Chrome Browser**

### 2. Backend Setup
1. Navigate to the backend folder: `cd backend`
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `source venv/bin/activate` (or `venv\Scripts\activate` on Windows)
4. Install dependencies: `pip install -r requirements.txt` (Note: Ensure you have `torch`, `transformers`, `fastapi`, `sqlalchemy`, etc.)
5. Configure environment: Copy `.env.example` to `.env` in the root and update your database credentials.
6. Run the server: `uvicorn api:app --reload`

### 3. Frontend Setup
1. Navigate to the UI folder: `cd frontend/moderator-ui`
2. Install dependencies: `npm install`
3. Start the dashboard: `npm start`

### 4. Chrome Extension
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `chrome-extension/` folder.

## How to use
- **Scanning**: The extension will automatically scan Reddit comments. Flagged items appear with a red border.
- **Moderation**: Log in to the Moderator Dashboard to see the queue of flagged items.
- **Retraining**: After labeling items as "approved" or "rejected", you can trigger a model retrain from the dashboard to improve accuracy.


## License
No license file found.

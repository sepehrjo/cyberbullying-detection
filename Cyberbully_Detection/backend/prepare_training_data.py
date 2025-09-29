# prepare_training_data.py
# Extracts moderator actions from your PostgreSQL db and merges them
# with an existing CSV to produce `merged_train.csv` for retraining

import psycopg2
import pandas as pd

# PostgreSQL credentials
DB_CONFIG = {
    "dbname":   "cyberbullydb",
    "user":     "sepehrchn",
    "password": "25051378Sc@",
    "host":     "localhost",
    "port":     "5432"
}

def prepare_training_data(
    original_csv: str = "train.csv",
    output_csv:   str = "merged_train.csv"
):
    print("🔄 Connecting to the database...")
    conn = psycopg2.connect(**DB_CONFIG)

    # Fetch latest moderator feedback per comment_id
    query = """
        SELECT DISTINCT ON (comment_id) comment_id, text, action
        FROM moderator_actions
        WHERE action IN ('approved', 'rejected')
        ORDER BY comment_id, timestamp DESC;
    """
    df_feedback = pd.read_sql(query, conn)
    conn.close()

    if df_feedback.empty:
        print("⚠️ No moderator feedback found.")
        return

    # Map 'approved' → 1, 'rejected' → 0
    label_map = {"approved": 1, "rejected": 0}
    df_feedback["Label"]      = df_feedback["action"].map(label_map)
    df_feedback = df_feedback.rename(columns={"text": "clean_text"})
    df_feedback = df_feedback[["clean_text", "Label"]].dropna().drop_duplicates()

    print(f"✅ Extracted {len(df_feedback)} feedback samples.")

    # Load original dataset
    print("📂 Loading original dataset...")
    df_original = pd.read_csv(original_csv)
    print(f"✅ Loaded {len(df_original)} original samples.")

    # Merge & dedupe
    print("🔗 Merging and removing duplicates...")
    df_combined = pd.concat([df_original, df_feedback], ignore_index=True)
    df_combined = df_combined.drop_duplicates(subset="clean_text")
    df_combined = df_combined.sample(frac=1, random_state=42).reset_index(drop=True)

    df_combined.to_csv(output_csv, index=False)
    print(f"✅ Final dataset saved to {output_csv} with {len(df_combined)} entries.")

if __name__ == "__main__":
    prepare_training_data()

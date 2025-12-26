# retrain_model.py

# Script to retrain your CyberbullyModel in‐process,

import json
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torch.cuda.amp import autocast, GradScaler
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix

from dataset import CyberbullyDataset
from backend.model import CyberbullyModel

# Hyperparameters
EPOCHS     = 3
BATCH_SIZE = 8
LR         = 2e-5 # Learning Rate =less LR=> more accuracy and lower speed

def get_device():
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")

def evaluate(model, loader, device):
    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for batch in loader:
            input_ids      = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels         = batch["labels"].to(device)

            outputs = model(input_ids, attention_mask=attention_mask)
            preds   = torch.argmax(outputs, dim=1)

            all_preds.extend(preds.cpu().tolist())
            all_labels.extend(labels.cpu().tolist())

    # Compute F1 and confusion matrix
    _, _, f1, _ = precision_recall_fscore_support(
        all_labels, all_preds, average='binary', zero_division=0
    )
    cm = confusion_matrix(all_labels, all_preds).tolist()

    # Emit confusion-matrix event
    print(json.dumps({"type":"confusion_matrix","matrix":cm}), flush=True)
    return f1

def retrain_main():
    device      = get_device()
    train_ds    = CyberbullyDataset("merged_train.csv")
    val_ds      = CyberbullyDataset("val.csv")
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE)
    total_steps  = EPOCHS * len(train_loader)

    # Summary
    print(json.dumps({
        "type":        "summary",
        "epochs":      EPOCHS,
        "batch_size":  BATCH_SIZE,
        "total_steps": total_steps,
        "device":      str(device)
    }), flush=True)

    # Training start
    print(json.dumps({"type":"training_started"}), flush=True)

    model     = CyberbullyModel().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LR)
    criterion = nn.CrossEntropyLoss()
    scaler    = GradScaler()

    step = 0
    best_f1 = 0.0
    last_prog = -1

    for epoch in range(1, EPOCHS+1):
        model.train()
        running_loss = 0.0

        for batch in train_loader:
            optimizer.zero_grad()
            input_ids      = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels         = batch["labels"].to(device)

            with autocast():
                outputs = model(input_ids, attention_mask=attention_mask)
                loss    = criterion(outputs, labels)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            running_loss += loss.item()
            step += 1
            prog = int(step/total_steps*100)
            if prog > last_prog:
                print(json.dumps({
                    "type":     "progress",
                    "epoch":    epoch,
                    "step":     step,
                    "progress": prog
                }), flush=True)
                last_prog = prog

        # End of epoch: eval and maybe save
        avg_loss = running_loss / len(train_loader)
        f1_score = evaluate(model, val_loader, device)

        print(json.dumps({
            "type":     "epoch_end",
            "epoch":    epoch,
            "avg_loss": round(avg_loss,4),
            "f1":       round(f1_score,4)
        }), flush=True)

        if f1_score > best_f1:
            best_f1 = f1_score
            torch.save(model.state_dict(), "backend/best_model.pt")
            print(json.dumps({"type":"model_saved","f1":round(f1_score,4)}), flush=True)

    # Done
    print(json.dumps({"type":"complete","best_f1":round(best_f1,4)}), flush=True)

if __name__ == "__main__":
    retrain_main()

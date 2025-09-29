# define the RNN based classifier to get best model
# backend/model.py

import torch
import torch.nn as nn
from transformers import BertModel

class CyberbullyModel(nn.Module):
    """
    A simple cyberbullying detector built on BERT + BiLSTM + classifier head.
    """
    def __init__(
        self,
        bert_model: str = "bert-base-uncased",
        hidden_size: int = 128,
        num_layers: int = 1,
        dropout: float = 0.2
    ):
        super().__init__()
        # 1) Pre-trained BERT backbone
        self.bert = BertModel.from_pretrained(bert_model)
        emb_size = self.bert.config.hidden_size

        # 2) Bidirectional LSTM on top of token embeddings
        self.lstm = nn.LSTM(
            input_size=emb_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0.0
        )

        # 3) Dropout + classification head
        self.dropout    = nn.Dropout(dropout)
        self.classifier = nn.Linear(hidden_size * 2, 2)  # binary

    def forward(self, input_ids, attention_mask):
        # A) Extract embeddings from BERT
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        seq_out = outputs.last_hidden_state  # (batch, seq_len, emb_size)

        # B) BiLSTM over the sequence
        lstm_out, _ = self.lstm(seq_out)     # (batch, seq_len, hidden*2)

        # C) Pool: concatenate final forward & backward hidden states
        final_feat = torch.cat(
            (lstm_out[:, -1, :self.lstm.hidden_size],
             lstm_out[:,  0, self.lstm.hidden_size:]),
            dim=1
        )

        # D) Classifier
        x = self.dropout(final_feat)
        logits = self.classifier(x)  # (batch, 2)
        return logits

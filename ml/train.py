# ---------------------------------------------------------------------------
# Trains BOTH models (ETA + congestion) and exports them to ONNX.
#
#   python train.py
#
# Outputs (imported by the Node backend via file path):
#   ../models/eta.onnx
#   ../models/congestion.onnx
#   ../models/metrics.json   (validation scores, for your report)
#
# Swap the MLP for any architecture you like (GNN, LSTM, gradient boosting via
# skl2onnx, etc.) as long as you keep the input/output tensor names + the
# feature order defined in schema.py.
# ---------------------------------------------------------------------------

import os
import json
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from data import make_eta_dataset, make_congestion_dataset

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
os.makedirs(OUT_DIR, exist_ok=True)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
torch.manual_seed(0)


class MLP(nn.Module):
    """Feed-forward regressor with dropout. Input dim -> scalar."""

    def __init__(self, in_dim, hidden=128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden, hidden // 2),
            nn.ReLU(),
            nn.Linear(hidden // 2, 1),
        )

    def forward(self, x):
        return self.net(x)


def evaluate(model, Xv, yv):
    """Return (MAE, R2) on a validation tensor pair."""
    model.eval()
    with torch.no_grad():
        pred = model(Xv)
        mae = torch.mean(torch.abs(pred - yv)).item()
        ss_res = torch.sum((yv - pred) ** 2).item()
        ss_tot = torch.sum((yv - yv.mean()) ** 2).item()
        r2 = 1.0 - ss_res / max(ss_tot, 1e-9)
    return mae, r2


def train_model(X, y, name, epochs=120, batch=512, lr=2e-3):
    X_t = torch.tensor(X, dtype=torch.float32)
    y_t = torch.tensor(y, dtype=torch.float32)
    n_val = int(len(X_t) * 0.15)
    ds = TensorDataset(X_t[:-n_val], y_t[:-n_val])
    dl = DataLoader(ds, batch_size=batch, shuffle=True)
    Xv, yv = X_t[-n_val:].to(DEVICE), y_t[-n_val:].to(DEVICE)

    model = MLP(in_dim=X.shape[1]).to(DEVICE)
    opt = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    loss_fn = nn.SmoothL1Loss()  # Huber: robust to outliers

    best = {"mae": float("inf"), "r2": 0.0, "state": None}
    for epoch in range(epochs):
        model.train()
        for xb, yb in dl:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            opt.zero_grad()
            loss = loss_fn(model(xb), yb)
            loss.backward()
            opt.step()
        sched.step()

        mae, r2 = evaluate(model, Xv, yv)
        if mae < best["mae"]:
            best = {"mae": mae, "r2": r2, "state": {k: v.cpu().clone() for k, v in model.state_dict().items()}}
        if (epoch + 1) % 20 == 0:
            print(f"[{name}] epoch {epoch + 1:3d}  val_MAE={mae:.4f}  R2={r2:.4f}")

    model.load_state_dict(best["state"])  # restore best checkpoint
    print(f"[{name}] BEST  val_MAE={best['mae']:.4f}  R2={best['r2']:.4f}")
    return model, best["mae"], best["r2"]


def export_onnx(model, in_dim, path):
    model.eval().to("cpu")
    dummy = torch.zeros(1, in_dim, dtype=torch.float32)
    torch.onnx.export(
        model,
        dummy,
        path,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=17,
    )
    print(f"  exported -> {path}")


def main():
    print(f"device: {DEVICE}")
    metrics = {}

    print("\n== Training ETA model ==")
    Xe, ye = make_eta_dataset()
    eta_model, eta_mae, eta_r2 = train_model(Xe, ye, "eta")
    export_onnx(eta_model, Xe.shape[1], os.path.join(OUT_DIR, "eta.onnx"))
    metrics["eta"] = {"val_mae_min": round(eta_mae, 4), "r2": round(eta_r2, 4), "features": Xe.shape[1]}

    print("\n== Training congestion model ==")
    Xc, yc = make_congestion_dataset()
    cong_model, cong_mae, cong_r2 = train_model(Xc, yc, "congestion")
    export_onnx(cong_model, Xc.shape[1], os.path.join(OUT_DIR, "congestion.onnx"))
    metrics["congestion"] = {"val_mae": round(cong_mae, 4), "r2": round(cong_r2, 4), "features": Xc.shape[1]}

    with open(os.path.join(OUT_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print("\nSaved metrics.json:", json.dumps(metrics, indent=2))
    print("\nDone. The two .onnx files are in /models; the Node backend picks")
    print("them up automatically on the next request (no restart needed).")


if __name__ == "__main__":
    main()

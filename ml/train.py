<<<<<<< HEAD
"""
RouteCast Production ML Training Pipeline — v2
===============================================
Improvements over v1:
  - BatchNorm1d after each hidden layer (improves convergence on tabular data)
  - ReduceLROnPlateau scheduler (halves LR when val loss plateaus)
  - Wider network: 9→256→256→128→64→output
  - Increased EPOCHS to 80, PATIENCE to 15
  - Label smoothing (0.1) for congestion CrossEntropyLoss
  - Gradient clipping unchanged at 5.0

Models:
    Model 1: ETA regression        → models/eta.onnx
    Model 2: Congestion classifier → models/congestion.onnx

ETA target:
    log(future_travel_time / current_travel_time)

Congestion classes:
    0=free  1=light  2=moderate  3=heavy  4=severe
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import numpy as np

import torch
import torch.nn as nn

from torch.utils.data import (
    DataLoader,
    TensorDataset,
)

from data import (
    load_eta_data,
    load_congestion_data,
)

from schema import (
    ETA_INPUT_DIM,
    CONGESTION_INPUT_DIM,
    CONGESTION_CLASSES,
    CONGESTION_OUTPUT_DIM,
)


# ============================================================
# CONFIGURATION
# ============================================================

SEED = 42

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

BATCH_SIZE = 512
EPOCHS = 80
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-5
PATIENCE = 15
LR_PATIENCE = 5          # halve LR after this many non-improving epochs
LR_FACTOR = 0.5
LR_MIN = 1e-5


MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# REPRODUCIBILITY
# ============================================================

random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)


# ============================================================
# MODEL — wider + BatchNorm
# ============================================================

class TrafficMLP(nn.Module):

    def __init__(self, input_dim: int, output_dim: int):
        super().__init__()

        self.network = nn.Sequential(
            # Layer 1
            nn.Linear(input_dim, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(0.15),

            # Layer 2
            nn.Linear(256, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(0.15),

            # Layer 3
            nn.Linear(256, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.10),

            # Layer 4
            nn.Linear(128, 64),
            nn.ReLU(),

            # Output
            nn.Linear(64, output_dim),
        )

    def forward(self, x):
        return self.network(x)


# ============================================================
# REGRESSION METRICS
# ============================================================

def regression_metrics(actual, predicted):

    actual = np.asarray(actual, dtype=np.float64).reshape(-1)
    predicted = np.asarray(predicted, dtype=np.float64).reshape(-1)

    error = predicted - actual
    abs_error = np.abs(error)

    mae = float(np.mean(abs_error))
    rmse = float(np.sqrt(np.mean(error ** 2)))

    ss_res = float(np.sum(error ** 2))
    ss_tot = float(np.sum((actual - np.mean(actual)) ** 2))
    r2 = (1.0 - ss_res / ss_tot) if ss_tot > 0 else 0.0

    return {
        "mae": mae,
        "rmse": rmse,
        "r2": float(r2),
        "median_absolute_error": float(np.percentile(abs_error, 50)),
        "p90_absolute_error": float(np.percentile(abs_error, 90)),
        "p95_absolute_error": float(np.percentile(abs_error, 95)),
    }


# ============================================================
# ETA ACCURACY
# ============================================================

def eta_accuracy_metrics(actual_eta, predicted_eta):

    actual_eta = np.asarray(actual_eta, dtype=np.float64).reshape(-1)
    predicted_eta = np.asarray(predicted_eta, dtype=np.float64).reshape(-1)

    denominator = np.maximum(np.abs(actual_eta), 1.0)
    relative_error = np.abs(predicted_eta - actual_eta) / denominator

    return {
        "within_10_percent": float(np.mean(relative_error <= 0.10)),
        "within_20_percent": float(np.mean(relative_error <= 0.20)),
        "within_30_percent": float(np.mean(relative_error <= 0.30)),
    }


# ============================================================
# CONGESTION METRICS
# ============================================================

def congestion_metrics(actual, predicted):

    actual = np.asarray(actual, dtype=np.int64).reshape(-1)
    predicted = np.asarray(predicted, dtype=np.int64).reshape(-1)

    exact_accuracy = float(np.mean(actual == predicted))
    adjacent_accuracy = float(np.mean(np.abs(actual - predicted) <= 1))

    per_class = {}
    for class_index, class_name in enumerate(CONGESTION_CLASSES):
        tp = np.sum((actual == class_index) & (predicted == class_index))
        fp = np.sum((actual != class_index) & (predicted == class_index))
        fn = np.sum((actual == class_index) & (predicted != class_index))

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec  = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1   = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0

        per_class[class_name] = {
            "precision": float(prec),
            "recall":    float(rec),
            "f1":        float(f1),
            "support":   int(np.sum(actual == class_index)),
        }

    macro_f1 = float(np.mean([m["f1"] for m in per_class.values()]))

    confusion = np.zeros((CONGESTION_OUTPUT_DIM, CONGESTION_OUTPUT_DIM), dtype=np.int64)
    for a, p in zip(actual, predicted):
        if 0 <= a < CONGESTION_OUTPUT_DIM and 0 <= p < CONGESTION_OUTPUT_DIM:
            confusion[a, p] += 1

    return {
        "exact_accuracy": exact_accuracy,
        "within_one_class_accuracy": adjacent_accuracy,
        "macro_f1": macro_f1,
        "per_class": per_class,
        "confusion_matrix": confusion.tolist(),
    }


# ============================================================
# TRAINING
# ============================================================

def train_model(name, datasets, loss_function, output_dim):

    print("\n" + "=" * 70)
    print(f" TRAINING {name.upper()} MODEL")
    print("=" * 70)

    X_train, y_train = datasets["train"]
    X_val,   y_val   = datasets["val"]
    X_test,  y_test  = datasets["test"]

    print(f"Train: {X_train.shape}  Val: {X_val.shape}  Test: {X_test.shape}")

    input_dim = X_train.shape[1]
    model = TrafficMLP(input_dim=input_dim, output_dim=output_dim).to(DEVICE)

    param_count = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Parameters: {param_count:,}")

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
    )

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="min",
        factor=LR_FACTOR,
        patience=LR_PATIENCE,
        min_lr=LR_MIN,
    )

    train_loader = DataLoader(
        TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train)),
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=0,
    )
    val_loader = DataLoader(
        TensorDataset(torch.from_numpy(X_val), torch.from_numpy(y_val)),
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=0,
    )

    best_val_loss = float("inf")
    best_state = None
    patience_counter = 0
    history = []

    for epoch in range(1, EPOCHS + 1):

        # Train
        model.train()
        train_losses = []
        for X_batch, y_batch in train_loader:
            X_batch, y_batch = X_batch.to(DEVICE), y_batch.to(DEVICE)
            optimizer.zero_grad()
            pred = model(X_batch)
            loss = loss_function(pred, y_batch)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
            optimizer.step()
            train_losses.append(loss.item())
        train_loss = float(np.mean(train_losses))

        # Validate
        model.eval()
        val_losses = []
        with torch.no_grad():
            for X_batch, y_batch in val_loader:
                X_batch, y_batch = X_batch.to(DEVICE), y_batch.to(DEVICE)
                val_losses.append(loss_function(model(X_batch), y_batch).item())
        val_loss = float(np.mean(val_losses))

        scheduler.step(val_loss)

        history.append({"epoch": epoch, "train_loss": train_loss, "val_loss": val_loss})
        print(f"Epoch {epoch:02d}/{EPOCHS} | train={train_loss:.6f} | val={val_loss:.6f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                print(f"\nEarly stopping at epoch {epoch}.")
                break

    if best_state is not None:
        model.load_state_dict(best_state)
    model.eval()

    X_test_tensor = torch.from_numpy(X_test).to(DEVICE)
    with torch.no_grad():
        prediction = model(X_test_tensor).cpu().numpy()

    return model, prediction, history, best_val_loss


# ============================================================
# ONNX EXPORT
# ============================================================

def export_onnx(model, input_dim, output_dim, path):
    model = model.to("cpu")
    model.eval()
    dummy = torch.randn(1, input_dim, dtype=torch.float32)
    torch.onnx.export(
        model, dummy, path,
        input_names=["input"], output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=18,
    )
    print(f"ONNX exported: {path}")


# ============================================================
# ONNX PARITY
# ============================================================

def verify_onnx(model, onnx_path, X):
    try:
        import onnxruntime as ort
    except ImportError:
        print("onnxruntime not installed; skipping parity check.")
        return None

    model = model.to("cpu")
    model.eval()
    sample = X[:1000].astype(np.float32)
    with torch.no_grad():
        torch_out = model(torch.from_numpy(sample)).numpy()
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    onnx_out = session.run(["output"], {"input": sample})[0]
    diff = float(np.max(np.abs(torch_out - onnx_out)))
    print(f"ONNX parity max difference: {diff:.8f}")
    return diff


# ============================================================
# ETA EVALUATION
# ============================================================

def evaluate_eta(prediction_log_factor, X_test, y_test):
    current_eta_normalized = X_test[:, 1]
    current_eta = np.expm1(current_eta_normalized * np.log1p(3600.0))

    predicted_log_factor = prediction_log_factor.reshape(-1)
    actual_log_factor    = y_test.reshape(-1)

    predicted_eta = np.clip(current_eta * np.exp(predicted_log_factor), 0.0, 3600.0)
    actual_eta    = np.clip(current_eta * np.exp(actual_log_factor),    0.0, 3600.0)

    metrics = regression_metrics(actual_eta, predicted_eta)
    metrics.update(eta_accuracy_metrics(actual_eta, predicted_eta))
    return metrics, actual_eta, predicted_eta


# ============================================================
# MAIN
# ============================================================

def main():

    print("\n" + "=" * 70)
    print(" RouteCast ML Training Pipeline v2")
    print("=" * 70)
    print(f"Device:     {DEVICE}")
    print(f"Epochs:     {EPOCHS}  (patience={PATIENCE})")
    print(f"Batch size: {BATCH_SIZE}")
    print(f"LR:         {LEARNING_RATE}  (scheduler halves at {LR_PATIENCE} plateau epochs)")
    print("=" * 70)

    all_metrics = {}
    all_history = {}

    # ---- ETA ----
    print("\n" + "=" * 70)
    print(" PHASE 1: ETA MODEL")
    print("=" * 70)

    eta_data = load_eta_data()
    eta_model, eta_pred, eta_history, eta_best = train_model(
        name="eta",
        datasets=eta_data,
        loss_function=nn.SmoothL1Loss(),
        output_dim=1,
    )

    X_test_eta, y_test_eta = eta_data["test"]
    eta_metrics, actual_eta, predicted_eta = evaluate_eta(eta_pred, X_test_eta, y_test_eta)

    print("\nETA TEST RESULTS")
    print("-" * 50)
    for k, v in eta_metrics.items():
        if k.startswith("within_"):
            print(f"{k:25s}: {v * 100:.2f}%")
        else:
            print(f"{k:25s}: {v:.6f}")

    eta_path = MODEL_DIR / "eta.onnx"
    export_onnx(eta_model, ETA_INPUT_DIM, 1, eta_path)
    eta_parity = verify_onnx(eta_model, eta_path, X_test_eta)

    all_metrics["eta"] = eta_metrics
    all_metrics["eta"]["best_validation_loss"] = eta_best
    all_metrics["eta"]["onnx_max_difference"] = eta_parity
    all_history["eta"] = eta_history

    # ---- CONGESTION ----
    print("\n" + "=" * 70)
    print(" PHASE 2: CONGESTION MODEL")
    print("=" * 70)

    cong_data = load_congestion_data()
    cong_model, cong_logits, cong_history, cong_best = train_model(
        name="congestion",
        datasets=cong_data,
        loss_function=nn.CrossEntropyLoss(label_smoothing=0.1),
        output_dim=CONGESTION_OUTPUT_DIM,
    )

    X_test_cong, y_test_cong = cong_data["test"]
    probs = torch.softmax(torch.from_numpy(cong_logits), dim=1).numpy()
    pred_classes = np.argmax(probs, axis=1)
    cong_result = congestion_metrics(y_test_cong, pred_classes)

    print("\nCONGESTION TEST RESULTS")
    print("-" * 50)
    print(f"Exact accuracy        : {cong_result['exact_accuracy'] * 100:.2f}%")
    print(f"Within ±1 class       : {cong_result['within_one_class_accuracy'] * 100:.2f}%")
    print(f"Macro F1              : {cong_result['macro_f1']:.4f}")

    print("\nPER-CLASS RESULTS")
    print("-" * 70)
    print(f"{'Class':12s}{'Precision':12s}{'Recall':12s}{'F1':12s}{'Support':12s}")
    for cn in CONGESTION_CLASSES:
        m = cong_result["per_class"][cn]
        print(f"{cn:12s}{m['precision']*100:10.2f}% {m['recall']*100:10.2f}% {m['f1']*100:10.2f}% {m['support']:10d}")

    print("\nCONFUSION MATRIX (rows=actual, cols=predicted)")
    print("-" * 70)
    print("             " + " ".join(f"{n[:4]:>8s}" for n in CONGESTION_CLASSES))
    for i, cn in enumerate(CONGESTION_CLASSES):
        print(f"{cn:10s}" + " ".join(f"{v:8d}" for v in cong_result["confusion_matrix"][i]))

    cong_path = MODEL_DIR / "congestion.onnx"
    export_onnx(cong_model, CONGESTION_INPUT_DIM, CONGESTION_OUTPUT_DIM, cong_path)
    cong_parity = verify_onnx(cong_model, cong_path, X_test_cong)

    all_metrics["congestion"] = cong_result
    all_metrics["congestion"]["best_validation_loss"] = cong_best
    all_metrics["congestion"]["onnx_max_difference"] = cong_parity
    all_history["congestion"] = cong_history

    # ---- SAVE ----
    metrics_path = MODEL_DIR / "metrics.json"
    history_path = MODEL_DIR / "training_history.json"

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(all_metrics, f, indent=2)
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(all_history, f, indent=2)

    # ---- SUMMARY ----
    print("\n" + "=" * 70)
    print(" TRAINING COMPLETE")
    print("=" * 70)
    print(f"\nETA model       : {eta_path}")
    print(f"Congestion model: {cong_path}")
    print(f"Metrics         : {metrics_path}")
    print(f"\nFinal results:")
    print(f"  ETA R²        : {all_metrics['eta']['r2']:.4f}")
    print(f"  ETA within 20%: {all_metrics['eta']['within_20_percent']*100:.2f}%")
    print(f"  Cong accuracy : {all_metrics['congestion']['exact_accuracy']*100:.2f}%")
    print(f"  Cong macro F1 : {all_metrics['congestion']['macro_f1']:.4f}")
    print("=" * 70)
=======
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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975


if __name__ == "__main__":
    main()

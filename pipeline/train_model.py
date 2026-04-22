import os
import joblib
import numpy as np
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score

from pipeline.build_features import build_training_data, compute_patch_weights, save_metadata

MODEL_PATH    = "data/model.joblib"
METADATA_PATH = "data/model_metadata.json"
LAMBDA_DECAY  = 0.3


def train(db_path: str, lambda_decay: float = LAMBDA_DECAY):
    print("Construindo features...")
    df, metadata = build_training_data(db_path)

    feature_cols = metadata['feature_columns']
    X = df[feature_cols].values
    y = df['result'].values

    # Pesos por patch — patches mais recentes têm maior peso
    weights = compute_patch_weights(df['_patch_major'], lambda_decay=lambda_decay)

    # Split temporal: treino nos patches mais antigos, teste nos mais recentes
    patches_numeric = df['_patch_major'].apply(
        lambda p: float(f"{str(p).split('.')[0]}.{str(p).split('.')[1].zfill(2)}")
        if '.' in str(p) else 0.0
    )
    split_threshold = patches_numeric.quantile(0.85)
    train_mask = patches_numeric <= split_threshold
    test_mask  = patches_numeric >  split_threshold

    X_train, y_train, w_train = X[train_mask], y[train_mask], weights[train_mask]
    X_test,  y_test            = X[test_mask],  y[test_mask]

    print(f"Treino: {train_mask.sum()} amostras | Teste: {test_mask.sum()} amostras")

    model = lgb.LGBMClassifier(
        n_estimators=500,
        learning_rate=0.05,
        num_leaves=63,
        max_depth=8,
        min_child_samples=10,
        subsample=0.8,
        colsample_bytree=0.6,
        reg_alpha=0.1,
        reg_lambda=0.1,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )

    model.fit(
        X_train, y_train,
        sample_weight=w_train,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(100)],
    )

    if len(X_test) > 0:
        y_pred_prob = model.predict_proba(X_test)[:, 1]
        y_pred      = (y_pred_prob >= 0.5).astype(int)
        auc  = roc_auc_score(y_test, y_pred_prob)
        acc  = accuracy_score(y_test, y_pred)
        print(f"\nResultados no conjunto de teste:")
        print(f"  AUC-ROC:  {auc:.4f}")
        print(f"  Acurácia: {acc:.4f}")

    os.makedirs("data", exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    save_metadata(metadata, METADATA_PATH)
    print(f"\nModelo salvo em {MODEL_PATH}")
    print(f"Metadata salvo em {METADATA_PATH}")
    return model, metadata

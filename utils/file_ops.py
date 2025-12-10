import os, json
from utils.schema import Metadata, CampaignState

def load_json(path: str):
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_json(path: str, data: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def load_state(path: str) -> CampaignState:
    raw = load_json(path)
    if not raw:
        raw = {"/": Metadata.default("ROOT").model_dump()}
    try:
        return CampaignState.model_validate(raw)
    except Exception:
        for k, v in raw.items():
            try:
                raw[k] = Metadata.model_validate(v).model_dump()
            except Exception:
                raw[k] = Metadata.default(k).model_dump()
        return CampaignState.model_validate(raw)

def save_state(path: str, state: CampaignState):
    save_json(path, state.model_dump())

def ensure_node(state: CampaignState, path: str) -> Metadata:
    root = state.root
    if path not in root:
        name = path.strip("/").split("/")[-1] or "ROOT"
        root[path] = Metadata.default(name=name)
    return root[path]

def save_vis_state(path: str, data: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
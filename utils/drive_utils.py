# utils/drive_utils.py
import re, requests

def normalize_drive_link(url_or_id: str) -> str:
    """Zamienia wszystkie typy linków z Google Drive na bezpośredni (userContent)"""
    if not url_or_id:
        return ""

    file_id = None

    # Sprawdź czy to pełny URL
    if "drive.google.com" in url_or_id or "docs.google.com" in url_or_id:
        # Próba wyciągnięcia ID z formatu /d/ID
        match = re.search(r"/d/([a-zA-Z0-9_-]+)", url_or_id)
        if match:
            file_id = match.group(1)
        else:
            # Próba wyciągnięcia ID z parametru ?id=
            match_id = re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url_or_id)
            if match_id:
                file_id = match_id.group(1)
    else:
        # Zakładamy, że podano bezpośrednie ID jeśli to nie URL
        if not url_or_id.startswith("http"):
            file_id = url_or_id.strip()

    if file_id:
        # Zwracamy stabilny link z parametrem export=view
        # Link ten powoduje przekierowanie (302) do treści, ale zazwyczaj działa poprawnie w tagach <img>
        return f"https://drive.google.com/uc?export=view&id={file_id}"

    # Jeśli nie udało się wyciągnąć ID, a to link, zwracamy oryginał
    return url_or_id
#!/usr/bin/env python3
"""
Download a movie's **poster** (from **IMDb/Amazon images**) and a **16:9 landscape** (from **Paramount / CBSi CDN**) at **≥ 2000 px** — **no API keys**.

How it works
------------
1) Prompts for the film title.
2) Poster (IMDb):
   - Uses IMDb's public suggestion endpoint to find the best title match and get an image URL.
   - Requests a *hi‑res* poster variant (e.g., `..._V1_FMjpg_UY3000_.jpg`) and verifies pixel size.
3) Landscape (Paramount):
   - If you paste a Paramount/CBSi thumbnail URL, it tries larger variants (e.g., 3840×2160, 2560×1440, 2048×1152), verifying size.
   - Otherwise, it searches DuckDuckGo HTML for `site:thumbnails.cbsig.net` results that match the title and probes for a ≥2000‑px version.
4) Saves files in the current working directory as:
      <Title> - poster.<ext>
      <Title> - 16x9.<ext>

Notes
-----
- Sources: IMDb (m.media-amazon.com) for posters; Paramount/CBSi (thumbnails.cbsig.net) for 16:9. No Wikipedia.
- Requires: `requests`, `Pillow`  →  `pip install requests pillow`
- Be mindful of image licensing if you plan to republish the files.
"""

import io
import os
import re
import sys
import json
import math
import urllib.parse
from typing import Dict, List, Optional, Tuple

try:
    import requests
    from PIL import Image
except ModuleNotFoundError as e:
    print("This script requires 'requests' and 'Pillow'. Install with: pip install requests pillow", file=sys.stderr)
    sys.exit(1)

UA = {"User-Agent": "MovieImageFetcher/ParamountIMDb/1.0 (no-api-key)"}

# ----------------------------- helpers ------------------------------------

def sanitize_filename(name: str) -> str:
    name = re.sub(r"[\\/:*?\"<>|]", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def infer_ext(url: str, content_type: Optional[str]) -> str:
    if content_type:
        ct = content_type.lower()
        if "png" in ct: return ".png"
        if "webp" in ct: return ".webp"
        if "jpeg" in ct or "jpg" in ct: return ".jpg"
    m = re.search(r"\.(jpe?g|png|webp)(?:\?|$)", url, flags=re.I)
    return f".{m.group(1).lower()}" if m else ".jpg"


def get(url: str, stream: bool = True, timeout: int = 30) -> requests.Response:
    r = requests.get(url, headers=UA, stream=stream, timeout=timeout)
    r.raise_for_status()
    return r


def fetch_image_and_dims(url: str) -> Tuple[bytes, int, int, str]:
    """Download image and return (bytes, width, height, content_type)."""
    r = get(url, stream=True, timeout=45)
    data = r.content
    ct = r.headers.get("Content-Type", "")
    with Image.open(io.BytesIO(data)) as im:
        w, h = im.size
    return data, w, h, ct

# ----------------------------- IMDb Poster --------------------------------

SUGGEST_BASE = "https://v2.sg.media-imdb.com/suggestion/{letter}/{slug}.json"


def imdb_suggest(title: str) -> Optional[dict]:
    slug = re.sub(r"\s+", " ", title).strip()
    url = SUGGEST_BASE.format(letter=slug[0].lower(), slug=urllib.parse.quote(slug))
    try:
        r = get(url, stream=False)
        js = r.json()
        return js
    except Exception:
        return None


def pick_imdb_title(js: dict, query: str) -> Optional[dict]:
    items = (js or {}).get("d", [])
    if not items:
        return None
    q = query.lower().strip()
    # filter likely films
    films = [x for x in items if x.get("id", "").startswith("tt") and (x.get("qid") in ("feature", "movie", "title") or x.get("q") in ("feature", "movie"))]
    if not films:
        films = items
    # Prefer exact title match, then startswith, else first
    def key(x):
        name = (x.get("l") or "").lower()
        exact = (name == q)
        starts = name.startswith(q)
        year = x.get("y") or 0
        return (exact, starts, year)
    films.sort(key=key, reverse=True)
    return films[0]


def imdb_hi_res_from_url(url: str, prefer_height: int = 3000) -> List[str]:
    """Given an IMDb/Amazon image URL, build hi‑res variants (UY/UX).
    Example in: https://m.media-amazon.com/images/M/...._V1_.jpg
    Out: [..._V1_FMjpg_UY3000_.jpg, ..._V1_FMjpg_UX3000_.jpg, ...]
    """
    if "_V1_" not in url:
        # Insert the token just before extension
        url = re.sub(r"(\.(?:jpe?g|png|webp))(?:\?.*)?$", r"._V1_\1", url, flags=re.I)
    base, ext = re.split(r"(_V1_)", url, maxsplit=1)
    # Build a few descending candidates
    sizes_h = [4000, 3000, 2500, 2200, 2000]
    sizes_w = [4000, 3000, 2500, 2200, 2000]
    variants = []
    for h in sizes_h:
        variants.append(f"{base}_V1_FMjpg_UY{h}_" + ext.split("_V1_",1)[1])
    for w in sizes_w:
        variants.append(f"{base}_V1_FMjpg_UX{w}_" + ext.split("_V1_",1)[1])
    # Also include the plain original last
    variants.append(base + "_V1_.jpg")
    return variants


def fetch_poster_imdb(title: str, override_url: Optional[str] = None, min_height: int = 2000) -> Tuple[Optional[bytes], Optional[str]]:
    candidates: List[str] = []
    if override_url:
        candidates.extend(imdb_hi_res_from_url(override_url))
    else:
        js = imdb_suggest(title)
        picked = pick_imdb_title(js, title) if js else None
        img_url = (picked or {}).get("i", {}).get("imageUrl") if picked else None
        if not img_url:
            return None, None
        candidates.extend(imdb_hi_res_from_url(img_url))

    for url in candidates:
        try:
            data, w, h, ct = fetch_image_and_dims(url)
            if h >= min_height and h > w:  # portrait, tall enough
                ext = infer_ext(url, ct)
                return data, ext
        except Exception:
            continue
    return None, None

# ------------------------- Paramount Landscape ----------------------------

DUCK_URL = "https://duckduckgo.com/html/"
CBSI_HOST = "thumbnails.cbsig.net"
SIZE_TARGETS = [
    (7680, 4320), (5120, 2880), (4096, 2304), (3840, 2160), (3200, 1800), (3072, 1728), (2560, 1440), (2048, 1152), (2000, 1125)
]


def try_paramount_variants(url: str) -> List[str]:
    # Replace any widthxheight tokens with larger common sizes
    tokens = re.findall(r"(\d{3,5}x\d{3,5})", url)
    variants = []
    if tokens:
        for W, H in SIZE_TARGETS:
            u = url
            for t in set(tokens):
                u = u.replace(t, f"{W}x{H}")
            if u not in variants:
                variants.append(u)
    # ensure the original (last)
    if url not in variants:
        variants.append(url)
    return variants


def ddg_search_paramount(title: str, max_results: int = 10) -> List[str]:
    q = f"site:{CBSI_HOST} \"{title}\" 16 9"
    try:
        r = get(DUCK_URL + "?" + urllib.parse.urlencode({"q": q}), stream=False)
        html = r.text
        # Very rough parse: look for result links
        links = re.findall(r'<a[^>]+class=\"result__a\"[^>]+href=\"(.*?)\"', html)
        # Unescape and filter host
        outs = []
        for link in links:
            url = urllib.parse.unquote(link)
            if CBSI_HOST in url:
                outs.append(url)
        return outs[:max_results]
    except Exception:
        return []


def fetch_landscape_paramount(title: str, override_url: Optional[str] = None, min_width: int = 2000) -> Tuple[Optional[bytes], Optional[str]]:
    probe_list: List[str] = []
    if override_url:
        probe_list.extend(try_paramount_variants(override_url))
    else:
        for url in ddg_search_paramount(title, 12):
            probe_list.extend(try_paramount_variants(url))

    # de-dup while preserving order
    seen = set()
    ordered = []
    for u in probe_list:
        if u not in seen:
            seen.add(u)
            ordered.append(u)

    for url in ordered:
        try:
            data, w, h, ct = fetch_image_and_dims(url)
            if w >= min_width and w > h:  # landscape wide enough
                ext = infer_ext(url, ct)
                return data, ext
        except Exception:
            continue
    return None, None

# --------------------------------- main -----------------------------------

def main():
    title = input("Enter film title: ").strip()
    if not title:
        print("No title provided.")
        sys.exit(1)

    # Optional direct links
    print("(Optional) Paste a Paramount/CBSi 16:9 URL (leave blank to auto-search):")
    param_url = input().strip() or None
    print("(Optional) Paste an IMDb poster URL (leave blank to auto-find):")
    imdb_url = input().strip() or None

    clean = sanitize_filename(re.sub(r"\s+\(.*?\)$", "", title))

    # Poster
    poster_bytes, poster_ext = fetch_poster_imdb(title, imdb_url, min_height=2000)
    if poster_bytes is None:
        print("Could not find an IMDb poster ≥2000px for this title.")
    else:
        poster_path = f"{clean} - poster{poster_ext}"
        with open(poster_path, "wb") as f:
            f.write(poster_bytes)
        print(f"Saved: {poster_path}")

    # Landscape
    land_bytes, land_ext = fetch_landscape_paramount(title, param_url, min_width=2000)
    if land_bytes is None:
        print("Could not find a Paramount/CBSi 16:9 image ≥2000px for this title.")
    else:
        land_path = f"{clean} - 16x9{land_ext}"
        with open(land_path, "wb") as f:
            f.write(land_bytes)
        print(f"Saved: {land_path}")

    print("Done.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(130)

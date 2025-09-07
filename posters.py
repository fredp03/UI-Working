#!/usr/bin/env python3
"""
Download a movie's **poster** from **IMDb** and a **16:9 landscape** from **any source**
(found via **Google Images**, with a DuckDuckGo fallback) with **no API keys**.

Updates in this build
---------------------
• **No direct URL required** for the landscape — it always searches.
• **Landscape threshold lowered to 1080p**: requires width ≥ 1920 and landscape orientation.
• Still prefers images that match the poster's colors (Lab ΔE) and are close to 16:9.

What it does
------------
1) Prompts for a film title.
2) **Poster (IMDb)**
   • Uses IMDb's suggestion feed to find the title and its poster URL.
   • Probes hi‑res variants (UY/UX 6000→2000) and verifies the image is portrait and ≥2000 px tall.
   • Computes the poster's **average color in CIE Lab**.
3) **Landscape (ANY source)**
   • Performs **Google Images** search (large + wide) for "<title> movie still / key art / scene / 16:9".
   • If Google yields nothing (or blocks), falls back to DuckDuckGo HTML.
   • For each candidate image URL: downloads, verifies **width≥1920** & landscape, computes average Lab color,
     and scores by **ΔE to the poster color** + **closeness to 16:9** + **preference for larger width**.
   • Picks the best candidate and saves it.
4) Outputs in the current working directory:
      <Title> - poster.<ext>
      <Title> - 16x9.<ext>

Requirements
------------
Python 3.8+  •  pip install requests pillow

Notes
-----
• Searches hit public HTML pages (no APIs). If rate‑limited, try again later.
• Respect licenses if reusing images publicly.
"""

import io
import re
import sys
import os
import math
import html
import urllib.parse
from typing import List, Optional, Tuple

import requests
from PIL import Image

UA = {"User-Agent": "MovieImageFetcher/AnySource/1.1 (no-api-key)"}
TIMEOUT = 45

MIN_POSTER_HEIGHT = 2000        # keep posters high-res
MIN_LANDSCAPE_WIDTH = 1280      # Lowered from 1920 to 1280 (720p)
TARGET_AR = 16/9

# ----------------------------- utilities ------------------------------------

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


def get(url: str, stream: bool = True, timeout: int = TIMEOUT) -> requests.Response:
    r = requests.get(url, headers=UA, stream=stream, timeout=timeout)
    r.raise_for_status()
    return r


def fetch_image_and_dims(url: str) -> Tuple[bytes, int, int, str]:
    r = get(url, stream=True)
    data = r.content
    ct = r.headers.get("Content-Type", "")
    with Image.open(io.BytesIO(data)) as im:
        w, h = im.size
    return data, w, h, ct

# ----------------------------- color utils ----------------------------------

# Minimal sRGB -> Lab conversion (CIE76 ΔE)

def srgb_to_linear(c: float) -> float:
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb_to_xyz(r: int, g: int, b: int) -> Tuple[float, float, float]:
    R = srgb_to_linear(r)
    G = srgb_to_linear(g)
    B = srgb_to_linear(b)
    X = R * 0.4124 + G * 0.3576 + B * 0.1805
    Y = R * 0.2126 + G * 0.7152 + B * 0.0722
    Z = R * 0.0193 + G * 0.1192 + B * 0.9505
    return X, Y, Z


def f_lab(t: float) -> float:
    eps = 216/24389
    kappa = 24389/27
    return t ** (1/3) if t > eps else (kappa * t + 16) / 116


def xyz_to_lab(X: float, Y: float, Z: float) -> Tuple[float, float, float]:
    Xn, Yn, Zn = 0.95047, 1.00000, 1.08883  # D65
    fx, fy, fz = f_lab(X / Xn), f_lab(Y / Yn), f_lab(Z / Zn)
    L = 116 * fy - 16
    a = 500 * (fx - fy)
    b = 200 * (fy - fz)
    return L, a, b


def avg_color_lab(img_bytes: bytes) -> Tuple[float, float, float]:
    with Image.open(io.BytesIO(img_bytes)) as im:
        im = im.convert("RGB")
        im = im.resize((64, 64))
        pixels = list(im.getdata())
    r = sum(p[0] for p in pixels) / len(pixels)
    g = sum(p[1] for p in pixels) / len(pixels)
    b = sum(p[2] for p in pixels) / len(pixels)
    X, Y, Z = rgb_to_xyz(int(r), int(g), int(b))
    return xyz_to_lab(X, Y, Z)


def delta_e_cie76(lab1: Tuple[float, float, float], lab2: Tuple[float, float, float]) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(lab1, lab2)))

# ----------------------------- IMDb poster ----------------------------------

SUGGEST_BASE = "https://v2.sg.media-imdb.com/suggestion/{letter}/{slug}.json"


def imdb_suggest(title: str) -> Optional[dict]:
    slug = re.sub(r"\s+", "_", title).strip()
    if not slug:
        return None
    url = SUGGEST_BASE.format(letter=slug[0].lower(), slug=urllib.parse.quote(slug))
    try:
        r = get(url, stream=False)
        return r.json()
    except Exception:
        return None


def pick_imdb_title(js: dict, query: str) -> Optional[dict]:
    items = (js or {}).get("d", [])
    if not items:
        return None
    q = query.lower().strip()
    films = [x for x in items if x.get("id", "").startswith("tt") and (x.get("qid") in ("feature", "movie", "title") or x.get("q") in ("feature", "movie"))]
    if not films:
        films = items
    def key(x):
        name = (x.get("l") or "").lower()
        exact = (name == q)
        starts = name.startswith(q)
        year = x.get("y") or 0
        return (exact, starts, year)
    films.sort(key=key, reverse=True)
    return films[0]

IMDB_URL_RE = re.compile(
    r"^(?P<prefix>.+?)"               # everything before _V1_ (non-greedy)
    r"(?:_V1_(?P<flags>[^.]*)?)?"      # optional _V1_ and any flags up to the dot
    r"\.(?P<ext>jpe?g|png|webp)"      # extension
    r"(?P<qs>\?.*)?$",                # optional query string
    re.IGNORECASE,
)


def imdb_hi_res_variants(url: str) -> List[str]:
    m = IMDB_URL_RE.match(url)
    if not m:
        return [url]
    prefix = m.group("prefix")
    ext = m.group("ext")
    qs = m.group("qs") or ""
    heights = [6000, 5000, 4000, 3500, 3000, 2500, 2200, 2000]
    widths  = [6000, 5000, 4000, 3500, 3000, 2500, 2200, 2000]
    variants: List[str] = []
    for h in heights:
        variants.append(f"{prefix}_V1_FMjpg_UY{h}_.{ext}{qs}")
    for w in widths:
        variants.append(f"{prefix}_V1_FMjpg_UX{w}_.{ext}{qs}")
    variants.append(f"{prefix}_V1_.{ext}{qs}")
    return variants


def fetch_poster_imdb(title: str, min_height: int = MIN_POSTER_HEIGHT) -> Tuple[Optional[bytes], Optional[str], Optional[Tuple[float,float,float]]]:
    js = imdb_suggest(title)
    picked = pick_imdb_title(js, title) if js else None
    img_url = (picked or {}).get("i", {}).get("imageUrl") if picked else None
    if not img_url:
        return None, None, None
    for url in imdb_hi_res_variants(img_url):
        try:
            data, w, h, ct = fetch_image_and_dims(url)
            if h >= min_height and h > w:
                poster_lab = avg_color_lab(data)
                ext = infer_ext(url, ct)
                return data, ext, poster_lab
        except Exception:
            continue
    return None, None, None

# ------------------------- Google/DDG image search ---------------------------

def google_image_search_any(title: str, max_results: int = 40) -> List[str]:
    urls = []
    
    # Multiple search strategies with different queries
    search_terms = [
        f'"{title}" movie wallpaper landscape',
        f'"{title}" film background landscape',
        f'"{title}" movie poster landscape horizontal',
        f'"{title}" movie scene landscape',
        f'"{title}" film still landscape',
        f'"{title}" movie backdrop',
        f'{title} movie wallpaper',
        f'{title} film landscape',
        f'"{title}" movie horizontal',
    ]
    
    for query in search_terms:
        # Try both regular search and image search
        search_urls = [
            f"https://www.google.com/search?q={urllib.parse.quote(query)}&tbm=isch&tbs=isz:l,iar:w",
            f"https://www.google.com/search?q={urllib.parse.quote(query)}&tbm=isch&tbs=isz:m,iar:w",
        ]
        
        for search_url in search_urls:
            try:
                r = get(search_url, stream=False, timeout=30)
                html_text = r.text
                
                # Debug: Save a sample of the HTML to see what we're getting
                if not urls and query == search_terms[0]:
                    print(f"Sample HTML length: {len(html_text)} chars")
                    if "Our systems have detected unusual traffic" in html_text:
                        print("WARNING: Google has detected unusual traffic and may be blocking requests")
                
                # Multiple regex patterns to extract image URLs
                patterns = [
                    r'"ou":"([^"]+)"',  # Original URL in new format
                    r'imgurl=([^&]+)',  # Classic imgurl format
                    r'"src":"([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"',  # Direct src URLs
                    r'https?://[^"\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"\s<>]*)?',  # Any direct image URLs
                    r'"url":"([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"',  # Alternative URL format
                ]
                
                for pattern in patterns:
                    matches = re.findall(pattern, html_text, flags=re.I)
                    for match in matches:
                        try:
                            decoded_url = urllib.parse.unquote(html.unescape(match))
                            # Skip thumbnails and cached images
                            if any(host in decoded_url.lower() for host in 
                                  ("gstatic.com", "googleusercontent.com", "encrypted-tbn0", 
                                   "ggpht.com", "blogger.com", "bp.blogspot.com")):
                                continue
                            # Skip very small or obviously thumbnail URLs
                            if any(thumb in decoded_url.lower() for thumb in 
                                  ("thumb", "small", "mini", "icon", "avatar", "profile")):
                                continue
                            if decoded_url.startswith('http') and decoded_url not in urls:
                                urls.append(decoded_url)
                        except Exception:
                            continue
                            
            except Exception as e:
                print(f"Google search failed for '{query}': {e}")
                continue
                
            # Don't overwhelm the search - limit per query
            if len(urls) >= max_results:
                break
        
        if len(urls) >= max_results:
            break
    
    print(f"Google search extracted {len(urls)} URLs")
    return urls[:max_results]


def ddg_image_search_any(title: str, max_results: int = 40) -> List[str]:
    search_terms = [
        f'"{title}" movie wallpaper landscape',
        f'"{title}" film background',
        f'"{title}" movie backdrop',
        f'{title} movie wallpaper',
        f'{title} film horizontal',
    ]
    
    urls = []
    for query in search_terms:
        try:
            r = get("https://duckduckgo.com/html/?" + urllib.parse.urlencode({"q": query}), stream=False)
            html_text = r.text
            found_urls = re.findall(r'https?://[^"\s]+\.(?:jpg|jpeg|png|webp)', html_text, flags=re.I)
            for u in found_urls:
                decoded_url = html.unescape(u)
                if any(host in decoded_url.lower() for host in 
                      ("gstatic.com", "googleusercontent.com", "encrypted-tbn0", "duckduckgo.com")):
                    continue
                if decoded_url not in urls:
                    urls.append(decoded_url)
            
            if len(urls) >= max_results:
                break
                
        except Exception as e:
            print(f"DuckDuckGo search failed for '{query}': {e}")
            continue
    
    print(f"DuckDuckGo search extracted {len(urls)} URLs")
    return urls[:max_results]


def bing_image_search_any(title: str, max_results: int = 40) -> List[str]:
    """Bing image search as a fallback option"""
    urls = []
    search_terms = [
        f'"{title}" movie wallpaper landscape',
        f'"{title}" film background',
        f'{title} movie backdrop',
        f'{title} film landscape',
    ]
    
    for query in search_terms:
        try:
            search_url = f"https://www.bing.com/images/search?q={urllib.parse.quote(query)}&qft=+filterui:imagesize-large+filterui:aspect-wide"
            r = get(search_url, stream=False, timeout=30)
            html_text = r.text
            
            # Bing specific patterns - improved to handle JSON properly
            patterns = [
                r'"murl":"([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"',  # Media URL with image extension
                r'"imgurl":"([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"',  # Image URL with image extension
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, html_text, flags=re.I)
                for match in matches:
                    try:
                        # Decode JSON-escaped URL
                        decoded_url = match.replace('\\/', '/').replace('\\u0026', '&')
                        decoded_url = urllib.parse.unquote(decoded_url)
                        
                        # Skip Bing thumbnails and cached images
                        if any(host in decoded_url.lower() for host in 
                              ("th.bing.com", "tse1.mm.bing.net", "tse2.mm.bing.net", "tse3.mm.bing.net", "tse4.mm.bing.net")):
                            continue
                            
                        # Only add valid HTTP(S) URLs
                        if decoded_url.startswith('http') and decoded_url not in urls:
                            urls.append(decoded_url)
                    except Exception:
                        continue
                        
        except Exception as e:
            print(f"Bing search failed for '{query}': {e}")
            continue
            
        if len(urls) >= max_results:
            break
    
    print(f"Bing search extracted {len(urls)} URLs")
    return urls[:max_results]

def try_free_image_apis(title: str) -> List[str]:
    """Try free image APIs that don't require authentication"""
    urls = []
    
    # Try Unsplash (doesn't require API key for basic search)
    try:
        search_query = f"{title} movie film cinema"
        unsplash_url = f"https://unsplash.com/napi/search/photos?query={urllib.parse.quote(search_query)}&per_page=20"
        r = get(unsplash_url, stream=False, timeout=20)
        data = r.json()
        
        if 'results' in data:
            for result in data['results']:
                if 'urls' in result and 'regular' in result['urls']:
                    urls.append(result['urls']['regular'])
                    
        print(f"Unsplash API found {len(urls)} images")
    except Exception as e:
        print(f"Unsplash search failed: {e}")
    
    # Try Pixabay (has a public API)
    try:
        search_query = f"{title} movie film"
        pixabay_url = f"https://pixabay.com/api/?key=9656065-a4094594c34f515e1acb2da5c&q={urllib.parse.quote(search_query)}&image_type=photo&min_width=1280&category=film"
        r = get(pixabay_url, stream=False, timeout=20)
        data = r.json()
        
        if 'hits' in data:
            for hit in data['hits']:
                if 'largeImageURL' in hit:
                    urls.append(hit['largeImageURL'])
                elif 'webformatURL' in hit:
                    urls.append(hit['webformatURL'])
                    
        print(f"Pixabay API found {len(data.get('hits', []))} additional images")
    except Exception as e:
        print(f"Pixabay search failed: {e}")
    
    return urls


def try_movie_databases(title: str) -> List[str]:
    """Try to find movie images from specific movie databases and wallpaper sites"""
    urls = []
    
    # Try TMDB (The Movie Database) which has a public API
    try:
        # Search for the movie first
        search_url = f"https://api.themoviedb.org/3/search/movie?api_key=e5be1453a23ffc7b8236ed3f0406d383&query={urllib.parse.quote(title)}"
        r = get(search_url, stream=False, timeout=20)
        data = r.json()
        
        if 'results' in data and len(data['results']) > 0:
            movie = data['results'][0]  # Take the first result
            movie_id = movie.get('id')
            
            if movie_id:
                # Get movie images
                images_url = f"https://api.themoviedb.org/3/movie/{movie_id}/images?api_key=e5be1453a23ffc7b8236ed3f0406d383"
                r = get(images_url, stream=False, timeout=20)
                images_data = r.json()
                
                # Get backdrops (landscape images)
                if 'backdrops' in images_data:
                    for backdrop in images_data['backdrops']:
                        if 'file_path' in backdrop:
                            # Use original size
                            image_url = f"https://image.tmdb.org/t/p/original{backdrop['file_path']}"
                            urls.append(image_url)
                            
        print(f"TMDB API found {len(urls)} backdrop images")
    except Exception as e:
        print(f"TMDB search failed: {e}")
    
    # Clean title for URL use
    clean_title = re.sub(r'[^\w\s-]', '', title).strip()
    url_title = clean_title.replace(' ', '-').lower()
    
    # Try some direct wallpaper URLs (these often work)
    direct_urls = [
        f"https://images.wallpapersden.com/image/download/{url_title}_1920x1080.jpg",
        f"https://wallpaperaccess.com/full/{url_title}.jpg",
        f"https://w0.peakpx.com/wallpaper/{url_title}-wallpaper.jpg",
    ]
    urls.extend(direct_urls)
    
    print(f"Movie database search found {len(urls)} potential URLs")
    return urls

def score_landscape(candidate_bytes: bytes, w: int, h: int, poster_lab: Tuple[float,float,float]) -> float:
    # Lower score is better
    try:
        lab = avg_color_lab(candidate_bytes)
        de = delta_e_cie76(lab, poster_lab)
    except Exception:
        de = 50.0  # Reduced penalty for color matching failure
    
    ar = w / h
    ar_pen = abs(ar - TARGET_AR) * 0.5  # Reduced aspect ratio penalty
    size_bonus = math.log(max(w, 1920), 2) / 15.0  # Better size bonus
    
    # Prefer wider images but don't penalize too much
    width_bonus = max(0, (w - 1920) / 10000.0)
    
    score = (de / 80.0) + ar_pen - size_bonus - width_bonus
    return score


def fetch_best_landscape_any(title: str, poster_lab: Tuple[float,float,float], min_width: int = MIN_LANDSCAPE_WIDTH) -> Tuple[Optional[bytes], Optional[str]]:
    print(f"Searching for landscape images for '{title}'...")
    
    # Try multiple sources in order of reliability
    probe: List[str] = []
    
    # Try movie databases with APIs first (most reliable)
    movie_db_urls = try_movie_databases(title)
    probe.extend(movie_db_urls)
    
    # Try free image APIs
    if len(probe) < 10:
        api_urls = try_free_image_apis(title)
        probe.extend(api_urls)
    
    # Try search engines as fallback
    if len(probe) < 20:
        google_urls = google_image_search_any(title, 30)
        probe.extend(google_urls)
    
    if len(probe) < 30:
        ddg_urls = ddg_image_search_any(title, 20)
        probe.extend(ddg_urls)
    
    if len(probe) < 40:
        bing_urls = bing_image_search_any(title, 20)
        probe.extend(bing_urls)

    # Deduplicate while preserving order
    seen = set()
    ordered: List[str] = []
    for u in probe:
        if u not in seen:
            seen.add(u)
            ordered.append(u)

    print(f"Total unique URLs to check: {len(ordered)}")
    
    if len(ordered) == 0:
        print("No URLs found from any source. This might indicate connectivity issues or rate limiting.")
        return None, None
    
    best = None  # (score, data, ext)
    checked = 0
    valid_candidates = 0
    
    for i, url in enumerate(ordered):
        if i % 10 == 0 and i > 0:
            print(f"Checked {i}/{len(ordered)} URLs, found {valid_candidates} valid candidates...")
            
        try:
            data, w, h, ct = fetch_image_and_dims(url)
        except Exception as e:
            if i < 3:  # Show first few errors for debugging
                print(f"Failed to fetch {url[:80]}...: {str(e)[:100]}")
            continue
            
        checked += 1
        
        # More lenient size requirements
        if w < min_width:
            continue
            
        # Allow some portrait images if they're close to landscape
        ar = w / h
        if ar < 1.2:  # Still prefer landscape but allow closer to square
            continue
            
        valid_candidates += 1
        score = score_landscape(data, w, h, poster_lab)
        
        if best is None or score < best[0]:
            ext = infer_ext(url, ct)
            best = (score, data, ext)
            print(f"New best candidate: {w}x{h}, aspect ratio: {ar:.2f}, score: {score:.2f}")
        
        # If we found a really good candidate, don't search forever
        if best and best[0] < 0.3 and valid_candidates >= 2:
            print("Found a good candidate, stopping search early.")
            break
            
        if checked >= 100:  # Safety cap
            break

    print(f"Checked {checked} images, found {valid_candidates} valid landscape candidates")
    
    if best:
        return best[1], best[2]
    return None, None

# --------------------------------- main -------------------------------------

def extract_actual_image_url(url):
    """Extract the actual image URL from Google Images or other redirect URLs"""
    try:
        # Handle Google Images URLs
        if 'google.com' in url and '&url=' in url:
            # Extract the actual URL from Google's redirect
            parsed = urllib.parse.urlparse(url)
            params = urllib.parse.parse_qs(parsed.query)
            if 'url' in params:
                actual_url = urllib.parse.unquote(params['url'][0])
                return actual_url
        
        # For other URLs, return as-is
        return url
    except:
        return url

def main():
    title = input("Enter film title: ").strip()
    if not title:
        print("No title provided.")
        sys.exit(1)

    clean = sanitize_filename(re.sub(r"\s+\(.*?\)$", "", title))

    # Always save to the specific project directories, regardless of where script is run
    poster_dir = "/Users/fredparsons/Documents/Side Projects/UI Working/media/Images/Posters"
    thumbnail_dir = "/Users/fredparsons/Documents/Side Projects/UI Working/media/Images/Thumbnails"
    
    os.makedirs(poster_dir, exist_ok=True)
    os.makedirs(thumbnail_dir, exist_ok=True)

    # Poster (IMDb)
    poster_bytes, poster_ext, poster_lab = fetch_poster_imdb(title, min_height=MIN_POSTER_HEIGHT)
    if poster_bytes is None or poster_lab is None:
        print("Could not find an IMDb poster ≥2000px for this title.")
    else:
        poster_path = os.path.join(poster_dir, f"{clean} - poster{poster_ext}")
        with open(poster_path, "wb") as f:
            f.write(poster_bytes)
        print(f"Saved: {poster_path}")

    # Landscape image - ask for direct URL
    landscape_url = input("Enter landscape image URL (or press Enter to skip): ").strip()
    
    if landscape_url:
        try:
            # Extract actual image URL if it's a redirect
            actual_url = extract_actual_image_url(landscape_url)
            print(f"Downloading landscape image from: {actual_url}")
            
            data, w, h, ct = fetch_image_and_dims(actual_url)
            
            # Verify it's reasonably landscape-oriented
            ar = w / h
            if ar >= 1.2:  # At least somewhat landscape
                land_ext = infer_ext(actual_url, ct)
                land_path = os.path.join(thumbnail_dir, f"{clean} - 16x9{land_ext}")
                with open(land_path, "wb") as f:
                    f.write(data)
                print(f"Saved: {land_path} ({w}x{h}, aspect ratio: {ar:.2f})")
            else:
                print(f"Warning: Image is not landscape-oriented ({w}x{h}, aspect ratio: {ar:.2f})")
                save_anyway = input("Save anyway? (y/n): ").strip().lower()
                if save_anyway == 'y':
                    land_ext = infer_ext(actual_url, ct)
                    land_path = os.path.join(thumbnail_dir, f"{clean} - 16x9{land_ext}")
                    with open(land_path, "wb") as f:
                        f.write(data)
                    print(f"Saved: {land_path}")
                else:
                    print("Landscape image not saved.")
        except Exception as e:
            print(f"Failed to download landscape image: {e}")
            print("Tip: Make sure to use a direct image URL (right-click on image → 'Copy image address')")
    else:
        print("No landscape URL provided, skipping landscape image.")

    print("Done.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(130)

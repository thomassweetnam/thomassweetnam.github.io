#!/usr/bin/env python3
"""Scrape AKC dog breed listings into local data and image assets."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen


BASE_URL = "https://www.akc.org/dog-breeds/"
BREED_PAGE_PROPS_PATTERN = re.compile(
    r'<div data-js-component="breedPage" data-js-props="(.*?)">',
    re.DOTALL,
)
HEIGHT_PATTERN = re.compile(r'<Attribute name="height">([^<]+)</Attribute>')
WEIGHT_PATTERN = re.compile(r'<Attribute name="weight">([^<]+)</Attribute>')
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
)
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


class BreedListingParser(HTMLParser):
    """Extract breed cards from AKC listing pages."""

    def __init__(self) -> None:
        super().__init__()
        self.cards: list[dict[str, str]] = []
        self._card_depth: int | None = None
        self._current: dict[str, str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {key: value or "" for key, value in attrs}

        if tag == "div":
            class_names = set(attr_map.get("class", "").split())
            if self._card_depth is None and "breed-type-card" in class_names:
                self._card_depth = 1
                self._current = {
                    "name": attr_map.get("data-title", "").strip(),
                    "akc_id": attr_map.get("data-id", "").strip(),
                }
                return

            if self._card_depth is not None:
                self._card_depth += 1

        if self._card_depth is None or self._current is None:
            return

        if tag == "a" and "/dog-breeds/" in attr_map.get("href", "") and not self._current.get("breed_url"):
            self._current["breed_url"] = attr_map["href"].strip()

        if tag == "img" and not self._current.get("image_url"):
            image_url = attr_map.get("data-src") or attr_map.get("src", "")
            if image_url and "wp-content/uploads/" in image_url:
                self._current["image_url"] = image_url.strip()
                self._current["image_alt"] = attr_map.get("alt", "").strip()

    def handle_endtag(self, tag: str) -> None:
        if tag != "div" or self._card_depth is None:
            return

        self._card_depth -= 1
        if self._card_depth != 0:
            return

        assert self._current is not None
        if all(self._current.get(field) for field in ("name", "breed_url", "image_url")):
            self.cards.append(self._current)

        self._current = None
        self._card_depth = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape all AKC dog breeds and save local assets for the tournament site."
    )
    parser.add_argument(
        "--output-root",
        default="docs",
        help="Directory where the local site and generated data live. Default: docs",
    )
    parser.add_argument(
        "--delay-seconds",
        type=float,
        default=0.1,
        help="Delay between outbound requests in seconds. Default: 0.1",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=30.0,
        help="HTTP timeout in seconds. Default: 30",
    )
    parser.add_argument(
        "--force-images",
        action="store_true",
        help="Re-download images even if they already exist locally.",
    )
    return parser.parse_args()


def fetch_bytes(url: str, timeout_seconds: float, delay_seconds: float) -> bytes:
    last_error: Exception | None = None
    request = Request(url, headers=REQUEST_HEADERS)

    for attempt in range(3):
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                payload = response.read()
            if delay_seconds > 0:
                time.sleep(delay_seconds)
            return payload
        except Exception as exc:  # pragma: no cover - network failure path
            last_error = exc
            wait_seconds = 0.75 * (attempt + 1)
            time.sleep(wait_seconds)

    assert last_error is not None
    raise RuntimeError(f"Failed to fetch {url}: {last_error}") from last_error


def fetch_text(url: str, timeout_seconds: float, delay_seconds: float) -> str:
    return fetch_bytes(url, timeout_seconds, delay_seconds).decode("utf-8", errors="replace")


def extract_max_page_number(html: str) -> int:
    page_numbers = [int(match) for match in re.findall(r"/dog-breeds/page/(\d+)/", html)]
    return max(page_numbers, default=1)


def build_page_url(page_number: int) -> str:
    if page_number == 1:
        return BASE_URL
    return urljoin(BASE_URL, f"page/{page_number}/")


def slug_from_breed_url(breed_url: str) -> str:
    return urlsplit(breed_url).path.rstrip("/").split("/")[-1]


def image_suffix(image_url: str) -> str:
    suffix = Path(urlsplit(image_url).path).suffix.lower()
    return suffix if suffix else ".jpg"


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_js_data(path: Path, breeds: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "// Generated by scripts/scrape_akc_breeds.py",
        f"window.BREEDS = {json.dumps(breeds, ensure_ascii=False, indent=2)};",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def parse_attribute_value(page_html: str, pattern: re.Pattern[str], prefix: str) -> str:
    match = pattern.search(page_html)
    if not match:
        return ""
    value = html.unescape(match.group(1)).strip()
    if value.startswith(prefix):
        value = value[len(prefix):]
    return value


def parse_weight_numbers(weight_text: str) -> list[float]:
    return [float(value) for value in re.findall(r"\d+(?:\.\d+)?", weight_text)]


def derive_size_category(weight_text: str) -> str:
    values = parse_weight_numbers(weight_text)
    if not values:
        return "unknown"

    max_weight = max(values)
    if max_weight <= 20:
        return "small"
    if max_weight <= 50:
        return "medium"
    return "large"


def derive_fluffy(coat_length: list[str], coat_type: list[str]) -> bool:
    lengths = set(coat_length)
    types = set(coat_type)

    if "Hairless" in types:
        return False
    if "Long" in lengths:
        return True
    if "Double" in types:
        return True
    if lengths.intersection({"Medium", "Long"}) and types.intersection({"Rough", "Curly", "Wavy", "Corded"}):
        return True
    return False


def parse_breed_profile(page_html: str) -> dict[str, Any]:
    props_match = BREED_PAGE_PROPS_PATTERN.search(page_html)
    if not props_match:
        raise RuntimeError("Could not locate breedPage props on breed profile.")

    props = json.loads(html.unescape(props_match.group(1)))
    current_breed = props["settings"]["current_breed"]
    breed_data = props["settings"]["breed_data"]
    basics = breed_data["basics"][current_breed]
    traits_block = breed_data["traits"][current_breed]
    traits = traits_block.get("traits", {})

    def trait_score(trait_key: str) -> int | None:
        score = traits.get(trait_key, {}).get("score")
        return int(score) if score is not None else None

    def trait_selected(trait_key: str) -> list[str]:
        selected = traits.get(trait_key, {}).get("selected") or []
        return [
            str(value)
            for value in selected
            if str(value).strip() and str(value).strip() != "0"
        ]

    related_characteristics = [
        item.strip()
        for item in (basics.get("related_groups_characteristics") or "").split(",")
        if item.strip()
    ]
    coat_length = trait_selected("coat_length")
    coat_type = trait_selected("coat_type")
    height = parse_attribute_value(page_html, HEIGHT_PATTERN, "Height: ")
    weight = parse_attribute_value(page_html, WEIGHT_PATTERN, "Weight: ")
    size_category = derive_size_category(weight)

    return {
        "breedGroup": basics.get("breed_group", ""),
        "origin": basics.get("origin", ""),
        "temperament": traits_block.get("temperament", ""),
        "lifeExpectancy": basics.get("life_expectancy", ""),
        "height": height,
        "weight": weight,
        "relatedCharacteristics": related_characteristics,
        "traits": {
            "adaptabilityLevel": trait_score("adaptability_level"),
            "affectionateWithFamily": trait_score("affectionate_with_family"),
            "barkingLevel": trait_score("barking_level"),
            "coatGroomingFrequency": trait_score("coat_grooming_frequency"),
            "coatLength": coat_length,
            "coatType": coat_type,
            "droolingLevel": trait_score("drooling_level"),
            "energyLevel": trait_score("energy_level"),
            "goodWithOtherDogs": trait_score("good_with_other_dogs"),
            "goodWithYoungChildren": trait_score("good_with_young_children"),
            "mentalStimulationNeeds": trait_score("mental_stimulation_needs"),
            "opennessToStrangers": trait_score("openness_to_strangers"),
            "playfulnessLevel": trait_score("playfulness_level"),
            "sheddingLevel": trait_score("shedding_level"),
            "trainabilityLevel": trait_score("trainability_level"),
            "watchdogProtectiveNature": trait_score("watchdogprotective_nature"),
        },
        "sizeCategory": size_category,
        "isFluffy": derive_fluffy(coat_length, coat_type),
    }


def download_image(image_url: str, destination: Path, timeout_seconds: float, delay_seconds: float) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_path = destination.with_suffix(destination.suffix + ".part")
    payload = fetch_bytes(image_url, timeout_seconds, delay_seconds)
    temp_path.write_bytes(payload)
    temp_path.replace(destination)


def scrape_listing_pages(timeout_seconds: float, delay_seconds: float) -> list[dict[str, str]]:
    first_page_html = fetch_text(BASE_URL, timeout_seconds, delay_seconds)
    max_page = extract_max_page_number(first_page_html)
    print(f"Discovered {max_page} breed listing pages.", file=sys.stderr)

    breeds_by_slug: dict[str, dict[str, str]] = {}

    for page_number in range(1, max_page + 1):
        page_url = build_page_url(page_number)
        if page_number == 1:
            html = first_page_html
        else:
            print(f"Fetching listing page {page_number}/{max_page}: {page_url}", file=sys.stderr)
            html = fetch_text(page_url, timeout_seconds, delay_seconds)

        parser = BreedListingParser()
        parser.feed(html)

        if not parser.cards:
            raise RuntimeError(f"No breed cards found on page {page_number}: {page_url}")

        for card in parser.cards:
            slug = slug_from_breed_url(card["breed_url"])
            breeds_by_slug[slug] = {
                "akcId": card.get("akc_id", ""),
                "name": card["name"],
                "slug": slug,
                "breedUrl": card["breed_url"],
                "imageUrl": card["image_url"],
                "imageAlt": card.get("image_alt") or card["name"],
            }

    breeds = sorted(breeds_by_slug.values(), key=lambda breed: breed["name"].casefold())
    print(f"Collected {len(breeds)} unique breeds.", file=sys.stderr)
    return breeds


def materialize_dataset(
    breeds: list[dict[str, str]],
    output_root: Path,
    timeout_seconds: float,
    delay_seconds: float,
    force_images: bool,
) -> list[dict[str, Any]]:
    images_dir = output_root / "assets" / "images"
    finalized: list[dict[str, Any]] = []

    for index, breed in enumerate(breeds, start=1):
        extension = image_suffix(breed["imageUrl"])
        filename = f"{breed['slug']}{extension}"
        image_path = images_dir / filename

        print(f"Fetching breed profile {index}/{len(breeds)}: {breed['name']}", file=sys.stderr)
        profile_html = fetch_text(breed["breedUrl"], timeout_seconds, delay_seconds)
        profile = parse_breed_profile(profile_html)

        if force_images or not image_path.exists() or image_path.stat().st_size == 0:
            print(f"Downloading image {index}/{len(breeds)}: {breed['name']}", file=sys.stderr)
            download_image(breed["imageUrl"], image_path, timeout_seconds, delay_seconds)

        finalized.append(
            {
                "akcId": breed["akcId"],
                "name": breed["name"],
                "slug": breed["slug"],
                "breedUrl": breed["breedUrl"],
                "imageUrl": breed["imageUrl"],
                "imageAlt": breed["imageAlt"],
                "imagePath": f"assets/images/{filename}",
                "breedGroup": profile["breedGroup"],
                "origin": profile["origin"],
                "temperament": profile["temperament"],
                "lifeExpectancy": profile["lifeExpectancy"],
                "height": profile["height"],
                "weight": profile["weight"],
                "relatedCharacteristics": profile["relatedCharacteristics"],
                "traits": profile["traits"],
                "sizeCategory": profile["sizeCategory"],
                "isFluffy": profile["isFluffy"],
            }
        )

    return finalized


def main() -> int:
    args = parse_args()
    output_root = Path(args.output_root).resolve()
    data_dir = output_root / "data"

    breeds = scrape_listing_pages(args.timeout_seconds, args.delay_seconds)
    finalized = materialize_dataset(
        breeds=breeds,
        output_root=output_root,
        timeout_seconds=args.timeout_seconds,
        delay_seconds=args.delay_seconds,
        force_images=args.force_images,
    )

    write_json(data_dir / "breeds.json", finalized)
    write_js_data(data_dir / "breeds.js", finalized)

    manifest = {
        "source": BASE_URL,
        "breedCount": len(finalized),
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    write_json(data_dir / "manifest.json", manifest)

    print(
        f"Saved {len(finalized)} breeds, images, and manifests into {output_root}.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:  # pragma: no cover - interactive abort
        print("Scrape cancelled.", file=sys.stderr)
        raise SystemExit(130)

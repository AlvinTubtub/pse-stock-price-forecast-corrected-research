"""Manual approved generation. Development smoke never writes operational history."""
import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.operational_deployment import generate, OUTPUT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--development-smoke", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.development_smoke and not args.output:
        parser.error("--development-smoke requires isolated --output")
    logging.basicConfig(level=logging.INFO, format="[operational] %(message)s")
    try:
        generate(output=args.output or OUTPUT, symbols=["ALI", "BPI"] if args.development_smoke else None,
                 development=args.development_smoke)
    except Exception as exc:
        logging.error("Generation stopped without publishing a partial batch: %s", exc)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

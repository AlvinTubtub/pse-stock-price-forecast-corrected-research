"""Export only complete approved operational batches; never rewrite legacy or formal results."""
from pathlib import Path
from services.operational_deployment import BASE, OUTPUT, atomic_json, load_manifest, read_json, validate_batch


def export_operational(output: Path = BASE.parent / "frontend/public/forecasts"):
    payload = read_json(OUTPUT / "current.json")
    # The current issuance can legitimately remain on the previous deployment
    # after a same-target refit. Export the manifest that actually issued it.
    manifest, sha = load_manifest(version=payload["deploymentVersion"])
    validate_batch(payload, manifest, sha)
    atomic_json(output / "operational.json", payload)
    atomic_json(output / "deployment.json", manifest)
    print(f"[export] Exported {len(payload['forecasts'])} approved forecasts with promotion boundary")

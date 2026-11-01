import argparse
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

from .export import validate_public
from .pipeline import update
from .review import report
from .models import Profile
import yaml


def main():
    parser = argparse.ArgumentParser(description="MiyaJob: verified publication, private evidence")
    parser.add_argument("command", choices=["update", "validate", "report"])
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--profile", type=Path, default=Path("config/profile.yaml"))
    parser.add_argument("--sources", type=Path)
    parser.add_argument("--import", dest="import_path", type=Path)
    parser.add_argument("--network", action="store_true", help="Use only explicitly approved source policies")
    args = parser.parse_args()
    today = datetime.now(ZoneInfo("Asia/Tokyo")).date()
    try:
        if args.command == "report":
            profile = Profile.model_validate(yaml.safe_load(args.profile.read_text(encoding='utf-8-sig'))) if args.profile.exists() else None
            print(json.dumps(report(args.root, today, profile), ensure_ascii=False))
        elif args.command == "validate":
            data = validate_public(args.root / "web/public/jobs.json", today)
            print(json.dumps({"public_valid":True,"count":len(data.jobs)}))
        else:
            print(json.dumps(update(args.root, args.profile, args.sources, args.import_path, args.network, today), ensure_ascii=False))
    except Exception as exc:
        # Avoid serializing profiles or raw HTML to CI logs.
        parser.exit(1, f"{type(exc).__name__}: {str(exc) if isinstance(exc, ValueError) and not hasattr(exc, 'errors') else '処理に失敗しました。入力・接続・権限をローカルで確認してください。公開成功とは扱いません。'}\n")


if __name__ == "__main__":
    main()

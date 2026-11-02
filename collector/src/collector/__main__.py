import argparse
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

from .export import validate_public
from .pipeline import update
from .review import report
from .models import Profile, ReviewData
from .public_review import validate_review
from .modes import collect, investigation_queue
import yaml


def main():
    parser = argparse.ArgumentParser(description="MiyaJob: verified publication, private evidence")
    parser.add_argument("command", choices=["update", "validate", "report", "queue"])
    parser.add_argument("--mode", choices=['collect', 'investigate'], default='collect', help='通常更新は新規収集。詳細調査は明示指定')
    parser.add_argument("--discoveries", type=Path, help='企業・募集・IT職・地域・出典を簡易確認した新規候補の公開要約JSON')
    parser.add_argument("--ids", nargs='+', help='詳細調査する既存求人ID')
    parser.add_argument("--limit", type=int, default=10, help='詳細調査の対象上限（既定10件）')
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--profile", type=Path, default=Path("config/profile.yaml"))
    parser.add_argument("--sources", type=Path)
    parser.add_argument("--import", dest="import_path", type=Path)
    parser.add_argument("--network", action="store_true", help="Use only explicitly approved source policies")
    args = parser.parse_args()
    today = datetime.now(ZoneInfo("Asia/Tokyo")).date()
    try:
        if args.limit < 1:
            raise ValueError('limit must be positive')
        if args.command == 'queue':
            print(json.dumps({'mode':'investigate', 'ids':investigation_queue(args.root,args.limit,args.ids), 'external_research_performed':False}))
        elif args.command == "report":
            profile = Profile.model_validate(yaml.safe_load(args.profile.read_text(encoding='utf-8-sig'))) if args.profile.exists() else None
            print(json.dumps(report(args.root, today, profile), ensure_ascii=False))
        elif args.command == "validate":
            data = validate_public(args.root / "web/public/jobs.json", today)
            reviews = args.root / 'web/public/review-jobs.json'
            if reviews.exists():
                validate_review(ReviewData.model_validate_json(reviews.read_text(encoding='utf-8')), today)
            print(json.dumps({"public_valid":True,"count":len(data.jobs)}))
        else:
            if args.mode == 'collect':
                if args.ids:
                    raise ValueError('--ids belongs to investigate mode')
                result = collect(args.root,args.sources,args.import_path,args.network,args.discoveries,today)
            else:
                if args.network or args.discoveries:
                    raise ValueError('use collect for source discovery; investigate uses selected local evidence')
                ids = investigation_queue(args.root,args.limit,args.ids)
                result = update(args.root,args.profile,import_path=args.import_path,today=today,review_ids=ids)
                result.update(mode='investigate', selected_ids=ids, external_research_performed=False)
            print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        # Avoid serializing profiles or raw HTML to CI logs.
        parser.exit(1, f"{type(exc).__name__}: {str(exc) if isinstance(exc, ValueError) and not hasattr(exc, 'errors') else '処理に失敗しました。入力・接続・権限をローカルで確認してください。公開成功とは扱いません。'}\n")


if __name__ == "__main__":
    main()

"""Generate the shared JSON Schema from the collector's strict public model."""
import json
import sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "collector/src"))
from collector.models import PublicData
schema = PublicData.model_json_schema()
def require_all(node):
    if isinstance(node, dict):
        if "properties" in node:
            node["required"] = list(node["properties"])
        for child in node.values():
            require_all(child)
    elif isinstance(node, list):
        for child in node:
            require_all(child)
require_all(schema)
schema["$schema"] = "http://json-schema.org/draft-07/schema#"
schema["definitions"] = schema.pop("$defs")
serialized = json.dumps(schema, ensure_ascii=False, indent=2).replace("#/$defs/", "#/definitions/") + "\n"
target = root / "web/src/public-data.schema.json"
if "--check" in sys.argv:
    if target.read_text(encoding="utf-8") != serialized:
        raise SystemExit("Schema is out of date; run python scripts/schema.py")
else:
    target.write_text(serialized, encoding="utf-8")

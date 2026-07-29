import os
import json
from pathlib import Path
from typing import Dict, Any, List

class MemoryService:
    def __init__(self, storage_path: str = None):
        if storage_path is None:
            base_dir = Path(__file__).parent.parent / "data"
            base_dir.mkdir(parents=True, exist_ok=True)
            self.storage_path = base_dir / "memory.json"
        else:
            self.storage_path = Path(storage_path)

        self.memory: Dict[str, Any] = self._load_memory()

    def _load_memory(self) -> Dict[str, Any]:
        """Load persistent memories from JSON storage"""
        if self.storage_path.exists():
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    print(f"🧠 Memory loaded ({len(data)} facts stored)")
                    return data
            except Exception as e:
                print(f"⚠️ Memory load error: {e}")
                return {}
        return {}

    def _save_memory(self):
        """Save active memories to JSON storage"""
        try:
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(self.memory, f, indent=2, ensure_ascii=False)
            print(f"💾 Memory saved ({len(self.memory)} facts persistent)")
        except Exception as e:
            print(f"❌ Memory save error: {e}")

    def remember(self, key: str, value: Any) -> str:
        """Store or update a learned fact/preference"""
        clean_key = key.strip().lower().replace(" ", "_")
        self.memory[clean_key] = {
            "key": key.strip(),
            "value": value,
            "timestamp": os.path.getmtime(self.storage_path) if self.storage_path.exists() else 0
        }
        self._save_memory()
        return f"Fact stored: '{key}' = '{value}'"

    def forget(self, key: str) -> str:
        """Remove a stored fact"""
        clean_key = key.strip().lower().replace(" ", "_")
        if clean_key in self.memory:
            del self.memory[clean_key]
            self._save_memory()
            return f"Fact forgotten: '{key}'"
        return f"Fact '{key}' not found in memory."

    def get_all_memories(self) -> List[Dict[str, Any]]:
        """Retrieve list of all active stored memories"""
        return list(self.memory.values())

    def get_memory_prompt_context(self) -> str:
        """Format stored memories into system prompt context string"""
        if not self.memory:
            return ""

        facts = []
        for item in self.memory.values():
            facts.append(f"- {item['key']}: {item['value']}")

        context_str = (
            "\n\n[RECALLED LEARNED KNOWLEDGE & USER PREFERENCES]:\n"
            + "\n".join(facts)
            + "\nUse this learned knowledge naturally to personalize your answers."
        )
        return context_str

memory_service = MemoryService()

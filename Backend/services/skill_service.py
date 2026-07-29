import os
import json
import importlib.util
from pathlib import Path
from typing import Dict, Any, List

class SkillService:
    def __init__(self):
        self.base_dir = Path(__file__).parent.parent
        self.skills_dir = self.base_dir / "skills"
        self.skills_dir.mkdir(parents=True, exist_ok=True)
        
        self.registry_path = self.base_dir / "data" / "skills.json"
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)

        self.skills_metadata: Dict[str, Any] = self._load_registry()
        self.loaded_modules: Dict[str, Any] = {}
        self._load_existing_skills()

    def _load_registry(self) -> Dict[str, Any]:
        if self.registry_path.exists():
            try:
                with open(self.registry_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ Skills registry load error: {e}")
                return {}
        return {}

    def _save_registry(self):
        try:
            with open(self.registry_path, "w", encoding="utf-8") as f:
                json.dump(self.skills_metadata, f, indent=2, ensure_ascii=False)
            print(f"⚙️ Skills registry saved ({len(self.skills_metadata)} skills active)")
        except Exception as e:
            print(f"❌ Skills registry save error: {e}")

    def _load_existing_skills(self):
        """Load and import all Python skill modules on startup"""
        for skill_name, meta in self.skills_metadata.items():
            py_file = self.skills_dir / f"{skill_name}.py"
            if py_file.exists():
                try:
                    spec = importlib.util.spec_from_file_location(skill_name, py_file)
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)
                    self.loaded_modules[skill_name] = module
                    print(f"✨ Loaded custom skill: {skill_name}")
                except Exception as e:
                    print(f"⚠️ Failed loading skill '{skill_name}': {e}")

    def create_skill(self, skill_name: str, description: str, python_code: str) -> str:
        """Dynamically create, register, and load a new Python skill tool"""
        clean_name = skill_name.strip().lower().replace(" ", "_")
        py_file = self.skills_dir / f"{clean_name}.py"

        # Ensure python_code defines a run(**kwargs) entry point
        if "def run(" not in python_code:
            python_code += "\n\ndef run(**kwargs):\n    return 'Skill executed successfully.'"

        try:
            with open(py_file, "w", encoding="utf-8") as f:
                f.write(python_code)

            # Dynamically import module
            spec = importlib.util.spec_from_file_location(clean_name, py_file)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            self.loaded_modules[clean_name] = module

            # Save to registry
            self.skills_metadata[clean_name] = {
                "name": clean_name,
                "description": description,
                "file_path": str(py_file),
            }
            self._save_registry()

            print(f"🎉 New skill synthesized & loaded: {clean_name}")
            return f"New skill '{clean_name}' successfully learned, registered, and active!"
        except Exception as e:
            print(f"❌ Skill creation error: {e}")
            return f"Failed creating skill '{clean_name}': {e}"

    def execute_skill(self, skill_name: str, **kwargs) -> str:
        """Execute a registered custom Python skill"""
        clean_name = skill_name.strip().lower().replace(" ", "_")
        if clean_name in self.loaded_modules:
            try:
                module = self.loaded_modules[clean_name]
                if hasattr(module, "run"):
                    result = module.run(**kwargs)
                    return str(result)
                return f"Skill '{clean_name}' has no run() entrypoint."
            except Exception as e:
                return f"Error executing skill '{clean_name}': {e}"
        return f"Skill '{clean_name}' is not registered."

    def get_skill_tools_schema(self) -> List[Dict[str, Any]]:
        """Format registered skills as function calling schemas for Groq LLM"""
        schemas = []
        for name, meta in self.skills_metadata.items():
            schemas.append({
                "name": f"skill_{name}",
                "description": meta.get("description", f"Custom skill: {name}"),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "input_data": {"type": "string", "description": "Input data for the skill"}
                    },
                    "required": []
                }
            })
        return schemas

skill_service = SkillService()

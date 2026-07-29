import json
import re
from groq import Groq
from config import GROQ_API_KEY, GROQ_LLM_MODEL, JARVIS_SYSTEM_PROMPT
from services.memory_service import memory_service
from services.skill_service import skill_service
from skills import system_actions

class LLMService:
    def __init__(self):
        self.client = Groq(api_key=GROQ_API_KEY)

    def _get_tools_schema(self):
        """Define tool function calling schema for Groq LLaMA 3.1"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "remember_fact",
                    "description": "Store a user preference, habit, title, or fact into persistent self-learning memory",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "key": {"type": "string", "description": "Short memory key (e.g. 'user_name', 'favorite_language')"},
                            "value": {"type": "string", "description": "Fact value (e.g. 'Sir', 'Python')"}
                        },
                        "required": ["key", "value"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "create_new_skill",
                    "description": "Synthesize, save, register and load a new Python skill tool on the fly",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "skill_name": {"type": "string", "description": "Name of the new skill (e.g. 'currency_converter')"},
                            "description": {"type": "string", "description": "What the skill does"},
                            "python_code": {"type": "string", "description": "Python code for the skill with entrypoint run(**kwargs)"}
                        },
                        "required": ["skill_name", "description", "python_code"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "open_website",
                    "description": "Open YouTube, Google, Facebook, Instagram, GitHub, or any URL in default web browser",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "target": {"type": "string", "description": "Name or URL of the website/app (e.g. 'youtube', 'google', 'facebook', 'instagram')"}
                        },
                        "required": ["target"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_storage_info",
                    "description": "Inspect system disk space, RAM memory usage, and OS details",
                    "parameters": {
                        "type": "object",
                        "properties": {}
                    }
                }
            }
        ]

    def _execute_tool_call(self, tool_name: str, args: dict) -> str:
        """Execute called tool and return string result"""
        try:
            if tool_name == "remember_fact":
                res = memory_service.remember(args.get("key", ""), args.get("value", ""))
                return f"[MEMORY STORED] {res}"

            elif tool_name == "create_new_skill":
                res = skill_service.create_skill(
                    args.get("skill_name", ""),
                    args.get("description", ""),
                    args.get("python_code", "")
                )
                return f"[NEW SKILL LEARNED] {res}"

            elif tool_name == "open_website":
                res = system_actions.open_website(args.get("target", "google"))
                return f"[WEB ACTION] {res}"

            elif tool_name == "get_storage_info":
                res = system_actions.get_storage_info()
                return f"[SYSTEM METRICS] {res}"

            elif tool_name.startswith("skill_"):
                real_skill = tool_name.replace("skill_", "")
                res = skill_service.execute_skill(real_skill, **args)
                return f"[SKILL RESULT] {res}"

            return f"Unknown tool '{tool_name}'"
        except Exception as e:
            return f"Tool execution error: {e}"

    def _auto_extract_user_facts(self, prompt: str):
        """Auto-detect name or preference changes in user prompt"""
        p_lower = prompt.lower()
        
        # Detect "call me Sir / call me [Name]"
        call_me_match = re.search(r"call me (by )?([a-zA-Z0-9_\- ]+)", prompt, re.IGNORECASE)
        if call_me_match:
            new_title = call_me_match.group(2).strip().capitalize()
            if new_title:
                memory_service.remember("user_name", new_title)
                print(f"🧠 Auto-learned user title: 'Sir'/'{new_title}'")

        # Detect "remember that [X] is [Y]"
        remember_match = re.search(r"remember that ([a-zA-Z0-9_\- ]+) is ([a-zA-Z0-9_\- ]+)", prompt, re.IGNORECASE)
        if remember_match:
            key = remember_match.group(1).strip()
            val = remember_match.group(2).strip()
            memory_service.remember(key, val)
            print(f"🧠 Auto-learned fact: '{key}' = '{val}'")

    def generate_response(self, user_prompt: str) -> str:
        """Generate response with memory context & tool execution loop"""
        try:
            # Auto-extract and save any user title/name/preference statements
            self._auto_extract_user_facts(user_prompt)

            # Direct web action shortcut (e.g. "open youtube", "open google")
            prompt_lower = user_prompt.lower().strip()
            if prompt_lower.startswith("open "):
                target = prompt_lower.replace("open ", "").strip()
                result = system_actions.open_website(target)
                print(f"🚀 Direct Web Action: {result}")
                return f"Opening {target.capitalize()} for you now, sir."

            if "storage" in prompt_lower or "disk space" in prompt_lower or "system info" in prompt_lower:
                stats = system_actions.get_storage_info()
                print(f"📊 Direct System Metrics: {stats}")
                return f"Here is your current system status: {stats}"

            # Inject recalled memory context into system prompt
            memory_context = memory_service.get_memory_prompt_context()
            full_system_prompt = JARVIS_SYSTEM_PROMPT + memory_context

            messages = [
                {"role": "system", "content": full_system_prompt},
                {"role": "user", "content": user_prompt},
            ]

            tools = self._get_tools_schema()

            # First LLM call (with tool schemas)
            response = self.client.chat.completions.create(
                model=GROQ_LLM_MODEL,
                messages=messages,
                tools=tools,
                tool_choice="auto",
                max_tokens=150,
                temperature=0.6,
            )

            response_message = response.choices[0].message

            # Check if LLM invoked a tool call
            if response_message.tool_calls:
                for tool_call in response_message.tool_calls:
                    function_name = tool_call.function.name
                    function_args = json.loads(tool_call.function.arguments or "{}")
                    print(f"🛠️ Executing Tool: {function_name}({function_args})")

                    tool_output = self._execute_tool_call(function_name, function_args)
                    print(f"   ↳ Result: {tool_output}")

                    # Append assistant message & tool response
                    messages.append(response_message)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": function_name,
                        "content": tool_output,
                    })

                # Follow-up LLM call to synthesize final voice reply
                followup_response = self.client.chat.completions.create(
                    model=GROQ_LLM_MODEL,
                    messages=messages,
                    max_tokens=100,
                    temperature=0.6,
                )
                reply = followup_response.choices[0].message.content.strip()
                print(f"🤖 Final LLM Reply: \"{reply}\"")
                return reply

            reply = (response_message.content or "").strip()
            print(f"🤖 LLM Reply: \"{reply}\"")
            return reply or "I am at your service, sir."

        except Exception as e:
            print(f"❌ LLM error: {e}")
            return "Apologies, I encountered an issue. Please try again."

llm_service = LLMService()

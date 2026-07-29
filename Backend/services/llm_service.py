import json
import re
from groq import Groq
from config import GROQ_API_KEY, GROQ_LLM_MODEL, JARVIS_SYSTEM_PROMPT
from services.memory_service import memory_service
from services.skill_service import skill_service
from skills import system_actions

MAX_TOOL_ITERATIONS = 5


class LLMService:
    def __init__(self):
        self.client = Groq(api_key=GROQ_API_KEY)

    def _get_tools_schema(self):
        """Builtin tools + dynamically registered custom skills"""
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "remember_fact",
                    "description": "Store a user preference, habit, title, or fact into persistent self-learning memory",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "key": {
                                "type": "string",
                                "description": (
                                    "Memory key. Use 'user_name' for real name, "
                                    "'call_me' for how to address them (e.g. Sir). "
                                    "Other examples: 'favorite_language'"
                                ),
                            },
                            "value": {
                                "type": "string",
                                "description": "Fact value (e.g. 'Imon', 'Sir', 'Python')",
                            },
                        },
                        "required": ["key", "value"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "create_new_skill",
                    "description": "Synthesize, save, register and load a new Python skill tool on the fly. Only use when the user explicitly asks to create or learn a new skill.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "skill_name": {
                                "type": "string",
                                "description": "Name of the new skill (e.g. 'currency_converter')",
                            },
                            "description": {
                                "type": "string",
                                "description": "What the skill does",
                            },
                            "python_code": {
                                "type": "string",
                                "description": "Python code for the skill with entrypoint run(**kwargs)",
                            },
                        },
                        "required": ["skill_name", "description", "python_code"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "open_website",
                    "description": "Open YouTube, Google, Facebook, Instagram, GitHub, or any URL in default web browser",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "target": {
                                "type": "string",
                                "description": "Name or URL of the website/app (e.g. 'youtube', 'google', 'facebook', 'instagram')",
                            }
                        },
                        "required": ["target"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_storage_info",
                    "description": "Inspect system disk space, RAM memory usage, and OS details",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                    },
                },
            },
        ]

        # Merge live custom skills (skips system_actions to avoid duplicating builtins)
        tools.extend(skill_service.get_skill_tools_schema())
        return tools

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
                    args.get("python_code", ""),
                )
                return f"[NEW SKILL LEARNED] {res}"

            elif tool_name == "open_website":
                res = system_actions.open_website(args.get("target", "google"))
                return f"[WEB ACTION] {res}"

            elif tool_name == "get_storage_info":
                res = system_actions.get_storage_info()
                return f"[SYSTEM METRICS] {res}"

            elif tool_name.startswith("skill_"):
                real_skill = tool_name.replace("skill_", "", 1)
                res = skill_service.execute_skill(real_skill, **args)
                return f"[SKILL RESULT] {res}"

            return f"Unknown tool '{tool_name}'"
        except Exception as e:
            return f"Tool execution error: {e}"

    def _auto_extract_user_facts(self, prompt: str):
        """Auto-detect real name vs form-of-address preferences"""
        # "my name is Imon" / "name is Imon"
        name_match = re.search(
            r"(?:my\s+)?name\s+is\s+([A-Za-z][A-Za-z0-9_\-]*)",
            prompt,
            re.IGNORECASE,
        )
        if name_match:
            real_name = name_match.group(1).strip()
            # Titles like Sir/Boss are forms of address, not real names
            if real_name.lower() not in {"sir", "boss", "mister", "miss", "madam", "ma'am"}:
                memory_service.remember("user_name", real_name.capitalize())
                print(f"🧠 Auto-learned real name: '{real_name.capitalize()}'")

        # "call me Sir" / "call me by Sir" / "you can call me Sir"
        call_me_match = re.search(
            r"(?<!\bdon't )(?<!\bdo not )(?:you can )?call me(?: by)?\s+([A-Za-z][A-Za-z0-9_\-]*)",
            prompt,
            re.IGNORECASE,
        )
        if call_me_match:
            title = call_me_match.group(1).strip().split()[0]
            if title and title.lower() not in {"my", "me", "by", "the", "a", "an", "your"}:
                stored = "Sir" if title.lower() == "sir" else title.capitalize()
                memory_service.remember("call_me", stored)
                print(f"🧠 Auto-learned form of address: '{stored}'")

        remember_match = re.search(
            r"remember that ([a-zA-Z0-9_\- ]+) is ([a-zA-Z0-9_\- ]+)",
            prompt,
            re.IGNORECASE,
        )
        if remember_match:
            key = remember_match.group(1).strip()
            val = remember_match.group(2).strip()
            # Skip if this is an identity phrase already handled above
            if key.lower() not in {"my name", "name", "your name"}:
                memory_service.remember(key, val)
                print(f"🧠 Auto-learned fact: '{key}' = '{val}'")

    def _strip_tool_markup(self, text: str) -> str:
        """Remove leaked function-call markup from spoken replies."""
        if not text:
            return ""
        cleaned = re.sub(
            r"<function=[^>]*>\s*\{.*?\}\s*</function>",
            "",
            text,
            flags=re.DOTALL | re.IGNORECASE,
        )
        cleaned = re.sub(
            r"<function=[^>]*>\s*\{.*?\}",
            "",
            cleaned,
            flags=re.DOTALL | re.IGNORECASE,
        )
        cleaned = re.sub(r"</?function[^>]*>", "", cleaned, flags=re.IGNORECASE)
        return re.sub(r"\s+", " ", cleaned).strip()

    def _recover_tools_from_text(self, text: str) -> list:
        """Parse leaked XML-style tool calls embedded in assistant content."""
        found = []
        for match in re.finditer(
            r"<function=([a-zA-Z0-9_]+)>\s*(\{.*?\})\s*(?:</function>)?",
            text or "",
            re.DOTALL,
        ):
            name = match.group(1)
            try:
                args = json.loads(match.group(2))
            except json.JSONDecodeError:
                args = {}
            if not isinstance(args, dict):
                args = {}
            found.append((name, args))
        return found

    def _finalize_spoken_reply(self, text: str) -> str:
        cleaned = self._strip_tool_markup(text)
        return cleaned or "I am at your service, sir."

    def _message_to_dict(self, response_message) -> dict:
        """Convert Groq assistant message to a serializable messages dict"""
        msg = {
            "role": "assistant",
            "content": response_message.content or "",
        }
        if response_message.tool_calls:
            msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments or "{}",
                    },
                }
                for tc in response_message.tool_calls
            ]
        return msg

    def _parse_failed_tool_generation(self, error_text: str):
        """Recover tool name/args when Groq rejects XML-style llama tool markup."""
        # Prefer well-formed tags; also accept truncated markup without </function>
        patterns = [
            r"<function=([a-zA-Z0-9_]+)>\s*(\{.*?\})\s*</function>",
            r"<function=([a-zA-Z0-9_]+)>\s*(\{[^}]*\})",
            r"function=([a-zA-Z0-9_]+)>\s*(\{[^}]*\})",
        ]
        for pattern in patterns:
            match = re.search(pattern, str(error_text), re.DOTALL)
            if not match:
                continue
            name = match.group(1)
            try:
                args = json.loads(match.group(2))
            except json.JSONDecodeError:
                args = {}
            if not isinstance(args, dict):
                args = {}
            return name, args
        return None, None

    def _force_spoken_summary(self, messages: list) -> str:
        """Ask the model for a short spoken reply with tools disabled."""
        summary_messages = list(messages) + [{
            "role": "user",
            "content": (
                "Summarize any completed actions above into a short spoken reply "
                "for the user. Be concise. Do not call tools."
            ),
        }]
        try:
            followup = self.client.chat.completions.create(
                model=GROQ_LLM_MODEL,
                messages=summary_messages,
                max_tokens=200,
                temperature=0.6,
            )
            reply = (followup.choices[0].message.content or "").strip()
            print(f"🤖 Final LLM Reply (forced summary): \"{reply}\"")
            return self._finalize_spoken_reply(reply or "I completed the requested actions, sir.")
        except Exception as e:
            print(f"❌ Summary LLM error: {e}")
            return "I completed the requested actions, sir."

    def generate_response(self, user_prompt: str) -> str:
        """Generate response with multi-step tool loop, memory context, and skills"""
        try:
            self._auto_extract_user_facts(user_prompt)

            memory_context = memory_service.get_memory_prompt_context()
            full_system_prompt = JARVIS_SYSTEM_PROMPT + memory_context

            messages = [
                {"role": "system", "content": full_system_prompt},
                {"role": "user", "content": user_prompt},
            ]

            for iteration in range(MAX_TOOL_ITERATIONS):
                tools = self._get_tools_schema()
                try:
                    response = self.client.chat.completions.create(
                        model=GROQ_LLM_MODEL,
                        messages=messages,
                        tools=tools,
                        tool_choice="auto",
                        max_tokens=200,
                        temperature=0.6,
                    )
                except Exception as api_err:
                    # Llama-on-Groq sometimes emits XML tool markup; recover and continue
                    tool_name, tool_args = self._parse_failed_tool_generation(str(api_err))
                    if tool_name:
                        print(f"⚠️ Recovered malformed tool call: {tool_name}({tool_args})")
                        tool_output = self._execute_tool_call(tool_name, tool_args)
                        print(f"   ↳ Result: {tool_output}")
                        fake_id = f"recovered_{iteration}_{tool_name}"
                        messages.append({
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [{
                                "id": fake_id,
                                "type": "function",
                                "function": {
                                    "name": tool_name,
                                    "arguments": json.dumps(tool_args),
                                },
                            }],
                        })
                        messages.append({
                            "role": "tool",
                            "tool_call_id": fake_id,
                            "name": tool_name,
                            "content": tool_output,
                        })
                        # After recovery, prefer a spoken summary rather than more tools
                        return self._force_spoken_summary(messages)

                    print(f"⚠️ Tool-loop API error on iteration {iteration + 1}: {api_err}")
                    # Only summarize if we already executed tools this turn
                    if any(m.get("role") == "tool" for m in messages):
                        return self._force_spoken_summary(messages)
                    raise

                response_message = response.choices[0].message
                tool_calls = response_message.tool_calls

                if not tool_calls:
                    reply = (response_message.content or "").strip()
                    # Llama sometimes dumps tool markup into content instead of tool_calls
                    leaked = self._recover_tools_from_text(reply)
                    if leaked:
                        messages.append({"role": "assistant", "content": reply})
                        for idx, (function_name, function_args) in enumerate(leaked):
                            print(f"🛠️ Recovered from content: {function_name}({function_args})")
                            tool_output = self._execute_tool_call(function_name, function_args)
                            print(f"   ↳ Result: {tool_output}")
                            fake_id = f"content_tool_{iteration}_{idx}"
                            messages.append({
                                "role": "tool",
                                "tool_call_id": fake_id,
                                "name": function_name,
                                "content": tool_output,
                            })
                        return self._finalize_spoken_reply(
                            self._force_spoken_summary(messages)
                        )

                    print(f"🤖 LLM Reply: \"{reply}\"")
                    return self._finalize_spoken_reply(reply or "I am at your service, sir.")

                # Append assistant message once, then each tool result
                messages.append(self._message_to_dict(response_message))

                for tool_call in tool_calls:
                    function_name = tool_call.function.name
                    try:
                        function_args = json.loads(tool_call.function.arguments or "{}")
                    except json.JSONDecodeError:
                        function_args = {}
                    if not isinstance(function_args, dict):
                        function_args = {}

                    print(
                        f"🛠️ [{iteration + 1}/{MAX_TOOL_ITERATIONS}] "
                        f"Executing Tool: {function_name}({function_args})"
                    )
                    tool_output = self._execute_tool_call(function_name, function_args)
                    print(f"   ↳ Result: {tool_output}")

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": function_name,
                        "content": tool_output,
                    })

                # Next iteration refreshes schemas (new skills from create_new_skill are included)

            return self._force_spoken_summary(messages)

        except Exception as e:
            print(f"❌ LLM error: {e}")
            return "Apologies, I encountered an issue. Please try again."


llm_service = LLMService()

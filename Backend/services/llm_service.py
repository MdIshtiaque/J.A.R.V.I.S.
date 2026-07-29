import json
import re
from collections import deque
from typing import Callable, Optional

from groq import Groq
from config import GROQ_API_KEY, GROQ_LLM_MODEL, JARVIS_SYSTEM_PROMPT, CHAT_HISTORY_TURNS
from services.memory_service import memory_service
from services.skill_service import skill_service
from services.web_search_service import web_search_service
from skills import system_actions

MAX_TOOL_ITERATIONS = 5

# Slow tools → live UI/status while work runs
TOOL_PROGRESS = {
    "web_search": ("searching", "On it, sir. Searching the web now."),
    "open_website": ("working", "On it, sir. Opening that for you now."),
    "create_new_skill": ("working", "On it, sir. Building that skill now."),
    "get_storage_info": ("working", "On it, sir. Checking system metrics."),
    "remember_fact": ("working", "On it, sir. Updating your memory."),
}


class LLMService:
    def __init__(self):
        self.client = Groq(api_key=GROQ_API_KEY)
        # Recent spoken turns for follow-up context (user, assistant, user, assistant, ...)
        self.chat_history: deque = deque(maxlen=max(2, CHAT_HISTORY_TURNS * 2))
        self._on_status: Optional[Callable] = None

    def _emit_status(self, status: str, detail: str = None, speak: bool = False):
        if self._on_status:
            try:
                self._on_status(status, detail, speak)
            except TypeError:
                try:
                    self._on_status(status, detail)
                except Exception as e:
                    print(f"⚠️ Status callback error: {e}")
            except Exception as e:
                print(f"⚠️ Status callback error: {e}")

    def _notify_tool_progress(self, tool_name: str):
        if tool_name.startswith("skill_"):
            skill = tool_name.replace("skill_", "", 1)
            self._emit_status("working", f"On it, sir. Running the {skill} skill now.", speak=True)
            return
        if tool_name in TOOL_PROGRESS:
            status, detail = TOOL_PROGRESS[tool_name]
            self._emit_status(status, detail, speak=True)

    def _notify_tool_done(self, tool_name: str):
        # Spoken milestone after search completes; other tools go straight to the final reply
        if tool_name == "web_search":
            self._emit_status("found", "Found it, sir.", speak=True)

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
            {
                "type": "function",
                "function": {
                    "name": "web_search",
                    "description": (
                        "Search the live internet for current facts, news, docs, or anything "
                        "not already known. Use a short focused query. Returns titles, snippets, and URLs."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Short search query (under 400 characters)",
                            },
                            "max_results": {
                                "type": "integer",
                                "description": "How many results to return (1-8, default 5)",
                            },
                        },
                        "required": ["query"],
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

            elif tool_name == "web_search":
                raw_max = args.get("max_results")
                try:
                    max_results = int(raw_max) if raw_max is not None else None
                except (TypeError, ValueError):
                    max_results = None
                res = web_search_service.search(
                    args.get("query", ""),
                    max_results=max_results,
                )
                return f"[WEB SEARCH]\n{res}"

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

    def _force_spoken_summary(self, messages: list, used_search: bool = False) -> str:
        """Ask the model for a short spoken reply with tools disabled."""
        if used_search:
            instruction = (
                "Using the web_search tool results above, give a spoken reply that includes "
                "the actual key findings (2-4 short points). Address the user as call_me if known. "
                "Do not only say you found results — tell them what the results say. Do not call tools."
            )
        else:
            instruction = (
                "Summarize any completed actions above into a short spoken reply "
                "for the user. Be concise and include substance. Do not call tools."
            )
        summary_messages = list(messages) + [{
            "role": "user",
            "content": instruction,
        }]
        try:
            followup = self.client.chat.completions.create(
                model=GROQ_LLM_MODEL,
                messages=summary_messages,
                max_tokens=350,
                temperature=0.5,
            )
            reply = (followup.choices[0].message.content or "").strip()
            print(f"🤖 Final LLM Reply (forced summary): \"{reply}\"")
            return self._finalize_spoken_reply(reply or "I completed the requested actions, sir.")
        except Exception as e:
            print(f"❌ Summary LLM error: {e}")
            return "I completed the requested actions, sir."

    def _remember_turn(self, user_prompt: str, reply: str):
        self.chat_history.append({"role": "user", "content": user_prompt})
        self.chat_history.append({"role": "assistant", "content": reply})

    def _is_fast_chat(self, prompt: str) -> bool:
        """True when tools are unnecessary — answer directly for speed."""
        p = (prompt or "").lower().strip()
        if not p:
            return True

        # Clear action intents → full tool loop
        if re.search(
            r"\b("
            r"search|look up|look up|google|bing|web search|"
            r"news|headline|headlines|weather|stock|price|"
            r"open |launch |go to |visit |"
            r"remember that|remember my|store that|save that|"
            r"disk space|storage|system info|ram |"
            r"create (a )?new skill|create (a )?skill|learn (a )?skill"
            r")\b",
            p,
        ):
            return False

        # Capability / access questions (emails, calendar, etc.) — honesty from prompt, no tools
        if re.search(
            r"\b(can you|could you|do you|are you able|have you|will you)\b",
            p,
        ) and re.search(
            r"\b(access|check|read|see|connect|open|get into|linked|integration)\b",
            p,
        ):
            return True

        if re.search(
            r"\b(email|emails|gmail|outlook|calendar|messages|whatsapp|phone|sms|smart home|iot)\b",
            p,
        ) and re.search(
            r"\b(access|check|read|can you|do you|connected|available)\b",
            p,
        ):
            return True

        # Greetings / thanks / identity / meta — no tools
        if re.search(
            r"^(hi|hello|hey|yo|thanks|thank you|goodbye|bye|good morning|good afternoon|"
            r"good evening|how are you|what's up|what up)(!|\.|$|\s)",
            p,
        ):
            return True

        if re.search(
            r"\b(what('s| is) my name|who am i|what can you do|who are you|"
            r"what are you|are you jarvis|how do you work)\b",
            p,
        ):
            return True

        # Short conversational question with no action verbs
        if len(p) <= 90 and p.endswith("?") and not re.search(
            r"\b(search|open|launch|remember|create|install|download|run|execute|browse)\b",
            p,
        ):
            return True

        return False

    def _generate_fast_response(self, user_prompt: str, messages: list) -> str:
        """Single no-tools LLM call for simple chat / capability questions."""
        print("⚡ Fast path (no tools)")
        response = self.client.chat.completions.create(
            model=GROQ_LLM_MODEL,
            messages=messages,
            max_tokens=120,
            temperature=0.4,
        )
        reply = (response.choices[0].message.content or "").strip()
        print(f"🤖 Fast LLM Reply: \"{reply}\"")
        return self._finalize_spoken_reply(reply or "I am at your service, sir.")

    def generate_response(self, user_prompt: str, on_status: Optional[Callable] = None) -> str:
        """Generate response with multi-step tool loop, chat history, and skills"""
        self._on_status = on_status
        used_search = False
        try:
            self._auto_extract_user_facts(user_prompt)

            memory_context = memory_service.get_memory_prompt_context()
            full_system_prompt = JARVIS_SYSTEM_PROMPT + memory_context

            messages = [{"role": "system", "content": full_system_prompt}]
            messages.extend(list(self.chat_history))
            messages.append({"role": "user", "content": user_prompt})

            # Simple questions → skip tool schemas entirely (much faster)
            if self._is_fast_chat(user_prompt):
                reply = self._generate_fast_response(user_prompt, messages)
                self._remember_turn(user_prompt, reply)
                return reply

            self._emit_status("thinking", None)

            for iteration in range(MAX_TOOL_ITERATIONS):
                tools = self._get_tools_schema()
                try:
                    response = self.client.chat.completions.create(
                        model=GROQ_LLM_MODEL,
                        messages=messages,
                        tools=tools,
                        tool_choice="auto",
                        max_tokens=350,
                        temperature=0.5,
                    )
                except Exception as api_err:
                    tool_name, tool_args = self._parse_failed_tool_generation(str(api_err))
                    if tool_name:
                        print(f"⚠️ Recovered malformed tool call: {tool_name}({tool_args})")
                        self._notify_tool_progress(tool_name)
                        if tool_name == "web_search":
                            used_search = True
                        tool_output = self._execute_tool_call(tool_name, tool_args)
                        print(f"   ↳ Result: {tool_output}")
                        self._notify_tool_done(tool_name)
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
                        reply = self._force_spoken_summary(messages, used_search=used_search)
                        self._remember_turn(user_prompt, reply)
                        return reply

                    print(f"⚠️ Tool-loop API error on iteration {iteration + 1}: {api_err}")
                    if any(m.get("role") == "tool" for m in messages):
                        reply = self._force_spoken_summary(messages, used_search=used_search)
                        self._remember_turn(user_prompt, reply)
                        return reply
                    raise

                response_message = response.choices[0].message
                tool_calls = response_message.tool_calls

                if not tool_calls:
                    reply = (response_message.content or "").strip()
                    leaked = self._recover_tools_from_text(reply)
                    if leaked:
                        messages.append({"role": "assistant", "content": reply})
                        for idx, (function_name, function_args) in enumerate(leaked):
                            print(f"🛠️ Recovered from content: {function_name}({function_args})")
                            self._notify_tool_progress(function_name)
                            if function_name == "web_search":
                                used_search = True
                            tool_output = self._execute_tool_call(function_name, function_args)
                            print(f"   ↳ Result: {tool_output}")
                            self._notify_tool_done(function_name)
                            fake_id = f"content_tool_{iteration}_{idx}"
                            messages.append({
                                "role": "tool",
                                "tool_call_id": fake_id,
                                "name": function_name,
                                "content": tool_output,
                            })
                        reply = self._finalize_spoken_reply(
                            self._force_spoken_summary(messages, used_search=used_search)
                        )
                        self._remember_turn(user_prompt, reply)
                        return reply

                    print(f"🤖 LLM Reply: \"{reply}\"")
                    reply = self._finalize_spoken_reply(reply or "I am at your service, sir.")
                    self._remember_turn(user_prompt, reply)
                    return reply

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
                    self._notify_tool_progress(function_name)
                    if function_name == "web_search":
                        used_search = True
                    tool_output = self._execute_tool_call(function_name, function_args)
                    print(f"   ↳ Result: {tool_output}")
                    self._notify_tool_done(function_name)

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": function_name,
                        "content": tool_output,
                    })

            reply = self._force_spoken_summary(messages, used_search=used_search)
            self._remember_turn(user_prompt, reply)
            return reply

        except Exception as e:
            print(f"❌ LLM error: {e}")
            return "Apologies, I encountered an issue. Please try again."
        finally:
            self._on_status = None


llm_service = LLMService()

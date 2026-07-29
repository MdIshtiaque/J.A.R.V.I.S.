"""Web search for the agent tool loop.

Follows the common Groq/Llama agent pattern: DuckDuckGo (no API key),
concise queries, 3–5 titled snippets + URLs for the LLM to summarize.
Optional Tavily upgrade when TAVILY_API_KEY is set (LLM-oriented search API).
"""

from __future__ import annotations

import json
from typing import Any, List, Optional

from config import TAVILY_API_KEY, WEB_SEARCH_MAX_RESULTS


class WebSearchService:
    def search(self, query: str, max_results: Optional[int] = None) -> str:
        """Search the web and return LLM-friendly formatted results."""
        q = (query or "").strip()
        if not q:
            return "Search error: empty query."

        # Keep queries concise (agent search best practice: under ~400 chars)
        if len(q) > 400:
            q = q[:400]

        limit = max(1, min(int(max_results or WEB_SEARCH_MAX_RESULTS), 8))

        if TAVILY_API_KEY:
            tavily = self._search_tavily(q, limit)
            if tavily:
                return tavily

        return self._search_duckduckgo(q, limit)

    def _looks_like_news_query(self, query: str) -> bool:
        q = query.lower()
        keywords = (
            "news", "headline", "headlines", "today", "latest", "breaking",
            "this morning", "this week",
        )
        return any(k in q for k in keywords)

    def _news_query(self, query: str) -> str:
        """Rewrite ambiguous news queries so DDG doesn't match sports 'Tech' teams."""
        q = query.strip()
        lower = q.lower()
        if "tech" in lower and "news" in lower:
            # Avoid "Texas Tech" / college sports matches
            return "technology industry news OR AI OR startups OR gadgets"
        if lower in {"news", "today's news", "todays news", "latest news"}:
            return "world technology and business headlines"
        return q

    def _search_duckduckgo(self, query: str, max_results: int) -> str:
        try:
            from ddgs import DDGS
        except ImportError:
            try:
                from duckduckgo_search import DDGS  # type: ignore
            except ImportError:
                return (
                    "Search unavailable: install the 'ddgs' package "
                    "(pip install ddgs)."
                )

        raw = []
        try:
            with DDGS() as ddgs:
                if self._looks_like_news_query(query):
                    news_q = self._news_query(query)
                    try:
                        raw = list(ddgs.news(news_q, max_results=max_results)) or []
                    except Exception as news_err:
                        print(f"⚠️ DuckDuckGo news failed, falling back to text: {news_err}")
                        raw = []
                if not raw:
                    raw = list(ddgs.text(query, max_results=max_results)) or []
        except Exception as e:
            return f"Search error: {e}"

        if not raw:
            return f"No web results found for: {query}"

        lines: List[str] = [f"Web search results for: {query}"]
        for i, item in enumerate(raw, 1):
            title = item.get("title") or "Untitled"
            url = item.get("href") or item.get("url") or ""
            snippet = item.get("body") or item.get("snippet") or ""
            source = item.get("source")
            date = item.get("date")
            if len(snippet) > 400:
                snippet = snippet[:397] + "..."
            meta = []
            if source:
                meta.append(str(source))
            if date:
                meta.append(str(date)[:16])
            meta_str = f" ({', '.join(meta)})" if meta else ""
            lines.append(f"{i}. {title}{meta_str}\n   {snippet}\n   Source: {url}")

        return "\n".join(lines)

    def _search_tavily(self, query: str, max_results: int) -> str:
        """Optional higher-quality search when TAVILY_API_KEY is configured."""
        try:
            import urllib.request

            payload = json.dumps({
                "api_key": TAVILY_API_KEY,
                "query": query,
                "max_results": max_results,
                "search_depth": "basic",
                "include_answer": False,
            }).encode("utf-8")

            req = urllib.request.Request(
                "https://api.tavily.com/search",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                data: Any = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"⚠️ Tavily search failed, falling back to DuckDuckGo: {e}")
            return ""

        results = data.get("results") or []
        if not results:
            return ""

        lines: List[str] = [f"Web search results for: {query}"]
        for i, item in enumerate(results[:max_results], 1):
            title = item.get("title") or "Untitled"
            url = item.get("url") or ""
            snippet = item.get("content") or ""
            if len(snippet) > 400:
                snippet = snippet[:397] + "..."
            lines.append(f"{i}. {title}\n   {snippet}\n   Source: {url}")

        return "\n".join(lines)


web_search_service = WebSearchService()

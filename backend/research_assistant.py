import json, time, logging
from collections import Counter

# Make mistralai optional so this module can be imported without the package
try:
    from mistralai import Mistral
    from mistralai.models.chat import ChatMessage
    MISTRAL_AVAILABLE = True
except Exception:
    MISTRAL_AVAILABLE = False

class ResearchGPTAssistant:
    def __init__(self, config, document_processor):
        self.config = config
        self.doc_processor = document_processor

        def _cfg(key, default=None):
            if isinstance(config, dict):
                return config.get(key, default)
            return getattr(config, key, default)
        self._cfg = _cfg

        api_key = _cfg("mistral_api_key") or _cfg("MISTRAL_API_KEY")
        # Initialize client only if package is available and API key provided
        if MISTRAL_AVAILABLE and api_key:
            try:
                self.mistral_client = Mistral(api_key=api_key)
            except Exception:
                logging.exception("Failed to init Mistral client; continuing with stub mode")
                self.mistral_client = None
        else:
            # Run in stub/test mode when client or API key is missing
            logging.warning("Mistral client not available or API key missing; running in stub mode")
            self.mistral_client = None

        self.prompts = self._load_prompt_templates()

    def _load_prompt_templates(self):
        return {
            "chain_of_thought": (
                "Use ONLY the context. Think step-by-step internally. "
                "Return JSON: final_answer, brief_rationale (<=3 bullets), citations.\n\n"
                "Context:\n{context}\n\nQuestion:\n{question}"
            ),
            "qa_with_context": (
                "Answer from context only. If not present, say 'Not found.'\n"
                "Return JSON: final_answer, citations.\n\n"
                "Context:\n{context}\n\nQuestion:\n{question}"
            ),
            "verify_answer": (
                "Fact-check the answer against the context. Return JSON: "
                "verdict ('pass'/'revise'), issues, improved_answer, confidence (0..1).\n\n"
                "Question: {question}\nContext:\n{context}\nProposed:\n{answer}"
            ),
        }

    def _call_mistral(self, prompt, temperature=None, model=None):
        temperature = self._cfg("TEMPERATURE", 0.3) if temperature is None else temperature
        model = self._cfg("model", "mistral-tiny") if model is None else model
        # If we have a configured client, use it
        if self.mistral_client is not None:
            try:
                t0 = time.time()
                resp = self.mistral_client.chat.complete(
                    model=model,
                    messages=[ChatMessage(role="user", content=prompt)],
                    temperature=temperature,
                )
                msg = resp.choices[0].message
                text = getattr(msg, "content", "") or msg.get("content", "")
                if isinstance(text, list):
                    text = "".join(seg.get("text", "") if isinstance(seg, dict) else str(seg) for seg in text)
                logging.info("mistral|%s|%.1fms|%d chars", model, (time.time()-t0)*1000, len(text))
                return text
            except Exception as e:
                logging.exception("mistral_error")
                return json.dumps({"error": str(e)})

        # Fallback stub behavior (deterministic, useful for local testing)
        try:
            # If prompt appears to be a CoT/QA template, try to extract question
            question = None
            if isinstance(prompt, str):
                if "Question:" in prompt:
                    question = prompt.split("Question:", 1)[-1].strip().splitlines()[0]
                elif "Question\n" in prompt:
                    question = prompt.split("Question\n", 1)[-1].strip().splitlines()[0]

            if question:
                stub = {
                    "final_answer": f"[STUB] Unable to call model; saw question: {question}",
                    "brief_rationale": ["stub: no API"],
                    "citations": []
                }
                return json.dumps(stub)

            # Generic stub response
            return json.dumps({"final_answer": "[STUB] model not configured", "brief_rationale": [], "citations": []})
        except Exception:
            return json.dumps({"error": "stub_failure"})

    def _safe_json(self, raw):
        try:
            s = raw.strip()
            if s.startswith("```"):
                s = s.strip("`")
                s = s[s.find("{"):s.rfind("}")+1]
            return json.loads(s)
        except Exception:
            return None

    def _join_chunks(self, chunks, max_chars=6000):
        out, used = [], 0
        for ch in chunks or []:
            piece = ch[1] if isinstance(ch, (list,tuple)) and len(ch)>=2 else str(ch)
            piece = piece.strip()
            if used + len(piece) > max_chars: break
            out.append(piece); used += len(piece)
        return "\n\n---\n\n".join(out) if out else "No context."

    def chain_of_thought_reasoning(self, query, chunks):
        ctx = self._join_chunks(chunks)
        raw = self._call_mistral(self.prompts["chain_of_thought"].format(context=ctx, question=query))
        return self._safe_json(raw) or {"final_answer":"Not found.","brief_rationale":[],"citations":[]}

    def self_consistency_generate(self, query, chunks, num_attempts=3):
        outs = [self.chain_of_thought_reasoning(query, chunks) for _ in range(num_attempts)]
        outs = [o for o in outs if "final_answer" in o]
        if not outs: return {"final_answer":"No candidates"}
        norm = lambda s: " ".join(s.lower().split())
        counts = Counter(norm(o["final_answer"]) for o in outs)
        best, cnt = counts.most_common(1)[0]
        if cnt/len(outs) >= 0.6:
            return next(o for o in outs if norm(o["final_answer"])==best)
        cand_text = "\n".join([o["final_answer"] for o in outs])
        raw = self._call_mistral(self.prompts["qa_with_context"].format(context=self._join_chunks(chunks), question=query))
        return self._safe_json(raw) or outs[0]

    def verify_and_edit_answer(self, answer, query, chunks):
        ctx = self._join_chunks(chunks)
        raw = self._call_mistral(self.prompts["verify_answer"].format(question=query, context=ctx, answer=answer), temperature=0)
        data = self._safe_json(raw) or {"verdict":"revise","improved_answer":answer,"confidence":0.5}
        return data

    def answer_research_question(self, query, use_cot=True, use_verification=True):
        chunks = self.doc_processor.find_similar_chunks(query, top_k=5) if hasattr(self.doc_processor,"find_similar_chunks") else []
        if use_cot:
            gen = self.self_consistency_generate(query, chunks, num_attempts=3)
            ans = gen.get("final_answer","")
        else:
            ctx = self._join_chunks(chunks)
            raw = self._call_mistral(self.prompts["qa_with_context"].format(context=ctx, question=query))
            gen = self._safe_json(raw) or {}
            ans = gen.get("final_answer","")
        ver = self.verify_and_edit_answer(ans, query, chunks) if use_verification else None
        return {
            "query": query,
            "answer": ver.get("improved_answer", ans) if ver else ans,
            "generation": gen,
            "verification": ver,
            "sources": [c[2] for c in chunks if isinstance(c,(list,tuple)) and len(c)>=3]
        }
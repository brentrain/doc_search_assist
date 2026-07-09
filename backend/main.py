import os
import json
import time
import logging
from pathlib import Path

# Optional: pip install python-dotenv
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# Import the proper DocumentProcessor
from document_processor import DocumentProcessor

# --- Your existing assistant skeleton (expects self.client already set up) ---
from mistralai import Mistral

class ResearchGPTAssistant:
    def __init__(self, config, document_processor):
        self.client = Mistral(api_key=config["mistral_api_key"])
        self.document_processor = document_processor

    def _call_mistral(self, prompt, temperature=0.7, model="mistral-tiny"):
        try:
            resp = self.client.chat.complete(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
            )
            return resp.choices[0].message.content
        except Exception as e:
            logging.exception("Mistral API error")
            return None

    def _load_prompt_templates(self):
        return {
            "qa": (
                "You are a helpful research assistant. Use ONLY the context below to answer.\n\n"
                "Context:\n{context}\n\n"
                "Question: {question}\n"
                "If the answer is not in the context, say 'Not found in provided context.'"
            )
        }

    def answer_simple_question(self, query):
        # Find similar chunks using the proper method
        chunks = self.document_processor.find_similar_chunks(query, top_k=5)
        if not chunks:
            return "Not found in provided context."
        
        # Combine context from chunks
        context = "\n\n".join([chunk[0] for chunk in chunks])
        prompt = self._load_prompt_templates()["qa"].format(context=context, question=query)
        ans = self._call_mistral(prompt)
        return ans or "Sorry, I couldn’t find an answer."

def build_config():
    """Central place to assemble runtime config."""
    return {
        "mistral_api_key": os.environ.get("MISTRAL_API_KEY", "").strip(),
        "data_dir": os.environ.get("DATA_DIR", "data"),
        "artifacts_dir": os.environ.get("ARTIFACTS_DIR", "artifacts"),
        "results_path": os.environ.get("RESULTS_PATH", "artifacts/results.json"),
        "test_query": os.environ.get("TEST_QUERY", "What problem does HeartSenseAI solve?"),
        "model": os.environ.get("MISTRAL_MODEL", "mistral-tiny"),
        "temperature": float(os.environ.get("TEMPERATURE", "0.3")),
    }

def demonstrate_all_capabilities(dp):
    """Demonstrate all system capabilities as specified in step-by-step instructions."""
    from research_agents import AgentOrchestrator
    
    # Initialize orchestrator for multi-agent workflows using existing document processor
    orchestrator = AgentOrchestrator(build_config(), dp)
    
    demonstrations = {}
    
    # 1. Document Processing Demo
    logging.info("=== Document Processing Demo ===")
    sample_dir = Path("data/sample_papers")
    if sample_dir.exists():
        for file_path in sample_dir.glob("*"):
            if file_path.is_file() and file_path.suffix.lower() in ['.txt', '.pdf']:
                doc_id = dp.process_document(str(file_path))
                logging.info(f"Processed: {doc_id}")
    
    dp.build_search_index()
    stats = dp.get_document_stats()
    demonstrations["document_processing"] = {
        "documents_processed": stats["num_documents"],
        "total_chunks": stats["total_chunks"],
        "avg_length": stats["avg_document_length"],
        "status": "ready" if stats["num_documents"] > 0 else "no_documents"
    }
    
    # 2. Chain-of-Thought Reasoning Demo
    logging.info("=== Chain-of-Thought Reasoning Demo ===")
    cot_question = "What are the key benefits of HeartSenseAI?"
    cot_result = orchestrator.route_task("qa", {"question": cot_question})
    demonstrations["chain_of_thought"] = cot_result
    
    # 3. Self-Consistency Prompting Demo
    logging.info("=== Self-Consistency Prompting Demo ===")
    sc_question = "How does machine learning help in healthcare?"
    sc_result = orchestrator.route_task("qa", {"question": sc_question})
    demonstrations["self_consistency"] = sc_result
    
    # 4. ReAct Workflow Demo (simulated with research workflow)
    logging.info("=== ReAct Workflow Demo ===")
    react_query = "AI applications in medical diagnosis"
    react_result = orchestrator.route_task("research_workflow", {"research_query": react_query})
    demonstrations["react_workflow"] = react_result
    
    # 5. Agent Coordination Demo
    logging.info("=== Agent Coordination Demo ===")
    coordination_result = orchestrator.coordinate_multi_agent_workflow("machine learning in healthcare")
    demonstrations["agent_coordination"] = coordination_result
    
    # 6. Complete Research Session Demo
    logging.info("=== Complete Research Session Demo ===")
    research_questions = [
        "What is HeartSenseAI?",
        "What problem does it solve?",
        "How accurate is it?",
        "What are the future directions?"
    ]
    
    research_session = []
    for question in research_questions:
        result = orchestrator.route_task("qa", {"question": question})
        research_session.append(result)
    
    demonstrations["complete_research_session"] = {
        "questions_processed": len(research_questions),
        "results": research_session
    }
    
    return demonstrations

def main():
    # --- Logging setup ---
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s"
    )

    t0 = time.time()
    config = build_config()
    artifacts_dir = Path(config["artifacts_dir"])
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    # --- Guardrails for API key ---
    if not config["mistral_api_key"]:
        logging.error("MISTRAL_API_KEY is missing. Set it in your environment or .env file.")
        return

    # --- Initialize system components ---
    from config import Config
    config_obj = Config()
    dp = DocumentProcessor(config_obj)
    assistant = ResearchGPTAssistant(config, dp)

    # --- Process documents ---
    logging.info("Processing documents...")
    sample_dir = Path("data/sample_papers")
    docs_processed = 0
    
    # Process any .txt or .pdf files in the sample_papers directory
    if sample_dir.exists():
        for file_path in sample_dir.glob("*"):
            if file_path.is_file() and file_path.suffix.lower() in ['.txt', '.pdf']:
                doc_id = dp.process_document(str(file_path))
                docs_processed += 1
                logging.info("Processed document: %s", doc_id)
    
    # --- Build search index ---
    logging.info("Building search index...")
    dp.build_search_index()
    stats = dp.get_document_stats()
    
    if stats['num_documents'] == 0:
        logging.warning("No documents found in data/sample_papers/ directory.")
        logging.info("To use this system, add .txt or .pdf files to the data/sample_papers/ directory.")
        logging.info("The system will demonstrate capabilities without documents.")
    else:
        logging.info("Index built with %d documents and %d chunks", stats['num_documents'], stats['total_chunks'])

    # --- Test basic query functionality ---
    logging.info("Running test query...")
    question = config["test_query"]
    answer = assistant.answer_simple_question(question)
    logging.info("Test query complete.")

    # --- Demonstrate all capabilities ---
    logging.info("Demonstrating all system capabilities...")
    demonstrations = demonstrate_all_capabilities(dp)

    # --- Save comprehensive results ---
    results = {
        "basic_query": {
            "question": question,
            "answer": answer,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "model": config["model"],
            "temperature": config["temperature"],
        },
        "demonstrations": demonstrations,
        "system_stats": {
            "total_documents": docs_processed,
            "processing_time": time.time() - t0,
            "capabilities_demonstrated": len(demonstrations)
        }
    }
    
    results_path = Path(config["results_path"])
    results_path.write_text(json.dumps(results, indent=2))
    logging.info("Results saved to %s", results_path)

    # --- Print summary ---
    logging.info("=== SYSTEM CAPABILITIES DEMONSTRATION COMPLETE ===")
    logging.info("Documents processed: %d", docs_processed)
    logging.info("Capabilities demonstrated: %d", len(demonstrations))
    logging.info("Total processing time: %.2fs", time.time() - t0)
    logging.info("Done!")

if __name__ == "__main__":
    main()

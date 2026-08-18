# Document Search Assistant

![RAG](https://img.shields.io/badge/RAG-Retrieval_Augmented_Generation-7C3AED?style=for-the-badge)
![Local AI](https://img.shields.io/badge/Local_AI-Ollama-111827?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Chroma](https://img.shields.io/badge/Vector_Search-Chroma-F97316?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active_Development-2E7D32?style=for-the-badge)

**A local-first document intelligence application that turns PDF and text collections into a searchable, grounded AI knowledge base.**

Document Search Assistant combines semantic retrieval, vector storage, local embeddings, and local language-model generation to answer questions from uploaded documents. Users can search across an entire collection or deliberately constrain retrieval to a single document, with retrieved source metadata returned alongside the answer.

The project also preserves an earlier lexical-search implementation, showing the progression from TF-IDF retrieval to modern embedding-based RAG.

## Why this project exists

Large document collections are useful only if people can find the information inside them. Traditional keyword search can miss semantically related passages, while general-purpose language models can answer confidently without grounding themselves in the source material.

This project explores a different approach: retrieve relevant passages first, provide only that context to the model, and expose the source information used during retrieval.

## Current capabilities

- Upload and index PDF and TXT documents
- Extract and split document text into overlapping chunks
- Generate local embeddings with Ollama and `nomic-embed-text`
- Persist semantic vectors in Chroma
- Retrieve the most relevant document chunks for a question
- Search across all indexed documents or constrain retrieval to one selected document
- Generate grounded answers with a local Ollama model
- Return source filenames and available page metadata with answers
- Run through a FastAPI backend and responsive Next.js frontend
- Configure frontend/backend locations through environment variables
- Restrict uploads by type and size
- Expose a lightweight backend health endpoint
- Preserve an earlier TF-IDF/cosine-similarity retrieval implementation for experimentation and comparison

## RAG pipeline

```text
┌────────────────────┐
│   PDF / TXT File   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Document Extraction│
│ + Metadata Capture │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Recursive Chunking │
│ 800 chars / overlap│
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Ollama Embeddings  │
│ nomic-embed-text   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│   Chroma Vector DB │
│ + source metadata  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Semantic Retrieval │
│ all docs or scoped │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Local LLM / Ollama │
│ grounded response  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Answer + Sources   │
└────────────────────┘
```

## Architecture

```text
Next.js / React frontend
        │
        │ HTTP / JSON
        ▼
FastAPI backend
        │
        ├── document ingestion
        ├── chunking
        ├── source metadata
        ├── retrieval filtering
        └── grounded prompt construction
        │
        ├──────────────► Chroma vector store
        │
        └──────────────► Ollama
                         ├── nomic-embed-text
                         └── llama3.2 (default)
```

## Project structure

```text
doc_search_assist/
├── backend/
│   ├── main_fastapi.py       # Primary local RAG API
│   ├── document_processor.py # Earlier TF-IDF retrieval pipeline
│   ├── main.py               # Mistral/research workflow experiments
│   ├── research_agents.py    # Agent-oriented research experiments
│   ├── research_assistant.py
│   ├── test_system.py
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   └── page.tsx          # Main document-search interface
│   ├── package.json
│   └── ...
├── requirements.txt
└── README.md
```

## Tech stack

**Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS  
**API:** Python, FastAPI, Uvicorn  
**RAG:** LangChain, Chroma, Ollama  
**Embeddings:** `nomic-embed-text`  
**Default local LLM:** `llama3.2`  
**Document processing:** PyPDF/PyPDF2, recursive text splitting  
**Earlier retrieval path:** TF-IDF + cosine similarity with scikit-learn  
**Experimental hosted-model path:** Mistral

## Run locally

### 1. Requirements

Install Ollama and make sure these models are available:

```bash
ollama pull nomic-embed-text
ollama pull llama3.2
```

### 2. Backend

```bash
git clone https://github.com/brentrain/doc_search_assist.git
cd doc_search_assist/backend
python -m venv .venv
```

Activate the virtual environment, then:

```bash
pip install -r requirements.txt
python main_fastapi.py
```

The API runs at `http://localhost:8000` by default.

### 3. Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:8000` unless `NEXT_PUBLIC_API_URL` is set.

## Configuration

Useful environment variables include:

```text
NEXT_PUBLIC_API_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000
UPLOAD_DIR=data/sample_papers
CHROMA_DIR=chroma_db
MAX_UPLOAD_BYTES=10485760
EMBEDDING_MODEL=nomic-embed-text
OLLAMA_MODEL=llama3.2
```

## Document-scoped retrieval

Selecting a target document now changes the retrieval operation itself rather than merely adding the filename to the natural-language question. The frontend sends the selected source separately, and the backend applies a metadata filter to Chroma retrieval.

That means:

```text
All Documents  → retrieve from the full collection
Selected PDF   → retrieve only chunks whose source metadata matches that PDF
```

This distinction matters because retrieval scope should be enforced by the retrieval system, not left for the language model to interpret.

## Retrieval evolution

The repository contains two useful generations of search technology:

**V1 — Lexical retrieval**  
PDF/text extraction → preprocessing → sentence-aware chunks → TF-IDF vectors → cosine similarity.

**V2 — Semantic RAG**  
Document loaders → recursive chunking → neural embeddings → Chroma vector search → grounded local LLM response.

Keeping both approaches makes it possible to compare traditional information retrieval with embedding-based semantic search.

## Next engineering goals

The next major step is evaluation. Planned work includes a small benchmark set of questions with known relevant passages so retrieval hit rate, source accuracy, answer groundedness, and document-scoping behavior can be measured rather than judged only by appearance.

Other planned improvements include duplicate-document handling, document deletion/re-indexing, richer citations, streaming responses, configurable retrieval depth, hybrid lexical/vector search, automated tests, and CI.

## Portfolio context

This project demonstrates practical work across document ingestion, information retrieval, embeddings, vector databases, API design, local language models, frontend integration, and RAG architecture. It is designed as an engineering project rather than a generic chatbot wrapper: retrieval behavior, source scope, local inference, and future evaluation are treated as first-class parts of the system.

## Disclaimer

This project is intended for software engineering, AI research, education, and portfolio demonstration. Answers generated by language models should be verified against the original source documents before being relied upon for consequential decisions.

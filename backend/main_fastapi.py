from fastapi import Depends, FastAPI, UploadFile, File, Form, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import os
import re
import json
import shutil
import uvicorn
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings, ChatOllama
from auth import (
    SESSION_COOKIE,
    clear_session_cookie,
    create_session,
    create_user,
    current_user,
    delete_session,
    initialize_auth_database,
    set_session_cookie,
    verify_user,
)

app = FastAPI(title="ReadBefore API")
initialize_auth_database()

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LEGACY_UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "data/sample_papers"))
USER_DATA_DIR = Path(os.getenv("USER_DATA_DIR", "data/users"))
LEGACY_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".pdf", ".txt"}
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))

embeddings = OllamaEmbeddings(model=os.getenv("EMBEDDING_MODEL", "nomic-embed-text"))
text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
vectorstore = Chroma(
    collection_name="research_docs",
    embedding_function=embeddings,
    persist_directory=os.getenv("CHROMA_DIR", "chroma_db"),
)


class QueryRequest(BaseModel):
    question: str
    source: Optional[str] = None
    document_kind: str = "general"


class ContractReviewRequest(BaseModel):
    source: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


def safe_filename(filename: str) -> str:
    name = Path(filename).name
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip()
    if not name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    return name


def workspace_dir(user: dict) -> Path:
    directory = USER_DATA_DIR / user["id"] / "documents"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def workspace_filter(user: dict, source: Optional[str] = None) -> dict:
    filters = [{"workspace_id": user["id"]}]
    if source:
        filters.append({"source": source})
    return filters[0] if len(filters) == 1 else {"$and": filters}


def index_document(file_path: Path, filename: str, user: dict) -> int:
    loader = PyPDFLoader(str(file_path)) if file_path.suffix.lower() == ".pdf" else TextLoader(str(file_path))
    docs = loader.load()
    for doc in docs:
        doc.metadata.update({"source": filename, "workspace_id": user["id"]})
    splits = text_splitter.split_documents(docs)
    if not splits:
        raise ValueError("No readable text was found in the document")
    vectorstore.add_documents(splits)
    return len(splits)


def claim_legacy_documents(user: dict) -> int:
    if not user["is_owner"]:
        return 0
    target = workspace_dir(user)
    claimed = 0
    for original in sorted(LEGACY_UPLOAD_DIR.glob("*")):
        if not original.is_file() or original.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
        destination = target / safe_filename(original.name)
        if destination.exists():
            continue
        shutil.copy2(original, destination)
        try:
            index_document(destination, destination.name, user)
            claimed += 1
        except Exception:
            destination.unlink(missing_ok=True)
            raise
    return claimed


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/auth/register")
async def register(data: RegisterRequest, response: Response):
    user = create_user(data.name, data.email, data.password)
    try:
        claimed = claim_legacy_documents(user)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Account created, but existing documents could not be prepared: {exc}") from exc
    token = create_session(user["id"])
    set_session_cookie(response, token)
    return {"user": user, "claimed_documents": claimed}


@app.post("/auth/login")
async def login(data: LoginRequest, response: Response):
    user = verify_user(data.email, data.password)
    token = create_session(user["id"])
    set_session_cookie(response, token)
    return {"user": user}


@app.post("/auth/logout")
async def logout(request: Request, response: Response):
    delete_session(request.cookies.get(SESSION_COOKIE))
    clear_session_cookie(response)
    return {"status": "success"}


@app.get("/auth/me")
async def auth_me(user: dict = Depends(current_user)):
    return {"user": user}


@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_kind: str = Form("general"),
    user: dict = Depends(current_user),
):
    filename = safe_filename(file.filename or "")
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the upload size limit")

    file_path = workspace_dir(user) / filename
    file_path.write_bytes(content)

    try:
        chunks = index_document(file_path, filename, user)
        return {"status": "success", "filename": filename, "chunks": chunks, "document_kind": document_kind}
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Document processing failed: {exc}") from exc


@app.post("/query")
async def query_assistant(data: QueryRequest, user: dict = Depends(current_user)):
    question = data.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    try:
        if data.source and not (workspace_dir(user) / safe_filename(data.source)).is_file():
            raise HTTPException(status_code=404, detail="Document not found")
        search_kwargs = {"k": 4, "filter": workspace_filter(user, data.source)}

        retriever = vectorstore.as_retriever(search_kwargs=search_kwargs)
        docs = retriever.invoke(question)
        if not docs:
            return {"answer": "Not found in the selected document context.", "sources": []}

        context = "\n\n".join(doc.page_content for doc in docs)
        llm = ChatOllama(model=os.getenv("OLLAMA_MODEL", "llama3.2"), temperature=0.3)
        kind_guidance = {
            "legal": "Explain legal language cautiously in plain English. Do not give legal advice.",
            "everyday": "Explain bills, policies, notices, instructions, or letters in practical everyday language.",
            "general": "Explain the material clearly for a non-expert reader.",
        }.get(data.document_kind, "Explain the material clearly for a non-expert reader.")
        prompt = (
            "Answer the question using only the supplied document context. "
            "If the answer is not supported by the context, say that it was not found.\n\n"
            f"Explanation style: {kind_guidance}\n\n"
            f"Context:\n{context}\n\nQuestion: {question}\nAnswer:"
        )
        response = llm.invoke(prompt)
        sources = [
            {
                "source": doc.metadata.get("source"),
                "page": doc.metadata.get("page"),
            }
            for doc in docs
        ]
        return {"answer": response.content, "sources": sources}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Query failed: {exc}. Make sure Ollama is running and the configured models are available.",
        ) from exc


@app.post("/review-contract")
async def review_contract(data: ContractReviewRequest, user: dict = Depends(current_user)):
    source = safe_filename(data.source)
    file_path = workspace_dir(user) / source
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        stored = vectorstore.get(where=workspace_filter(user, source), include=["documents", "metadatas"])
        raw_documents = stored.get("documents") or []
        raw_metadatas = stored.get("metadatas") or []
        sections = list(zip(raw_documents, raw_metadatas))
        if not sections:
            loader = PyPDFLoader(str(file_path)) if file_path.suffix.lower() == ".pdf" else TextLoader(str(file_path))
            loaded_documents = loader.load()
            sections = [
                (
                    document.page_content,
                    {**document.metadata, "source": source, "page": document.metadata.get("page", index)},
                )
                for index, document in enumerate(loaded_documents)
            ]
        sections.sort(key=lambda item: (item[1] or {}).get("page", 0))

        max_context_chars = int(os.getenv("MAX_CONTRACT_CONTEXT_CHARS", "24000"))
        context_parts = []
        context_length = 0
        pages = set()
        for text, metadata in sections:
            if not text:
                continue
            page = (metadata or {}).get("page")
            page_label = page + 1 if isinstance(page, int) else "unknown"
            section = f"[Page {page_label}]\n{text.strip()}"
            if context_length + len(section) > max_context_chars:
                break
            context_parts.append(section)
            context_length += len(section)
            if isinstance(page, int):
                pages.add(page)

        if not context_parts:
            raise HTTPException(status_code=422, detail="No readable contract text was found")

        prompt = f"""
You are a careful contract explainer for an everyday person, not a lawyer. Analyze only the supplied document text.
Use short sentences and plain English. Do not give legal advice, predict a court outcome, or invent missing facts.
When something is unclear or absent, say so. A concern is something the reader may want to understand or discuss
with a qualified lawyer; it is not a definitive legal conclusion.

Return valid JSON only, with exactly this structure:
{{
  "document_type": "short plain-English label",
  "plain_summary": "3-5 sentence overview",
  "parties": ["party names or roles"],
  "key_terms": [
    {{"label": "term name", "value": "plain-English value", "explanation": "why it matters", "page": 1}}
  ],
  "important_dates": [
    {{"label": "date or deadline name", "value": "date as written", "explanation": "what happens", "page": 1}}
  ],
  "obligations": [
    {{"who": "person or party", "must_do": "plain-English duty", "when": "timing or Not stated", "page": 1}}
  ],
  "concerns": [
    {{"severity": "low|medium|high", "title": "short title", "explanation": "neutral explanation", "question_to_ask": "helpful question", "page": 1}}
  ],
  "questions_to_ask": ["practical question before signing or acting"],
  "missing_or_unclear": ["important item that could not be found or understood"]
}}

Use page numbers from the [Page N] markers. Include at most 8 key terms, 6 dates, 8 obligations, 6 concerns,
and 6 questions. Do not flag ordinary language as risky without explaining the specific practical consequence.

Document: {source}

{chr(10).join(context_parts)}
"""
        llm = ChatOllama(
            model=os.getenv("OLLAMA_MODEL", "llama3.2"),
            temperature=0.1,
            format="json",
        )
        response = llm.invoke(prompt)
        review = json.loads(response.content)
        return {
            "source": source,
            "review": review,
            "pages_reviewed": sorted(page + 1 for page in pages),
            "disclaimer": (
                "This is an AI-generated explanation, not legal advice. Important decisions should be reviewed "
                "with a qualified lawyer in your jurisdiction."
            ),
        }
    except HTTPException:
        raise
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="The local model returned an unreadable review. Please try again.") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Contract review failed: {exc}. Make sure Ollama is running and the configured model is available.",
        ) from exc


@app.get("/documents")
async def list_documents(user: dict = Depends(current_user)):
    return [
        {"filename": file.name}
        for file in sorted(workspace_dir(user).glob("*"))
        if file.is_file() and file.suffix.lower() in ALLOWED_EXTENSIONS
    ]


if __name__ == "__main__":
    uvicorn.run("main_fastapi:app", host="0.0.0.0", port=8000, reload=True)

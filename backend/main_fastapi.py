from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from pydantic import BaseModel
import os
import re
import uvicorn
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings, ChatOllama

app = FastAPI(title="AI Research Assistant API")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "data/sample_papers"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
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
    source: str | None = None


def safe_filename(filename: str) -> str:
    name = Path(filename).name
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip()
    if not name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    return name


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    filename = safe_filename(file.filename or "")
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the upload size limit")

    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(content)

    try:
        loader = PyPDFLoader(str(file_path)) if extension == ".pdf" else TextLoader(str(file_path))
        docs = loader.load()
        for doc in docs:
            doc.metadata["source"] = filename
        splits = text_splitter.split_documents(docs)
        if not splits:
            raise ValueError("No readable text was found in the document")
        vectorstore.add_documents(splits)
        return {"status": "success", "filename": filename, "chunks": len(splits)}
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Document processing failed: {exc}") from exc


@app.post("/query")
async def query_assistant(data: QueryRequest):
    question = data.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    try:
        search_kwargs = {"k": 4}
        if data.source:
            search_kwargs["filter"] = {"source": data.source}

        retriever = vectorstore.as_retriever(search_kwargs=search_kwargs)
        docs = retriever.invoke(question)
        if not docs:
            return {"answer": "Not found in the selected document context.", "sources": []}

        context = "\n\n".join(doc.page_content for doc in docs)
        llm = ChatOllama(model=os.getenv("OLLAMA_MODEL", "llama3.2"), temperature=0.3)
        prompt = (
            "Answer the question using only the supplied document context. "
            "If the answer is not supported by the context, say that it was not found.\n\n"
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


@app.get("/documents")
async def list_documents():
    return [
        {"filename": file.name}
        for file in sorted(UPLOAD_DIR.glob("*"))
        if file.is_file() and file.suffix.lower() in ALLOWED_EXTENSIONS
    ]


if __name__ == "__main__":
    uvicorn.run("main_fastapi:app", host="0.0.0.0", port=8000, reload=True)

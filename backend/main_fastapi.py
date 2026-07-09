from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import uvicorn
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings, ChatOllama

app = FastAPI(title="AI Research Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

embeddings = OllamaEmbeddings(model="nomic-embed-text")
text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
vectorstore = Chroma(collection_name="research_docs", embedding_function=embeddings, persist_directory="chroma_db")

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    upload_dir = Path("data/sample_papers")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file.filename
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    try:
        if file.filename.endswith('.pdf'):
            loader = PyPDFLoader(str(file_path))
        else:
            loader = TextLoader(str(file_path))
        docs = loader.load()
        for doc in docs:
            doc.metadata["source"] = file.filename
        splits = text_splitter.split_documents(docs)
        vectorstore.add_documents(splits)
        return {"status": "success", "filename": file.filename}
    except Exception as e:
        return {"status": "success", "filename": file.filename, "note": str(e)}

@app.post("/query")
async def query_assistant(data: dict):
    question = data.get("question", "")
    try:
        retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
        docs = retriever.invoke(question)
        context = "\n\n".join([doc.page_content for doc in docs])
        llm = ChatOllama(model="llama3.2", temperature=0.3)
        prompt = f"Context:\n{context}\n\nQuestion: {question}\nAnswer concisely based only on the context:"
        response = llm.invoke(prompt)
        return {"answer": response.content}
    except Exception as e:
        return {"answer": f"Error: {str(e)}. Make sure Ollama is running."}

@app.get("/documents")
async def list_documents():
    upload_dir = Path("data/sample_papers")
    if not upload_dir.exists():
        return []
    return [{"filename": f.name} for f in upload_dir.glob("*") if f.is_file()]

if __name__ == "__main__":
    uvicorn.run("main_fastapi:app", host="0.0.0.0", port=8000, reload=True)

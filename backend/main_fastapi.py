from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import uvicorn
from langchain_ollama import ChatOllama
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings

app = FastAPI(title="AI Research Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# RAG Setup
embeddings = OllamaEmbeddings(model="llama3.2")
vectorstore = None
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

def init_vectorstore():
    global vectorstore
    persist_dir = Path("chroma_db")
    if persist_dir.exists():
        vectorstore = Chroma(persist_directory=str(persist_dir), embedding_function=embeddings)
    else:
        vectorstore = Chroma(collection_name="research_docs", embedding_function=embeddings, persist_directory=str(persist_dir))

init_vectorstore()

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    upload_dir = Path("data/sample_papers")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file.filename
    with open(file_path, "wb") as f:
        f.write(await file.read())

    # Process for RAG
    if file.filename.endswith('.pdf'):
        loader = PyPDFLoader(str(file_path))
    else:
        loader = TextLoader(str(file_path))
    
    docs = loader.load()
    splits = text_splitter.split_documents(docs)
    
    if vectorstore:
        vectorstore.add_documents(splits)
    
    return {"status": "success", "filename": file.filename, "chunks": len(splits)}

@app.post("/query")
async def query_assistant(data: dict):
    question = data.get("question", "")
    try:
        if vectorstore:
            retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
            docs = retriever.invoke(question)
            context = "\n\n".join([doc.page_content for doc in docs])
            
            llm = ChatOllama(model="llama3.2", temperature=0.3)
            prompt = f"Context:\n{context}\n\nQuestion: {question}\nAnswer based on context:"
            response = llm.invoke(prompt)
            
            return {"answer": response.content, "sources": [doc.metadata for doc in docs]}
        else:
            return {"answer": "No documents indexed yet."}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}

@app.get("/documents")
async def list_documents():
    upload_dir = Path("data/sample_papers")
    if not upload_dir.exists():
        return []
    files = [{"filename": f.name} for f in upload_dir.glob("*") if f.is_file()]
    return files

if __name__ == "__main__":
    uvicorn.run("main_fastapi:app", host="0.0.0.0", port=8000, reload=True)

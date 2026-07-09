"""
Document Processing Module for ResearchGPT Assistant

TODO: Implement the following functionality:
1. PDF text extraction and cleaning
2. Text preprocessing and chunking
3. Basic similarity search using TF-IDF
4. Document metadata extraction
"""

import PyPDF2
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.exceptions import NotFittedError
import os
import re

class DocumentProcessor:
    def __init__(self, config):
        """
        Initialize Document Processor
        
        Args:
            config (Config): Configuration object with settings
        """
        self.config = config
        
        # Initialize TF-IDF vectorizer with optimized parameters
        self.vectorizer = TfidfVectorizer(
            max_features=5000,          # Limit vocabulary size
            stop_words='english',       # Remove common English stop words
            ngram_range=(1, 2),         # Use unigrams and bigrams
            min_df=1,                   # Minimum document frequency
            max_df=0.8,                 # Maximum document frequency
            lowercase=True,             # Convert to lowercase
            strip_accents='ascii'       # Remove accents
        )
        
        # Document storage structure
        self.documents = {}  # Store as: {doc_id: {'title': '', 'chunks': [], 'metadata': {}}}
        self.document_vectors = None  # Store TF-IDF vectors
        self.chunk_to_doc_mapping = []  # Map chunk index to document ID
        self.all_chunks = []  # Store all text chunks for vectorization
    
    def extract_text_from_pdf(self, file_path):
        """
        Extract text from a PDF or text file.
        
        Args:
            file_path (str): Path to PDF or text file

        Returns:
            str: Extracted text
        """
        try:
            if not os.path.isfile(file_path):
                raise FileNotFoundError(f"The file '{file_path}' was not found.")

            # Check if it's a text file
            if file_path.lower().endswith('.txt'):
                with open(file_path, "r", encoding="utf-8") as text_file:
                    return text_file.read()
            
            # Otherwise, treat as PDF
            with open(file_path, "rb") as pdf_file:
                reader = PyPDF2.PdfReader(pdf_file, strict=False)
                text_chunks = []
                append_chunk = text_chunks.append

                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        append_chunk(page_text)

            return "\n".join(text_chunks)
        except (FileNotFoundError, OSError) as exc:
            print(f"Error reading '{file_path}': {exc}")
            return ""
        except Exception as exc:  # Catch PyPDF2-specific parsing issues
            print(f"An error occurred while parsing '{file_path}': {exc}")
            return ""
    
    def preprocess_text(self, text):
        """
        Clean and preprocess text
        
        Args:
            text (str): Raw extracted text
            
        Returns:
            str: Preprocessed text
        """
        if not text:
            return ""
        
        # Remove extra whitespace and normalize newlines
        cleaned_text = re.sub(r'\n\s*\n', '\n\n', text)  # Normalize multiple newlines
        cleaned_text = re.sub(r'[ \t]+', ' ', cleaned_text)  # Normalize spaces and tabs
        
        # Fix common PDF extraction issues
        cleaned_text = re.sub(r'([a-z])([A-Z])', r'\1 \2', cleaned_text)  # Add space between camelCase
        cleaned_text = re.sub(r'([.!?])([A-Z])', r'\1 \2', cleaned_text)  # Add space after sentences
        
        # Remove excessive punctuation and special characters
        cleaned_text = re.sub(r'[^\w\s\.\,\!\?\;\:\-\(\)\[\]\'\"\/]', ' ', cleaned_text)
        
        # Clean up multiple spaces
        cleaned_text = re.sub(r' +', ' ', cleaned_text)
        
        # Remove leading/trailing whitespace
        cleaned_text = cleaned_text.strip()
        
        return cleaned_text
    
    def chunk_text(self, text, chunk_size=None, overlap=None):
        """
        Split text into manageable chunks
        
        Args:
            text (str): Text to chunk
            chunk_size (int): Size of each chunk
            overlap (int): Overlap between chunks
            
        Returns:
            list: List of text chunks
        """
        if not text or not text.strip():
            return []
            
        if chunk_size is None:
            chunk_size = getattr(self.config, 'CHUNK_SIZE', 1000)
        if overlap is None:
            overlap = getattr(self.config, 'OVERLAP', 100)
            
        # Split text into sentences first to avoid breaking mid-sentence
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = ""
        current_length = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            sentence_length = len(sentence)
            
            # If adding this sentence would exceed chunk_size, save current chunk
            if current_length + sentence_length > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                
                # Start new chunk with overlap from previous chunk
                if overlap > 0 and current_chunk:
                    # Take last 'overlap' characters from previous chunk
                    overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                    current_chunk = overlap_text + " " + sentence
                else:
                    current_chunk = sentence
                current_length = len(current_chunk)
            else:
                # Add sentence to current chunk
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
                current_length += sentence_length + (1 if current_chunk != sentence else 0)
        
        # Add the last chunk if it has content
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
            
        return chunks
    
    def process_document(self, pdf_path):
        """
        Process a single PDF document
        
        TODO: Implement complete document processing:
        1. Extract text from PDF
        2. Preprocess the text
        3. Create chunks
        4. Extract basic metadata (title, length, etc.)
        5. Store in document storage
        6. Return document ID
        
        Args:
            pdf_path (str): Path to PDF file
            
        Returns:
            str: Document ID
        """
        doc_id = os.path.splitext(os.path.basename(pdf_path))[0]

        raw_text = self.extract_text_from_pdf(pdf_path)
        processed_text = self.preprocess_text(raw_text) if raw_text else ""
        chunks = self.chunk_text(processed_text) if processed_text else []

        title_candidate = doc_id
        for line in processed_text.splitlines():
            stripped = line.strip()
            if stripped:
                title_candidate = stripped[:200]
                break

        try:
            file_size = os.path.getsize(pdf_path)
        except OSError:
            file_size = 0

        metadata = {
            'title': title_candidate,
            'path': pdf_path,
            'file_size': file_size,
            'char_length': len(processed_text),
            'word_count': len(processed_text.split()) if processed_text else 0,
            'num_chunks': len(chunks),
        }

        self.documents[doc_id] = {
            'title': title_candidate,
            'chunks': chunks,
            'metadata': metadata,
        }

        if chunks:
            self.all_chunks.extend(chunks)
            self.chunk_to_doc_mapping.extend([doc_id] * len(chunks))

        self.document_vectors = None
        return doc_id
    
    def build_search_index(self):
        """
        Build TF-IDF search index for all documents
        
        TODO: Implement search index creation:
        1. Collect all text chunks from all documents
        2. Fit TF-IDF vectorizer on all chunks
        3. Transform chunks to vectors
        4. Store vectors for similarity search
        """
        if self.document_vectors is not None:
            return self.document_vectors

        chunks = self.all_chunks
        if not chunks:
            self.document_vectors = None
            return None

        self.document_vectors = self.vectorizer.fit_transform(chunks)
        return self.document_vectors
        
    def find_similar_chunks(self, query, top_k=5):
        """
        Find most similar document chunks to query
        
        TODO: Implement similarity search:
        1. Transform query using fitted TF-IDF vectorizer
        2. Calculate cosine similarity with all chunks
        3. Return top_k most similar chunks with scores
        
        Args:
            query (str): Search query
            top_k (int): Number of similar chunks to return
            
        Returns:
            list: List of (chunk_text, similarity_score, doc_id) tuples
        """
        if top_k <= 0:
            return []

        if not query or not query.strip():
            return []

        if self.document_vectors is None:
            vectors = self.build_search_index()
        else:
            vectors = self.document_vectors

        if vectors is None or not self.all_chunks:
            return []

        processed_query = self.preprocess_text(query)
        if not processed_query.strip():
            return []

        try:
            query_vector = self.vectorizer.transform([processed_query])
        except (NotFittedError, ValueError):
            return []

        similarities = cosine_similarity(query_vector, vectors).ravel()
        if similarities.size == 0:
            return []

        top_k = min(top_k, similarities.size)
        if top_k <= 0:
            return []

        if top_k < similarities.size:
            partition_indices = np.argpartition(-similarities, top_k - 1)[:top_k]
        else:
            partition_indices = np.arange(similarities.size)

        sorted_indices = partition_indices[np.argsort(similarities[partition_indices])[::-1]]

        results = []
        for idx in sorted_indices:
            results.append((self.all_chunks[idx], float(similarities[idx]), self.chunk_to_doc_mapping[idx]))

        return results
    
    def get_document_stats(self):
        """
        Get statistics about processed documents
        
        TODO: Return dictionary with:
        1. Number of documents processed
        2. Total chunks created
        3. Average document length
        4. List of document titles
        """
        num_documents = len(self.documents)
        if not num_documents:
            return {
                'num_documents': 0,
                'total_chunks': 0,
                'avg_document_length': 0.0,
                'titles': [],
            }

        total_chunks = len(self.all_chunks)
        total_length = 0
        titles = []

        for doc in self.documents.values():
            metadata = doc.get('metadata') or {}
            total_length += metadata.get('char_length') or 0
            titles.append(doc.get('title') or metadata.get('title') or '')

        avg_length = total_length / num_documents if total_length else 0.0

        return {
            'num_documents': num_documents,
            'total_chunks': total_chunks,
            'avg_document_length': avg_length,
            'titles': titles,
        }

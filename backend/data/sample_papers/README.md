# Sample Papers Directory

This directory is where you should place your research documents for processing by the ResearchGPT Assistant.

## Supported File Types

- **PDF files** (`.pdf`) - Research papers, articles, documents
- **Text files** (`.txt`) - Plain text documents, abstracts, notes

## How to Add Documents

1. **Copy your files here**
   ```bash
   cp your_research_paper.pdf data/sample_papers/
   cp your_notes.txt data/sample_papers/
   ```

2. **Or drag and drop files** into this directory using your file manager

## Example Usage

After adding documents, run the system:

```bash
python main.py
```

The system will:
- Automatically detect and process all supported files
- Extract and preprocess text content
- Build a searchable index
- Enable question-answering and summarization

## File Organization

You can organize your documents in subdirectories if needed:

```
data/sample_papers/
├── research_papers/
│   ├── paper1.pdf
│   └── paper2.pdf
├── notes/
│   ├── meeting_notes.txt
│   └── ideas.txt
└── README.md (this file)
```

## Tips

- **File names**: Use descriptive names as they become document IDs
- **File size**: Larger documents will take longer to process
- **Content quality**: Better formatted documents produce better results
- **Multiple formats**: Mix PDF and text files as needed

## Troubleshooting

If documents aren't being processed:
- Check file permissions
- Ensure files aren't corrupted
- Verify file extensions (.pdf or .txt)
- Check the console output for error messages

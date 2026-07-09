"""
AI Agents for ResearchGPT Assistant

This module implements specialized AI agents for different research tasks:
- BaseAgent: Common interface for all agents
- SummarizerAgent: Document summarization
- QAAgent: Question answering
- ResearchWorkflowAgent: Complete research workflows
- AgentOrchestrator: Multi-agent coordination
"""

from mistralai import Mistral
import json
import logging
from abc import ABC, abstractmethod

class BaseAgent(ABC):
    """Base class for all research agents."""
    
    def __init__(self, config, document_processor):
        self.config = config
        self.document_processor = document_processor
        self.client = Mistral(api_key=config["mistral_api_key"])
        
    @abstractmethod
    def process(self, input_data):
        """Process input data and return results."""
        pass
        
    def _call_mistral(self, prompt, temperature=0.7, model="mistral-small-latest"):
        """Make API call to Mistral with error handling."""
        try:
            response = self.client.chat.complete(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
            )
            return response.choices[0].message.content
        except Exception as e:
            logging.error(f"Mistral API Error: {e}")
            return None

class SummarizerAgent(BaseAgent):
    """Agent specialized in document summarization."""
    
    def __init__(self, config, document_processor):
        super().__init__(config, document_processor)
        self.prompt_template = (
            "Summarize the following document content in 2-3 concise paragraphs. "
            "Focus on key findings, main arguments, and important conclusions.\n\n"
            "Content:\n{content}\n\n"
            "Summary:"
        )
    
    def process(self, input_data):
        """Summarize document content."""
        if isinstance(input_data, str):
            content = input_data
        elif isinstance(input_data, dict) and 'content' in input_data:
            content = input_data['content']
        else:
            return {"error": "Invalid input format"}
            
        prompt = self.prompt_template.format(content=content)
        summary = self._call_mistral(prompt, temperature=0.3)
        
        return {
            "type": "summary",
            "input_length": len(content),
            "summary": summary or "Failed to generate summary",
            "timestamp": "2025-09-27T23:54:39Z"
        }

class QAAgent(BaseAgent):
    """Agent specialized in question answering."""
    
    def __init__(self, config, document_processor):
        super().__init__(config, document_processor)
        self.prompt_template = (
            "Answer the following question using ONLY the provided context. "
            "If the answer cannot be found in the context, say 'Not found in provided context.'\n\n"
            "Context:\n{context}\n\n"
            "Question: {question}\n\n"
            "Answer:"
        )
    
    def process(self, input_data):
        """Answer questions using document context."""
        if not isinstance(input_data, dict) or 'question' not in input_data:
            return {"error": "Input must contain 'question' field"}
            
        question = input_data['question']
        
        # Find relevant chunks
        chunks = self.document_processor.find_similar_chunks(question, top_k=5)
        
        if not chunks:
            return {
                "type": "qa",
                "question": question,
                "answer": "No relevant documents found to answer this question.",
                "context_used": False
            }
        
        # Combine context from chunks
        context = "\n\n".join([chunk[0] for chunk in chunks])
        
        prompt = self.prompt_template.format(context=context, question=question)
        answer = self._call_mistral(prompt, temperature=0.3)
        
        return {
            "type": "qa",
            "question": question,
            "answer": answer or "Failed to generate answer",
            "context_used": True,
            "sources": [chunk[2] for chunk in chunks]  # Document IDs
        }

class ResearchWorkflowAgent(BaseAgent):
    """Agent that orchestrates complete research workflows."""
    
    def __init__(self, config, document_processor):
        super().__init__(config, document_processor)
        self.summarizer = SummarizerAgent(config, document_processor)
        self.qa_agent = QAAgent(config, document_processor)
        
    def process(self, input_data):
        """Execute a complete research workflow."""
        if not isinstance(input_data, dict) or 'research_query' not in input_data:
            return {"error": "Input must contain 'research_query' field"}
            
        research_query = input_data['research_query']
        
        # Step 1: Find relevant documents
        chunks = self.document_processor.find_similar_chunks(research_query, top_k=10)
        
        if not chunks:
            return {
                "type": "research_workflow",
                "query": research_query,
                "status": "failed",
                "reason": "No relevant documents found"
            }
        
        # Step 2: Generate summary of relevant content
        combined_content = "\n\n".join([chunk[0] for chunk in chunks])
        summary_result = self.summarizer.process(combined_content)
        
        # Step 3: Answer specific questions about the research query
        qa_result = self.qa_agent.process({"question": research_query})
        
        # Step 4: Generate research insights
        insights_prompt = (
            "Based on the research query and findings, provide 3-5 key insights:\n\n"
            f"Research Query: {research_query}\n\n"
            f"Summary: {summary_result.get('summary', '')}\n\n"
            f"Key Answer: {qa_result.get('answer', '')}\n\n"
            "Key Insights:"
        )
        
        insights = self._call_mistral(insights_prompt, temperature=0.5)
        
        return {
            "type": "research_workflow",
            "query": research_query,
            "status": "completed",
            "summary": summary_result,
            "qa_result": qa_result,
            "insights": insights or "Failed to generate insights",
            "documents_analyzed": len(set([chunk[2] for chunk in chunks])),
            "total_chunks": len(chunks)
        }

class AgentOrchestrator:
    """Orchestrates multiple agents for complex tasks."""
    
    def __init__(self, config, document_processor):
        self.config = config
        self.document_processor = document_processor
        self.agents = {
            "summarizer": SummarizerAgent(config, document_processor),
            "qa": QAAgent(config, document_processor),
            "research_workflow": ResearchWorkflowAgent(config, document_processor)
        }
    
    def route_task(self, task_type, input_data):
        """Route task to appropriate agent."""
        if task_type not in self.agents:
            return {"error": f"Unknown task type: {task_type}"}
            
        agent = self.agents[task_type]
        return agent.process(input_data)
    
    def coordinate_multi_agent_workflow(self, research_query):
        """Coordinate multiple agents for comprehensive research."""
        # Step 1: Research workflow agent for overall analysis
        workflow_result = self.agents["research_workflow"].process({
            "research_query": research_query
        })
        
        # Step 2: Generate additional specific questions
        follow_up_questions = [
            f"What are the main challenges in {research_query}?",
            f"What are the future directions for {research_query}?",
            f"What methodologies are used in {research_query}?"
        ]
        
        qa_results = []
        for question in follow_up_questions:
            qa_result = self.agents["qa"].process({"question": question})
            qa_results.append(qa_result)
        
        return {
            "type": "multi_agent_coordination",
            "primary_research": workflow_result,
            "follow_up_qa": qa_results,
            "total_questions_processed": len(follow_up_questions) + 1
        }

# Legacy class for backward compatibility
class ResearchGPTAssistant(BaseAgent):
    """Legacy assistant class that maintains backward compatibility."""
    
    def __init__(self, config, document_processor):
        super().__init__(config, document_processor)
        
    def process(self, input_data):
        """Process using QA agent functionality."""
        qa_agent = QAAgent(self.config, self.document_processor)
        return qa_agent.process(input_data)
        
    def _call_mistral(self, prompt, temperature=0.7, model="mistral-tiny"):
        """Legacy method for backward compatibility."""
        return super()._call_mistral(prompt, temperature, model)
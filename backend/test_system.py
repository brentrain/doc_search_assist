"""
Comprehensive Testing System for ResearchGPT Assistant

This module provides comprehensive testing for all system components:
- Document processing testing
- Advanced prompting strategy testing
- Agent performance evaluation
- System integration testing
"""

import json
import time
import logging
from pathlib import Path
from research_agents import AgentOrchestrator, SummarizerAgent, QAAgent, ResearchWorkflowAgent
from document_processor import DocumentProcessor
from config import Config

class ResearchGPTTester:
    """Comprehensive testing suite for ResearchGPT system."""
    
    def __init__(self):
        self.config = Config()
        self.document_processor = DocumentProcessor(self.config)
        # Convert config object to dict format expected by agents
        config_dict = {
            "mistral_api_key": self.config.MISTRAL_API_KEY,
            "data_dir": self.config.DATA_DIR,
            "artifacts_dir": "artifacts",
            "results_path": "artifacts/results.json",
            "test_query": "What problem does HeartSenseAI solve?",
            "model": self.config.MODEL_NAME,
            "temperature": self.config.TEMPERATURE,
        }
        self.orchestrator = AgentOrchestrator(config_dict, self.document_processor)
        self.test_results = {}
        
    def setup_test_environment(self):
        """Set up test environment with sample documents."""
        logging.info("Setting up test environment...")
        
        # Process sample documents
        sample_dir = Path("data/sample_papers")
        if sample_dir.exists():
            for file_path in sample_dir.glob("*.txt"):
                try:
                    doc_id = self.document_processor.process_document(str(file_path))
                    logging.info(f"Processed document: {doc_id}")
                except Exception as e:
                    logging.error(f"Failed to process {file_path}: {e}")
        
        # Build search index
        self.document_processor.build_search_index()
        
        # Get document statistics
        stats = self.document_processor.get_document_stats()
        logging.info(f"Document stats: {stats}")
        
        return stats
    
    def test_document_processing(self):
        """Test document processing functionality."""
        logging.info("Testing document processing...")
        
        start_time = time.time()
        
        # Test document statistics
        stats = self.document_processor.get_document_stats()
        
        # Test similarity search
        test_query = "machine learning healthcare"
        similar_chunks = self.document_processor.find_similar_chunks(test_query, top_k=3)
        
        processing_time = time.time() - start_time
        
        result = {
            "status": "passed" if stats['num_documents'] > 0 else "failed",
            "documents_processed": stats['num_documents'],
            "total_chunks": stats['total_chunks'],
            "similarity_search_results": len(similar_chunks),
            "processing_time": processing_time,
            "avg_document_length": stats['avg_document_length']
        }
        
        self.test_results["document_processing"] = result
        return result
    
    def test_agent_performance(self):
        """Test individual agent performance."""
        logging.info("Testing agent performance...")
        
        agents_results = {}
        
        # Test Summarizer Agent
        start_time = time.time()
        summarizer = SummarizerAgent(self.config.__dict__, self.document_processor)
        test_content = "This is a test document about artificial intelligence in healthcare."
        summary_result = summarizer.process(test_content)
        summarizer_time = time.time() - start_time
        
        agents_results["summarizer"] = {
            "status": "passed" if summary_result.get("summary") else "failed",
            "response_time": summarizer_time,
            "result": summary_result
        }
        
        # Test QA Agent
        start_time = time.time()
        qa_agent = QAAgent(self.config.__dict__, self.document_processor)
        qa_result = qa_agent.process({"question": "What is HeartSenseAI?"})
        qa_time = time.time() - start_time
        
        agents_results["qa_agent"] = {
            "status": "passed" if qa_result.get("answer") else "failed",
            "response_time": qa_time,
            "result": qa_result
        }
        
        # Test Research Workflow Agent
        start_time = time.time()
        workflow_agent = ResearchWorkflowAgent(self.config.__dict__, self.document_processor)
        workflow_result = workflow_agent.process({"research_query": "AI in healthcare"})
        workflow_time = time.time() - start_time
        
        agents_results["workflow_agent"] = {
            "status": "passed" if workflow_result.get("status") == "completed" else "failed",
            "response_time": workflow_time,
            "result": workflow_result
        }
        
        self.test_results["agent_performance"] = agents_results
        return agents_results
    
    def test_multi_agent_coordination(self):
        """Test multi-agent coordination."""
        logging.info("Testing multi-agent coordination...")
        
        start_time = time.time()
        
        # Test orchestrator routing
        qa_result = self.orchestrator.route_task("qa", {"question": "What problem does HeartSenseAI solve?"})
        
        # Test multi-agent workflow
        coordination_result = self.orchestrator.coordinate_multi_agent_workflow("machine learning in healthcare")
        
        coordination_time = time.time() - start_time
        
        result = {
            "status": "passed" if coordination_result.get("type") == "multi_agent_coordination" else "failed",
            "response_time": coordination_time,
            "qa_routing_result": qa_result,
            "coordination_result": coordination_result
        }
        
        self.test_results["multi_agent_coordination"] = result
        return result
    
    def test_advanced_prompting_strategies(self):
        """Test advanced prompting strategies."""
        logging.info("Testing advanced prompting strategies...")
        
        # This would test Chain-of-Thought, Self-Consistency, and ReAct
        # For now, we'll test the basic functionality
        
        test_questions = [
            "What is HeartSenseAI?",
            "How does machine learning help in healthcare?",
            "What are the challenges in AI healthcare applications?"
        ]
        
        prompting_results = {}
        
        for question in test_questions:
            start_time = time.time()
            result = self.orchestrator.route_task("qa", {"question": question})
            response_time = time.time() - start_time
            
            prompting_results[question] = {
                "response_time": response_time,
                "answer_length": len(result.get("answer", "")),
                "context_used": result.get("context_used", False)
            }
        
        self.test_results["advanced_prompting"] = prompting_results
        return prompting_results
    
    def run_performance_benchmark(self):
        """Run comprehensive performance benchmark."""
        logging.info("Running performance benchmark...")
        
        benchmark_results = {
            "document_processing": self.test_document_processing(),
            "agent_performance": self.test_agent_performance(),
            "multi_agent_coordination": self.test_multi_agent_coordination(),
            "advanced_prompting": self.test_advanced_prompting_strategies()
        }
        
        # Calculate overall performance metrics
        total_tests = 0
        passed_tests = 0
        total_response_time = 0
        
        for category, results in benchmark_results.items():
            if isinstance(results, dict):
                if "status" in results:
                    total_tests += 1
                    if results["status"] == "passed":
                        passed_tests += 1
                    if "response_time" in results:
                        total_response_time += results["response_time"]
                elif isinstance(results, dict):
                    for test_name, test_result in results.items():
                        total_tests += 1
                        if isinstance(test_result, dict) and test_result.get("status") == "passed":
                            passed_tests += 1
                        if isinstance(test_result, dict) and "response_time" in test_result:
                            total_response_time += test_result["response_time"]
        
        benchmark_results["overall_metrics"] = {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "success_rate": (passed_tests / total_tests * 100) if total_tests > 0 else 0,
            "average_response_time": total_response_time / total_tests if total_tests > 0 else 0
        }
        
        self.test_results["performance_benchmark"] = benchmark_results
        return benchmark_results
    
    def generate_evaluation_report(self):
        """Generate comprehensive evaluation report."""
        logging.info("Generating evaluation report...")
        
        # Ensure all tests have been run
        if not self.test_results:
            self.run_performance_benchmark()
        
        report = {
            "evaluation_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "system_version": "ResearchGPT v1.0",
            "test_results": self.test_results,
            "summary": {
                "overall_status": "PASSED" if self._calculate_overall_success_rate() > 80 else "FAILED",
                "success_rate": self._calculate_overall_success_rate(),
                "recommendations": self._generate_recommendations()
            }
        }
        
        # Save report to file
        report_path = Path("artifacts/evaluation_report.json")
        report_path.parent.mkdir(exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2))
        
        logging.info(f"Evaluation report saved to {report_path}")
        return report
    
    def _calculate_overall_success_rate(self):
        """Calculate overall success rate from test results."""
        total_tests = 0
        passed_tests = 0
        
        for category, results in self.test_results.items():
            if isinstance(results, dict):
                if "status" in results:
                    total_tests += 1
                    if results["status"] == "passed":
                        passed_tests += 1
                elif isinstance(results, dict):
                    for test_name, test_result in results.items():
                        if isinstance(test_result, dict) and "status" in test_result:
                            total_tests += 1
                            if test_result["status"] == "passed":
                                passed_tests += 1
        
        return (passed_tests / total_tests * 100) if total_tests > 0 else 0
    
    def _generate_recommendations(self):
        """Generate recommendations based on test results."""
        recommendations = []
        
        success_rate = self._calculate_overall_success_rate()
        
        if success_rate < 70:
            recommendations.append("System requires significant improvements before deployment")
        elif success_rate < 90:
            recommendations.append("System is functional but could benefit from optimization")
        else:
            recommendations.append("System is performing well and ready for production use")
        
        # Check specific areas for improvement
        if "document_processing" in self.test_results:
            doc_stats = self.test_results["document_processing"]
            if doc_stats.get("documents_processed", 0) == 0:
                recommendations.append("Add more sample documents for better testing coverage")
        
        if "agent_performance" in self.test_results:
            agent_results = self.test_results["agent_performance"]
            for agent_name, result in agent_results.items():
                if result.get("status") != "passed":
                    recommendations.append(f"Improve {agent_name} performance and reliability")
        
        return recommendations

def main():
    """Main testing function."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
    
    tester = ResearchGPTTester()
    
    # Set up test environment
    tester.setup_test_environment()
    
    # Run comprehensive tests
    print("Starting ResearchGPT System Testing...")
    print("=" * 50)
    
    # Run performance benchmark
    benchmark_results = tester.run_performance_benchmark()
    
    # Generate evaluation report
    report = tester.generate_evaluation_report()
    
    # Print summary
    print("\nTesting Complete!")
    print("=" * 50)
    print(f"Overall Success Rate: {report['summary']['success_rate']:.1f}%")
    print(f"Overall Status: {report['summary']['overall_status']}")
    print(f"Total Tests: {benchmark_results['performance_benchmark']['overall_metrics']['total_tests']}")
    print(f"Passed Tests: {benchmark_results['performance_benchmark']['overall_metrics']['passed_tests']}")
    
    print("\nRecommendations:")
    for rec in report['summary']['recommendations']:
        print(f"- {rec}")
    
    print(f"\nDetailed report saved to: artifacts/evaluation_report.json")

if __name__ == "__main__":
    main()
import json
import sys
import io
from collections import defaultdict, Counter
from datetime import datetime

# Force UTF-8 encoding for output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def analyze_tasks():
    # Read tasks data
    with open(".taskmaster/tasks/tasks.json", "r") as f:
        tasks_data = json.load(f)
    
    # Analyze master tasks
    master_tasks = tasks_data.get('master', {}).get('tasks', [])
    
    # Initialize counters
    total_tasks = len(master_tasks)
    status_counts = Counter()
    priority_counts = Counter()
    complexity_scores = []
    category_counts = defaultdict(int)
    pending_tasks = []
    in_progress_tasks = []
    high_complexity_tasks = []
    
    # Task categories based on titles
    categories = {
        'UI/Frontend': ['UI', 'Component', 'Frontend', 'React', 'Display', 'Dashboard', 'View'],
        'Backend/API': ['API', 'Backend', 'Server', 'Endpoint', 'Route', 'REST'],
        'WebSocket/Realtime': ['WebSocket', 'Real-time', 'Stream', 'Telemetry', 'Socket'],
        'Security/Auth': ['Security', 'Auth', 'RBAC', 'Permission', 'Token', 'Login'],
        'Data/Database': ['Database', 'Data', 'SQL', 'Migration', 'Schema'],
        'Testing': ['Test', 'Testing', 'Coverage', 'Unit', 'Integration'],
        'Documentation': ['Documentation', 'Docs', 'README', 'Guide'],
        'DevOps/Infrastructure': ['Docker', 'Deploy', 'CI/CD', 'Build', 'Infrastructure'],
        'AI/ML': ['AI', 'ML', 'Model', 'Training', 'Prediction'],
        'Performance': ['Performance', 'Optimization', 'Cache', 'Speed'],
        'Error/Monitoring': ['Error', 'Logging', 'Monitor', 'Alert', 'Metrics']
    }
    
    # Analyze each task
    for task in master_tasks:
        # Status analysis
        status = task.get('status', 'unknown')
        status_counts[status] += 1
        
        # Priority analysis
        priority = task.get('priority', 'unknown')
        priority_counts[priority] += 1
        
        # Complexity analysis
        if 'complexityScore' in task:
            complexity_scores.append(task['complexityScore'])
            if task['complexityScore'] >= 8:
                high_complexity_tasks.append(task)
        
        # Categorize tasks
        title = task.get('title', '').lower()
        task_categorized = False
        for category, keywords in categories.items():
            for keyword in keywords:
                if keyword.lower() in title:
                    category_counts[category] += 1
                    task_categorized = True
                    break
            if task_categorized:
                break
        if not task_categorized:
            category_counts['Other'] += 1
        
        # Collect pending and in-progress tasks
        if status == 'pending':
            pending_tasks.append(task)
        elif status == 'in-progress':
            in_progress_tasks.append(task)
        
        # Analyze subtasks
        if 'subtasks' in task:
            for subtask in task['subtasks']:
                substatus = subtask.get('status', 'unknown')
                if substatus == 'pending':
                    pending_tasks.append(subtask)
                elif substatus == 'in-progress':
                    in_progress_tasks.append(subtask)
    
    # Generate report
    print(f"=== TASKMASTER ANALYSIS REPORT ===")
    print(f"\nTotal Tasks: {total_tasks}")
    
    print(f"\n== Status Distribution:")
    for status, count in status_counts.most_common():
        percentage = (count / total_tasks) * 100
        print(f"  - {status}: {count} ({percentage:.1f}%)")
    
    print(f"\n== Priority Distribution:")
    for priority, count in priority_counts.most_common():
        percentage = (count / total_tasks) * 100
        print(f"  - {priority}: {count} ({percentage:.1f}%)")
    
    if complexity_scores:
        avg_complexity = sum(complexity_scores) / len(complexity_scores)
        print(f"\n== Complexity Analysis:")
        print(f"  - Average Complexity: {avg_complexity:.1f}")
        print(f"  - High Complexity Tasks (8+): {len(high_complexity_tasks)}")
        print(f"  - Complexity Range: {min(complexity_scores)} - {max(complexity_scores)}")
    
    print(f"\n== Task Categories:")
    for category, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {category}: {count}")
    
    print(f"\n== Work in Progress:")
    print(f"  - In-Progress Tasks: {len(in_progress_tasks)}")
    print(f"  - Pending Tasks: {len(pending_tasks)}")
    
    # Identify patterns for agent recommendations
    print(f"\n== AGENT RECOMMENDATIONS BASED ON ANALYSIS:")
    
    recommendations = []
    
    # Based on categories
    if category_counts['UI/Frontend'] > 5:
        recommendations.append({
            'name': 'UI/UX Specialist',
            'reason': f"Found {category_counts['UI/Frontend']} UI/Frontend tasks",
            'focus': 'React components, UI state management, responsive design'
        })
    
    if category_counts['Backend/API'] > 5:
        recommendations.append({
            'name': 'Backend API Architect',
            'reason': f"Found {category_counts['Backend/API']} Backend/API tasks",
            'focus': 'FastAPI endpoints, data models, API design patterns'
        })
    
    if category_counts['WebSocket/Realtime'] > 3:
        recommendations.append({
            'name': 'Real-time Systems Expert',
            'reason': f"Found {category_counts['WebSocket/Realtime']} WebSocket/Realtime tasks",
            'focus': 'WebSocket protocols, streaming data, connection management'
        })
    
    if category_counts['Security/Auth'] > 3:
        recommendations.append({
            'name': 'Security Engineer',
            'reason': f"Found {category_counts['Security/Auth']} Security/Auth tasks",
            'focus': 'Authentication, authorization, RBAC, JWT tokens'
        })
    
    if category_counts['Testing'] > 3:
        recommendations.append({
            'name': 'Test Automation Engineer',
            'reason': f"Found {category_counts['Testing']} Testing tasks",
            'focus': 'Unit tests, integration tests, test coverage'
        })
    
    if len(high_complexity_tasks) > 5:
        recommendations.append({
            'name': 'Complex Systems Architect',
            'reason': f"Found {len(high_complexity_tasks)} high-complexity tasks",
            'focus': 'System design, architecture patterns, complex integrations'
        })
    
    # Based on specific task patterns
    if any('performance' in str(task).lower() for task in master_tasks):
        recommendations.append({
            'name': 'Performance Optimization Specialist',
            'reason': 'Performance-related tasks detected',
            'focus': 'Performance profiling, optimization strategies, caching'
        })
    
    for rec in recommendations:
        print(f"\n  [+] {rec['name']}")
        print(f"     Reason: {rec['reason']}")
        print(f"     Focus: {rec['focus']}")
    
    # Export detailed analysis
    analysis_data = {
        'total_tasks': total_tasks,
        'status_distribution': dict(status_counts),
        'priority_distribution': dict(priority_counts),
        'category_distribution': dict(category_counts),
        'average_complexity': avg_complexity if complexity_scores else 0,
        'high_complexity_count': len(high_complexity_tasks),
        'pending_count': len(pending_tasks),
        'in_progress_count': len(in_progress_tasks),
        'agent_recommendations': recommendations,
        'analysis_timestamp': datetime.now().isoformat()
    }
    
    with open('task_analysis_report.json', 'w') as f:
        json.dump(analysis_data, f, indent=2)
    
    print(f"\n>> Detailed analysis saved to task_analysis_report.json")

if __name__ == "__main__":
    analyze_tasks()
"""Benchmark candidate ranking over 100,000 synthetic candidates.

Compares:
1. Inverted Skill Index (O(Q * L) posting list walk)
2. Naive Linear Scan (O(N * (K + Q)) full corpus scan)

Provides empirical evidence for Task 2a.
"""
import random
import time
import sys
from task2_solutions import build_skill_index, rank_candidates, rank_candidates_linear

SKILL_POOL = [
    "Python", "Java", "Kotlin", "Go", "TypeScript", "JavaScript", "C++", "C#", "Rust", "Swift",
    "React", "Next.js", "Vue.js", "Angular", "HTML5", "CSS3", "TailwindCSS", "Node.js", "FastAPI",
    "Django", "Flask", "Spring Boot", "Express", "GraphQL", "REST APIs", "gRPC", "PostgreSQL",
    "MySQL", "MongoDB", "Redis", "Cassandra", "Elasticsearch", "Vector DBs", "Docker", "Kubernetes",
    "Terraform", "Ansible", "CI/CD", "AWS", "GCP", "Azure", "Kafka", "RabbitMQ", "Microservices",
    "System Design", "Distributed Systems", "LLM APIs", "LangChain", "LlamaIndex", "PyTorch",
    "TensorFlow", "Scikit-Learn", "Pandas", "NumPy", "Cypress", "Selenium", "Jest", "pytest", "Git"
]


def generate_candidates(n: int = 100_000, seed: int = 42) -> list[dict]:
    """Generate N synthetic candidate profiles with realistic skill sets."""
    print(f"Generating {n:,} synthetic candidates...")
    random.seed(seed)
    candidates = []
    first_names = ["Aarav", "Neha", "Rohit", "Pooja", "Vikram", "Anjali", "Suresh", "Kavya", "Aditya", "Riya",
                   "Sameer", "Swati", "Kunal", "Sneha", "Manoj", "Payal", "Harsh", "Tanya", "Arjun", "Preeti"]
    last_names = ["Sharma", "Verma", "Patel", "Mehta", "Nair", "Rao", "Gupta", "Chatterjee", "Bhatt", "Kapoor"]

    for i in range(n):
        num_skills = random.randint(4, 10)
        skills = random.sample(SKILL_POOL, num_skills)
        fname = random.choice(first_names)
        lname = random.choice(last_names)
        candidates.append({
            "id": f"cand_{i+1:06d}",
            "name": f"{fname} {lname}",
            "skills": skills,
            "years_experience": random.randint(1, 15),
            "target_role": random.choice(["Full-Stack Engineer", "Backend Engineer", "ML Engineer", "DevOps Engineer"])
        })
    print(f"Generated {len(candidates):,} candidates successfully.")
    return candidates


def run_benchmark():
    n_candidates = 100_000
    candidates = generate_candidates(n_candidates)

    print("\n--- Phase 1: Inverted Index Construction ---")
    start_index = time.perf_counter()
    index = build_skill_index(candidates)
    index_time = time.perf_counter() - start_index
    print(f"Inverted index built in {index_time:.3f} seconds.")
    print(f"Total distinct skills indexed: {len(index)}")
    total_postings = sum(len(p) for p in index.values())
    print(f"Total posting entries: {total_postings:,} (avg {total_postings / len(index):,.0f} per skill)")

    # Sample query sets
    queries = [
        ["Python", "FastAPI", "Docker", "PostgreSQL"],
        ["React", "TypeScript", "Next.js"],
        ["Kubernetes", "AWS", "Terraform", "CI/CD", "Docker"],
        ["Java", "Spring Boot", "Microservices", "Kafka"],
        ["Python", "PyTorch", "LLM APIs", "Vector DBs", "LangChain"]
    ]

    print("\n--- Phase 2: Query Latency Benchmark (100 Repeated Recruiter Queries) ---")
    num_runs = 20  # 20 reps * 5 queries = 100 total searches

    # Inverted Index Benchmark
    start_ii = time.perf_counter()
    ii_total_matches = 0
    for _ in range(num_runs):
        for q in queries:
            results = rank_candidates(candidates, q, index=index)
            ii_total_matches += len(results)
    ii_time = time.perf_counter() - start_ii
    ii_avg_ms = (ii_time / (num_runs * len(queries))) * 1000
    ii_qps = (num_runs * len(queries)) / ii_time

    print(f"Inverted Index Search:")
    print(f"  - Total queries executed: {num_runs * len(queries)}")
    print(f"  - Total elapsed time:    {ii_time:.3f} seconds")
    print(f"  - Average latency:       {ii_avg_ms:.2f} ms / query")
    print(f"  - Throughput:            {ii_qps:.1f} queries / second (QPS)")

    # Naive Linear Scan Benchmark
    print("\n--- Phase 3: Baseline Naive Linear Scan (10 Queries) ---")
    linear_runs = 2  # 2 reps * 5 queries = 10 searches (linear scan is much slower)
    start_linear = time.perf_counter()
    linear_total_matches = 0
    for _ in range(linear_runs):
        for q in queries:
            results = rank_candidates_linear(candidates, q)
            linear_total_matches += len(results)
    linear_time = time.perf_counter() - start_linear
    linear_avg_ms = (linear_time / (linear_runs * len(queries))) * 1000
    linear_qps = (linear_runs * len(queries)) / linear_time

    print(f"Linear Scan Search:")
    print(f"  - Total queries executed: {linear_runs * len(queries)}")
    print(f"  - Total elapsed time:    {linear_time:.3f} seconds")
    print(f"  - Average latency:       {linear_avg_ms:.2f} ms / query")
    print(f"  - Throughput:            {linear_qps:.1f} queries / second (QPS)")

    # Speedup calculation
    speedup = linear_avg_ms / ii_avg_ms if ii_avg_ms > 0 else 0
    print(f"\n==================================================")
    print(f"BENCHMARK SUMMARY FOR 100,000 CANDIDATES:")
    print(f"Inverted Index Average Latency: {ii_avg_ms:.2f} ms")
    print(f"Linear Scan Average Latency:    {linear_avg_ms:.2f} ms")
    print(f"Performance Speedup:            {speedup:.1f}x FASTER")
    print(f"==================================================")


if __name__ == "__main__":
    run_benchmark()

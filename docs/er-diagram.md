# ER Diagram

Schema: `collatz`

```mermaid
erDiagram
  COLLATZ_GENERATIONS {
    bigint id PK
    int limit_value UK
    timestamptz created_at
    int longest_chain_start
    int longest_chain_length
    int highest_peak_start
    bigint highest_peak_value
    int unique_node_count
    int unique_edge_count
  }

  COLLATZ_SEQUENCES {
    bigint generation_id PK, FK
    int start_n PK
    int steps
    bigint max_value
    bigint[] path
  }

  COLLATZ_EDGES {
    bigint generation_id PK, FK
    bigint source_value PK
    bigint target_value PK
    int weight
  }

  COLLATZ_GENERATIONS ||--o{ COLLATZ_SEQUENCES : one_to_many
  COLLATZ_GENERATIONS ||--o{ COLLATZ_EDGES : one_to_many
```

Notes:

- `collatz.generations.limit_value` is unique (`uq_generations_limit_value`).
- `collatz.sequences` primary key is (`generation_id`, `start_n`).
- `collatz.edges` primary key is (`generation_id`, `source_value`, `target_value`).
- `collatz.sequences.generation_id` and `collatz.edges.generation_id` use `ON DELETE CASCADE`.
- Indexes:
    - `idx_sequences_generation_id`
    - `idx_edges_generation_id`

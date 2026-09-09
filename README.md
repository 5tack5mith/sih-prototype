# Criminal Network Analysis Platform

## Run the application

1. Create the environment file and replace every placeholder secret/password.

```bash
cp .env.example .env
```

Required values in `.env`:

```env
NEO4J_PASSWORD=your-neo4j-password
AUTH_SECRET_KEY=a-long-random-secret
AUTH_BOOTSTRAP_ADMIN_USERNAME=admin
AUTH_BOOTSTRAP_ADMIN_PASSWORD=a-strong-admin-password
```

To enable LLM-generated summaries, also set the API key. If it is omitted, the same batch step stores deterministic template summaries.

```env
OPENROUTER_API_KEY=your-openrouter-api-key
```

2. Build and start Neo4j and the API.

```bash
docker compose up --build -d
```

3. Load a dataset and generate the analytical graph and derived results.

```bash
docker compose --profile dataset run --rm --volume ./dataset_generator/output/showcase:/app/dataset_generator/output:ro ingest-dataset
docker compose --profile dataset run --rm project-person-graph
docker compose --profile analysis run --rm validate-scoping
docker compose --profile analysis run --rm project-graphs
docker compose --profile analysis run --rm core-algorithms
docker compose --profile analysis run --rm structural-roles
docker compose --profile analysis run --rm criticality
docker compose --profile analysis run --rm financial-patterns
docker compose --profile analysis run --rm summary-generation
```

4. Open the application services.

- API documentation: http://localhost:8000/docs
- Neo4j Browser: http://localhost:7474

5. Install and start the frontend in a separate terminal.

```bash
cd frontend
npm install
npm run dev
```

Open the frontend at http://localhost:5173.

6. Run the authenticated smoke test.

```bash
docker compose --profile smoke run --rm smoke-test
```

7. Stop the application.

```bash
docker compose down
```

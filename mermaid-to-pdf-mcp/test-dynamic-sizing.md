# Dynamic Sizing Test Document

## Simple Flowchart (Should be small)

```mermaid
flowchart TD
    A[Red] --> B[Yellow]
    B --> C[Green]
```

## Complex Flowchart (Should be larger)

```mermaid
flowchart LR
    A[Start Process] --> B{Decision Point}
    B -->|Yes| C[Execute Task 1]
    B -->|No| D[Execute Task 2]
    C --> E[Subprocess A]
    D --> F[Subprocess B]
    E --> G{Another Decision}
    F --> G
    G -->|Option 1| H[Final Step 1]
    G -->|Option 2| I[Final Step 2]
    G -->|Option 3| J[Final Step 3]
    H --> K[End]
    I --> K
    J --> K
    
    L[Parallel Process] --> M[Task X]
    M --> N[Task Y]
    N --> O[Task Z]
    O --> G
```

## Wide Sequence Diagram (Should auto-width)

```mermaid
sequenceDiagram
    participant User
    participant WebApp
    participant API
    participant Database
    participant Cache
    participant Queue
    participant EmailService
    
    User->>WebApp: Login Request
    WebApp->>API: Authenticate
    API->>Database: Check Credentials
    Database-->>API: User Data
    API->>Cache: Store Session
    Cache-->>API: Confirmed
    API-->>WebApp: Auth Token
    WebApp-->>User: Dashboard
    
    User->>WebApp: Send Email
    WebApp->>API: Email Request
    API->>Queue: Add Job
    Queue->>EmailService: Process
    EmailService-->>Queue: Sent
    Queue-->>API: Success
    API-->>WebApp: Confirmed
    WebApp-->>User: Email Sent
```

## Entity Relationship Diagram (Should be tall)

```mermaid
erDiagram
    Customer ||--o{ Order : places
    Customer {
        int id PK
        string name
        string email
        string phone
        string address
        date created_at
    }
    Order ||--|{ OrderItem : contains
    Order {
        int id PK
        int customer_id FK
        date order_date
        string status
        decimal total
        string shipping_address
    }
    OrderItem {
        int id PK
        int order_id FK
        int product_id FK
        int quantity
        decimal price
    }
    Product ||--o{ OrderItem : ordered
    Product {
        int id PK
        string name
        string description
        decimal price
        int stock
        string category
    }
    Category ||--o{ Product : contains
    Category {
        int id PK
        string name
        string description
    }
```
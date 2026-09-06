# GSQUAD system design

This document moves from the system boundary into the primary runtime, authorization, data, and deployment flows.

## Component architecture

```mermaid
flowchart TB
    subgraph Client[Browser client]
      UI[React interface]
      STATE[Auth and conversation hooks]
      HTTP[HTTP API client]
      SOCKET[WebSocket client]
      PREVIEW[Local media preview]
      UI --> STATE
      STATE --> HTTP
      STATE --> SOCKET
      UI --> PREVIEW
    end

    subgraph App[Application service]
      API[Express routes]
      AUTH[JWT cookie authentication]
      RULES[Membership friendship and ownership rules]
      WSS[WebSocket server]
      STORAGE[S3 signing adapter]
      API --> AUTH --> RULES
      API --> STORAGE
      WSS --> AUTH
    end

    subgraph Data[Data services]
      PG[(PostgreSQL)]
      REDIS[(Redis)]
      S3[(Private object storage)]
    end

    HTTP -->|HTTPS| API
    SOCKET <-->|Realtime events| WSS
    API --> PG
    WSS --> PG
    API --> REDIS
    WSS <--> REDIS
    STORAGE -->|Presign and verify| S3
    PREVIEW -->|Presigned PUT| S3
    S3 -->|Signed GET| UI
```

## Text-message write path

```mermaid
sequenceDiagram
    actor User
    participant React as React client
    participant API as Express API
    participant DB as PostgreSQL
    participant Redis
    participant WS as Recipient sockets

    User->>React: Send message
    React->>React: Insert optimistic message
    React->>API: POST conversation message
    API->>DB: Verify access rules
    API->>DB: Insert message and notifications
    DB-->>API: Durable message
    API->>Redis: Publish recipient-scoped event
    Redis->>WS: Fan out across instances
    WS-->>React: message_created
    API-->>React: Created message
    React->>React: Reconcile and de-duplicate
```

## Attachment write path

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant API
    participant S3 as Private object storage
    participant DB as PostgreSQL
    participant Redis

    User->>Browser: Select photo or video
    Browser->>Browser: Show local preview
    Browser->>API: Request upload URL and metadata
    API->>DB: Verify conversation membership
    API-->>Browser: Signed PUT and object key
    Browser->>S3: Upload bytes with progress
    S3-->>Browser: Upload complete
    Browser->>API: Send message with object metadata
    API->>S3: Verify object type and size
    API->>DB: Insert message and attachment
    API->>S3: Create signed viewing URL
    API->>Redis: Publish message event
    API-->>Browser: Created attachment message
```

## Authorization decisions

```mermaid
flowchart TD
    REQUEST[Request] --> SESSION{Valid session?}
    SESSION -- No --> R401[401 Unauthorized]
    SESSION -- Yes --> SCOPE{Conversation operation?}
    SCOPE -- No --> DOMAIN[Apply user or social rule]
    SCOPE -- Yes --> MEMBER{Current member?}
    MEMBER -- No --> R403[403 Forbidden]
    MEMBER -- Yes --> TYPE{Direct or group?}
    TYPE -- Direct --> FRIEND{Accepted friends?}
    FRIEND -- No --> R403
    FRIEND -- Yes --> ALLOW[Allow operation]
    TYPE -- Group --> ADMIN{Administrative action?}
    ADMIN -- No --> ALLOW
    ADMIN -- Yes --> OWNER{Creator or permitted admin?}
    OWNER -- No --> R403
    OWNER -- Yes --> ALLOW
```

## Core data relationships

```mermaid
erDiagram
    USER ||--o{ CONVERSATION_MEMBER : joins
    CONVERSATION ||--o{ CONVERSATION_MEMBER : contains
    USER ||--o{ MESSAGE : sends
    CONVERSATION ||--o{ MESSAGE : contains
    MESSAGE ||--o{ MESSAGE_ATTACHMENT : owns
    MESSAGE ||--o{ MESSAGE_REACTION : receives
    MESSAGE ||--o| MESSAGE_PIN : may_have
    MESSAGE ||--o{ MESSAGE : replies_to
    USER ||--o{ FRIENDSHIP : requests
    USER ||--o{ USER_BLOCK : blocks
    USER ||--o{ NOTIFICATION : receives
    CONVERSATION ||--o{ NOTIFICATION : concerns
    MESSAGE ||--o{ NOTIFICATION : references
```

## Production deployment topology

```mermaid
flowchart LR
    USERS[Browsers] --> CDN[Static hosting and CDN]
    USERS --> LB[HTTPS and WebSocket load balancer]
    LB --> A1[API and socket instance]
    LB --> A2[API and socket instance]
    A1 --> PG[(Managed PostgreSQL)]
    A2 --> PG
    A1 <--> REDIS[(Managed Redis)]
    A2 <--> REDIS
    USERS -->|Signed media transfer| OBJ[(Private object storage)]
    A1 --> OBJ
    A2 --> OBJ
```

API instances are stateless apart from their active socket connections. PostgreSQL remains authoritative, Redis connects instances for ephemeral delivery, and object storage carries media independently of application-server bandwidth.

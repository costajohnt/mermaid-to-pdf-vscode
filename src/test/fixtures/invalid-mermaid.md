# Invalid Mermaid Test

This document contains invalid mermaid syntax to test error handling.

## Invalid Diagram

```mermaid
invalid syntax here
this should fail gracefully
```

## Another Invalid Diagram

```mermaid
graph TD
    A[Start] --> 
    // missing connection
```
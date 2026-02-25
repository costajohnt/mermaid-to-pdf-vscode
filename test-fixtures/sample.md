# Sample Document

This is a test document with multiple Mermaid diagram types.

## Flowchart

```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do something]
    B -->|No| D[Do something else]
    C --> E[End]
    D --> E
```

Some text between diagrams to verify proper spacing.

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Alice
    participant Bob
    participant Charlie
    Alice->>Bob: Hello Bob
    Bob->>Charlie: Hi Charlie
    Charlie-->>Alice: Hey everyone
    Alice->>Bob: How are you?
    Bob-->>Alice: Great!
```

## Simple Pie Chart

```mermaid
pie title Project Hours
    "Development" : 45
    "Testing" : 25
    "Documentation" : 15
    "Meetings" : 15
```

## Class Diagram

```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
    }
    class Dog {
        +fetch() void
    }
    class Cat {
        +purr() void
    }
    Animal <|-- Dog
    Animal <|-- Cat
```

## Regular Content

This section has no diagrams. It should render normally.

- Item 1
- Item 2
- Item 3

> A blockquote for good measure.

| Column A | Column B |
|----------|----------|
| Value 1  | Value 2  |
| Value 3  | Value 4  |

The end.

# Project Development Standards

## Core Principles

This project follows strict Object-Oriented Programming principles.

When generating code:

- Use classes and objects where appropriate.
- Favor composition over inheritance.
- Follow SOLID principles.
- Apply encapsulation strictly.
- Keep classes focused on a single responsibility.
- Avoid God classes.
- Avoid large methods.
- Avoid duplicated code.
- Follow DRY (Don't Repeat Yourself).
- Follow KISS (Keep It Simple, Stupid).
- Follow Separation of Concerns.

## Architecture

- Always consider existing architecture before creating new code.
- Extend existing abstractions instead of creating parallel implementations.
- Prefer interfaces over concrete dependencies.
- Use dependency injection where applicable.
- Business logic must not be placed in controllers, routes, or UI components.
- Keep domain logic in dedicated service classes.

## Clean Code

- Use meaningful names for classes, methods, variables, and interfaces.
- Methods should perform a single responsibility.
- Keep methods small and readable.
- Avoid deeply nested conditions.
- Extract reusable logic into dedicated classes.
- Remove dead code.
- Avoid magic numbers and hardcoded strings.
- Prefer constants and configuration.

## Error Handling

- Never swallow exceptions silently.
- Use custom exception classes when appropriate.
- Provide clear error messages.
- Log errors through the project's logging system.

## Testing

- Design code for testability.
- Use dependency injection to enable mocking.
- Write unit tests for business logic.
- Avoid tightly coupled implementations.

## Code Generation Rules

Before generating code:
1. Analyze existing project structure.
2. Reuse existing classes whenever possible.
3. Check whether a similar implementation already exists.
4. Preserve architectural consistency.
5. Do not introduce unnecessary frameworks or patterns.

## Prohibited Patterns

- Massive service classes.
- Massive controllers.
- Static utility classes for business logic.
- Duplicate implementations.
- Copy-paste code.
- Business logic inside routes/controllers/views.
- Tight coupling between modules.

## Expected Outcome

Generated code should be:
- Object-oriented
- SOLID compliant
- Clean and maintainable
- Easily testable
- Extensible
- Production-ready
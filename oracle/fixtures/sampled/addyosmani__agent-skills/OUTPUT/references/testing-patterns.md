# Testing Patterns

Supplementary detail for `skills/test-driven-development/SKILL.md`.
JavaScript/TypeScript examples; the patterns generalize.

## Structure and naming

Name a test after the behavior it proves, not the function it calls:

```js
// Weak: names the function, not the behavior
test('getUser', () => { ... });

// Strong: names the behavior and the condition
test('returns null when the user id does not exist', () => { ... });
```

Arrange / Act / Assert, kept visually separated even in a short test:

```js
test('applies a 10% discount for orders over $100', () => {
  // Arrange
  const order = buildOrder({ subtotal: 150 });

  // Act
  const total = applyDiscount(order);

  // Assert
  expect(total).toBe(135);
});
```

## Mocking

Mock at the boundary the test doesn't own (network, clock, filesystem), not
at the boundary between two units of your own logic — mocking your own
collaborator hides the integration bug this skill's pyramid relies on the
integration layer to catch.

```js
// Boundary worth mocking: an external HTTP call
jest.mock('./httpClient');

// Boundary NOT worth mocking: two of your own modules calling each other —
// let them actually call each other, or write an integration test instead.
```

## React example (component test)

```jsx
test('shows an error message when the field is empty on submit', () => {
  render(<SignupForm />);
  fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
  expect(screen.getByText(/email is required/i)).toBeInTheDocument();
});
```

## API example (integration test)

```js
test('POST /orders rejects a negative quantity with 400', async () => {
  const res = await request(app)
    .post('/orders')
    .send({ sku: 'abc', quantity: -1 });
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('INVALID_QUANTITY');
});
```

## End-to-end example

```js
test('a user can complete checkout with a saved card', async () => {
  await page.goto('/cart');
  await page.click('text=Checkout');
  await page.click('text=Use saved card');
  await page.click('text=Place order');
  await expect(page.locator('text=Order confirmed')).toBeVisible();
});
```

## Anti-patterns

- **Testing implementation, not behavior**: asserting a private method was
  called instead of asserting the observable outcome — breaks on refactor
  even when behavior is unchanged.
- **Shared mutable fixtures**: tests that pass only in a specific run order
  because they share state — each test should set up its own state.
- **Snapshot tests with no reviewed intent**: a snapshot that gets
  re-approved automatically on failure without reading the diff isn't
  asserting anything.
- **One assertion buried in a large setup block**: if the setup dwarfs the
  assertion, the test is proving the setup works, not the behavior.

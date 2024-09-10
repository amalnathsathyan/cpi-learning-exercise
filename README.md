# CPI Returns - Developer Tutorial Exercise

This project demonstrates how to handle Cross-Program Invocations (CPI) in a Solana program, built using the **Anchor** framework for Solana development. It focuses on returning various data types like `u64`, `struct`, and `vec` through both CPI and direct function calls.

## Features

- Return values (`u64`, struct, and vector) through both CPI and direct calls
- Set and retrieve values via view functions
- Handle mutable instructions via view

## Getting Started

This exercise is part of a developer tutorial to practice using CPIs in Solana development. I followed the course [here](https://careerbooster.teachable.com/courses/2085499/).

### Prerequisites

- Rust
- Solana CLI
- Anchor framework

## Running the tests

To run the tests:

```bash
anchor test
```

To run the tests for this project without starting a local validator (assuming it's already running), use the following command:
```bash
anchor test --skip-local-validator


